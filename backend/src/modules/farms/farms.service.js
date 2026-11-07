/**
 * Exigences CDC couvertes : FARM-01, FARM-02, FARM-03, FARM-04.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { withTransaction } from '../../shared/transaction.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { uniqueSlug } from '../../shared/slug.js';
import { paginationArgs, orderBy, textFilter } from '../../shared/pagination.js';
import { pointGeoJson, approximate, isValidCoordinate } from '../../shared/geo.js';
import { assertOwnership } from '../../middleware/tenant.js';
import { audit } from '../../shared/audit.js';

const PUBLIC_SELECT = {
  id: true,
  name: true,
  slug: true,
  previousSlugs: true,
  description: true,
  countryCode: true,
  province: true,
  territory: true,
  sector: true,
  village: true,
  publicLatitude: true,
  publicLongitude: true,
  totalAreaHa: true,
  workers: true,
  capacity: true,
  foundedYear: true,
  isPublic: true,
  viewCount: true,
  verificationStatus: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
};

/** Position publique approximative (MAP-04) : jamais la coordonnée exacte. */
const publicCoords = (latitude, longitude, visibility) => {
  if (!isValidCoordinate(latitude, longitude)) return { lat: null, lng: null };
  const mode = visibility?.location ?? 'approximate';
  if (mode === 'private') return { lat: null, lng: null };
  if (mode === 'exact') return { lat: Number(latitude), lng: Number(longitude) };
  return {
    lat: approximate(latitude, env.PUBLIC_COORD_DECIMALS),
    lng: approximate(longitude, env.PUBLIC_COORD_DECIMALS),
  };
};

export const list = async (query, req) => {
  const { page, limit, sort, order, search, countryCode, province, cropId, archived } = query;

  const where = {
    organizationId: req.tenant.organizationId,
    ...(archived === 'true' ? { NOT: { deletedAt: null } } : { deletedAt: null }),
    ...(countryCode ? { countryCode } : {}),
    ...(province ? { province } : {}),
    ...(search ? { name: textFilter(search) } : {}),
    ...(cropId ? { crops: { some: { cropId } } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.farm.findMany({
      where,
      ...paginationArgs({ page, limit }),
      orderBy: orderBy(sort, order, ['createdAt', 'updatedAt', 'name']),
      include: {
        crops: { select: { crop: { select: { id: true, slug: true, names: true } } } },
        _count: { select: { plots: true } },
      },
    }),
    prisma.farm.count({ where }),
  ]);

  return { items, total, page, limit };
};

export const getOne = async (id, req) => {
  const farm = await prisma.farm.findUnique({
    where: { id },
    include: {
      crops: { select: { crop: true } },
      plots: { where: { deletedAt: null }, select: { id: true, name: true, areaHa: true, status: true, currentCropId: true } },
      media: { where: { deletedAt: null }, orderBy: { position: 'asc' } },
    },
  });

  return assertOwnership(farm, req.tenant.organizationId, 'Exploitation');
};

/** FARM-04 : contrôle de cohérence superficie totale vs somme des parcelles. */
const areaWarning = async (farmId, totalAreaHa) => {
  if (!totalAreaHa) return null;
  const plots = await prisma.plot.findMany({
    where: { farmId, deletedAt: null },
    select: { areaHa: true },
  });
  const sum = plots.reduce((acc, p) => acc + (p.areaHa ?? 0), 0);
  if (sum === 0) return null;
  const gap = Math.abs(sum - totalAreaHa);
  if (gap < totalAreaHa * 0.1) return null;
  return {
    code: 'AREA_MISMATCH',
    message: `La somme des parcelles (${sum.toFixed(2)} ha) diffère de la superficie déclarée (${totalAreaHa} ha).`,
    plotsAreaHa: Math.round(sum * 100) / 100,
    declaredAreaHa: totalAreaHa,
    // Alerte, jamais blocage (FARM-04)
    blocking: false,
  };
};

export const create = async (payload, req) => {
  const { cropIds = [], visibility = {}, ...data } = payload;

  if ((data.latitude && !isValidCoordinate(data.latitude, data.longitude)) ||
      (data.longitude && !isValidCoordinate(data.latitude, data.longitude))) {
    throw ApiError.badRequest('Coordonnées géographiques invalides');
  }

  const slug = await uniqueSlug(data.name, async (candidate) =>
    Boolean(await prisma.farm.findUnique({ where: { slug: candidate } })),
  );

  const { lat, lng } = publicCoords(data.latitude, data.longitude, visibility);

  const farm = await prisma.farm.create({
    data: {
      id: resolveId(payload.id),
      organizationId: req.tenant.organizationId,
      name: data.name,
      slug,
      description: data.description ?? null,
      countryCode: data.countryCode,
      province: data.province ?? null,
      territory: data.territory ?? null,
      sector: data.sector ?? null,
      village: data.village ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      location:
        data.latitude !== undefined && data.longitude !== undefined
          ? pointGeoJson(data.latitude, data.longitude)
          : undefined,
      publicLatitude: lat,
      publicLongitude: lng,
      totalAreaHa: data.totalAreaHa ?? null,
      workers: data.workers ?? null,
      capacity: data.capacity ?? null,
      foundedYear: data.foundedYear ?? null,
      visibility,
      createdBy: req.user.id,
      ...(cropIds.length
        ? { crops: { create: cropIds.map((cropId) => ({ cropId })) } }
        : {}),
    },
    include: { crops: { select: { crop: true } } },
  });

  await audit({
    actorId: req.user.id,
    action: 'farm.create',
    resource: 'farms',
    resourceId: farm.id,
    req,
    newValue: { name: data.name, slug },
  });

  return { farm, warnings: await areaWarning(farm.id, farm.totalAreaHa) };
};

export const update = async (id, payload, req) => {
  const existing = assertOwnership(
    await prisma.farm.findUnique({ where: { id } }),
    req.tenant.organizationId,
    'Exploitation',
  );

  const { cropIds, visibility, ...data } = payload;
  const nextVisibility = visibility ?? existing.visibility ?? {};
  const nextLat = data.latitude ?? existing.latitude;
  const nextLng = data.longitude ?? existing.longitude;
  const { lat, lng } = publicCoords(nextLat, nextLng, nextVisibility);

  const updateData = {
    ...data,
    ...(lat !== null ? { publicLatitude: lat, publicLongitude: lng } : {}),
    ...(visibility ? { visibility } : {}),
    ...(data.latitude !== undefined || data.longitude !== undefined
      ? {
          location:
            nextLat !== null && nextLng !== null
              ? pointGeoJson(nextLat, nextLng)
              : undefined,
        }
      : {}),
    version: { increment: 1 },
  };

  // Le slug suit le nom tant que le profil n'est pas publié (PUB-02);
  // ensuite on conserve l'ancien pour la redirection.
  if (data.name && data.name !== existing.name) {
    const newSlug = await uniqueSlug(data.name, async (candidate) =>
      candidate !== existing.slug && Boolean(await prisma.farm.findUnique({ where: { slug: candidate } })),
    );
    if (newSlug !== existing.slug) {
      updateData.slug = newSlug;
      if (existing.isPublic) updateData.previousSlugs = { set: [...existing.previousSlugs, existing.slug] };
    }
  }

  // NFR-03 — mise à jour de l'exploitation et de ses cultures : atomique.
  const farm = await withTransaction(async (tx) => {
    if (cropIds) {
      await tx.farmCrop.deleteMany({ where: { farmId: id } });
      if (cropIds.length) {
        await tx.farmCrop.createMany({ data: cropIds.map((cropId) => ({ farmId: id, cropId })) });
      }
    }
    return tx.farm.update({
      where: { id },
      data: updateData,
      include: { crops: { select: { crop: true } } },
    });
  });

  await audit({
    actorId: req.user.id,
    action: 'farm.update',
    resource: 'farms',
    resourceId: id,
    req,
    oldValue: { name: existing.name, totalAreaHa: existing.totalAreaHa },
    newValue: payload,
  });

  return { farm, warnings: await areaWarning(id, farm.totalAreaHa) };
};

/** PLOT-04 / FARM : archivage logique, jamais de suppression physique. */
export const archive = async (id, req) => {
  const farm = assertOwnership(
    await prisma.farm.findUnique({ where: { id } }),
    req.tenant.organizationId,
    'Exploitation',
  );

  await prisma.farm.update({
    where: { id },
    data: { deletedAt: new Date(), isPublic: false, version: { increment: 1 } },
  });

  await audit({
    actorId: req.user.id,
    action: 'farm.archive',
    resource: 'farms',
    resourceId: id,
    req,
    oldValue: { name: farm.name },
  });

  return { archived: true };
};

/**
 * PUB-01/05 : publication du profil public.
 * Un compte non vérifié ne peut pas publier (AUTH-02/03).
 */
export const publish = async (id, isPublic, req) => {
  const farm = assertOwnership(
    await prisma.farm.findUnique({ where: { id } }),
    req.tenant.organizationId,
    'Exploitation',
  );

  if (isPublic && !req.user.emailConfirmed && !req.user.phoneVerified) {
    throw ApiError.forbidden(
      'Vérifie ton téléphone ou ton email avant de publier ton profil public',
    );
  }

  const updated = await prisma.farm.update({
    where: { id },
    data: { isPublic, version: { increment: 1 } },
    select: PUBLIC_SELECT,
  });

  await audit({
    actorId: req.user.id,
    action: isPublic ? 'farm.publish' : 'farm.unpublish',
    resource: 'farms',
    resourceId: id,
    req,
  });

  return { farm: updated, publicUrl: `/farm/${farm.slug}` };
};
