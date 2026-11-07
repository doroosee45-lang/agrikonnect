/**
 * Exigences CDC couvertes : PLOT-01, PLOT-02, PLOT-03, PLOT-04, PLOT-05.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { centroidOf, isValidCoordinate, polygonAreaHa } from '../../shared/geo.js';
import { paginationArgs, orderBy, textFilter } from '../../shared/pagination.js';
import { assertOwnership } from '../../middleware/tenant.js';
import { audit } from '../../shared/audit.js';

/** Vérifie que l'exploitation parente appartient bien au tenant. */
const assertFarm = async (farmId, organizationId) => {
  const farm = await prisma.farm.findUnique({ where: { id: farmId } });
  return assertOwnership(farm, organizationId, 'Exploitation');
};

/**
 * PLOT-05 — le point déclaré doit tomber dans le pays déclaré.
 *
 * Les bornes du pays proviennent de `Country.complianceProfile.bounds` (référentiel
 * administré). Si elles ne sont pas documentées, on ne prétend PAS avoir vérifié :
 * la réponse le dit explicitement (`checked: false`), plutôt que d'inventer une
 * géométrie nationale.
 */
const assertPointInCountry = async (lat, lng, countryCode) => {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return { checked: false };

  const country = countryCode
    ? await prisma.country.findUnique({ where: { code: countryCode } })
    : null;
  const bounds = country?.complianceProfile?.bounds ?? null;

  if (!bounds?.minLat && !bounds?.minLng) {
    return { checked: false, reason: 'bornes du pays non documentées dans le référentiel' };
  }

  const inside =
    lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng;

  if (!inside) {
    throw ApiError.badRequest(
      `Le point (${lat}, ${lng}) est hors du pays déclaré (${countryCode}) : vérifiez la localisation`,
      { countryCode, bounds },
    );
  }

  return { checked: true, inside: true };
};

const geometryBounds = (geometry) => {
  if (geometry?.type === 'Polygon') {
    const ring = geometry.coordinates?.[0] ?? [];
    const lats = ring.map((c) => Number(c[1]));
    const lngs = ring.map((c) => Number(c[0]));
    if (!lats.length) return { valid: false };
    const valid = lats.every((v, i) => isValidCoordinate(v, lngs[i]));
    return { valid, centroid: centroidOf(geometry), areaHa: polygonAreaHa(geometry) };
  }
  const { coordinates } = geometry ?? {};
  const valid = Array.isArray(coordinates) && isValidCoordinate(coordinates[1], coordinates[0]);
  return { valid, centroid: centroidOf(geometry), areaHa: null };
};

export const list = async (query, req) => {
  const { page, limit, sort, order, farmId, status, cropId, search } = query;

  const where = {
    organizationId: req.tenant.organizationId,
    deletedAt: null,
    ...(farmId ? { farmId } : {}),
    ...(status ? { status } : {}),
    ...(cropId ? { currentCropId: cropId } : {}),
    ...(search ? { name: textFilter(search) } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.plot.findMany({
      where,
      ...paginationArgs({ page, limit }),
      orderBy: orderBy(sort, order, ['createdAt', 'updatedAt', 'name']),
      include: {
        farm: { select: { id: true, name: true, slug: true } },
        currentCrop: { select: { id: true, slug: true, names: true } },
        _count: { select: { histories: true, productions: true, soilAssessments: true } },
      },
    }),
    prisma.plot.count({ where }),
  ]);

  return { items, total, page, limit };
};

export const getOne = async (id, req) => {
  const plot = await prisma.plot.findUnique({
    where: { id },
    include: {
      farm: { select: { id: true, name: true, slug: true, countryCode: true, province: true } },
      currentCrop: true,
      histories: { where: { deletedAt: null }, orderBy: [{ year: 'desc' }, { season: 'desc' }] },
      media: { where: { deletedAt: null }, orderBy: { position: 'asc' } },
      soilAssessments: {
        where: { deletedAt: null },
        orderBy: { assessedAt: 'desc' },
        include: { parameters: true },
        take: 5,
      },
    },
  });

  return assertOwnership(plot, req.tenant.organizationId, 'Parcelle');
};

export const create = async (payload, req) => {
  const farm = await assertFarm(payload.farmId, req.tenant.organizationId);

  const bounds = geometryBounds(payload.geometry);
  if (!bounds.valid) throw ApiError.badRequest('Géométrie invalide ou coordonnées hors bornes');

  // PLOT-05 : le point doit être dans le pays déclaré par l'exploitation
  const countryCheck = await assertPointInCountry(
    bounds.centroid.lat,
    bounds.centroid.lng,
    farm?.countryCode,
  );

  // PLOT-02 : superficie calculée depuis le polygone si non fournie
  const areaHa = payload.areaHa ?? bounds.areaHa ?? null;

  const plot = await prisma.plot.create({
    data: {
      id: resolveId(payload.id),
      organizationId: req.tenant.organizationId,
      farmId: payload.farmId,
      name: payload.name,
      areaHa,
      geometryType: payload.geometry.type === 'Polygon' ? 'POLYGON' : 'POINT',
      geometry: payload.geometry,
      latitude: bounds.centroid.lat,
      longitude: bounds.centroid.lng,
      currentCropId: payload.currentCropId ?? null,
      plantingDate: payload.plantingDate ?? null,
      status: payload.status,
      createdBy: req.user.id,
    },
    include: { currentCrop: { select: { id: true, slug: true, names: true } } },
  });

  await audit({
    actorId: req.user.id,
    action: 'plot.create',
    resource: 'plots',
    resourceId: plot.id,
    req,
    newValue: { name: plot.name, farmId: plot.farmId, areaHa, countryCheck },
  });

  return {
    plot,
    computed: { areaHa, areaSource: payload.areaHa ? 'declared' : 'derived' },
    locationCheck: countryCheck,
  };
};

export const update = async (id, payload, req) => {
  const existing = assertOwnership(
    await prisma.plot.findUnique({ where: { id } }),
    req.tenant.organizationId,
    'Parcelle',
  );

  if (payload.farmId && payload.farmId !== existing.farmId) {
    await assertFarm(payload.farmId, req.tenant.organizationId);
  }

  const farm = await prisma.farm.findUnique({ where: { id: payload.farmId ?? existing.farmId } });

  let geo = {};
  if (payload.geometry) {
    const bounds = geometryBounds(payload.geometry);
    if (!bounds.valid) throw ApiError.badRequest('Géométrie invalide');

    // PLOT-05 : même contrôle à la mise à jour de la géométrie
    await assertPointInCountry(bounds.centroid.lat, bounds.centroid.lng, farm?.countryCode);

    geo = {
      geometry: payload.geometry,
      geometryType: payload.geometry.type === 'Polygon' ? 'POLYGON' : 'POINT',
      latitude: bounds.centroid.lat,
      longitude: bounds.centroid.lng,
      ...(payload.areaHa === undefined && bounds.areaHa ? { areaHa: bounds.areaHa } : {}),
    };
  }

  const { geometry, version, ...rest } = payload;

  // PLOT-03 — contrôle de concurrence optimiste : une écriture bâtie sur une
  // version périmée est refusée (409) au lieu d'écraser silencieusement la
  // modification d'un autre utilisateur. `version` n'est jamais écrite
  // directement : seul l'incrément serveur fait foi.
  if (version !== undefined && Number(version) !== Number(existing.version ?? 0)) {
    throw ApiError.conflict(
      `Écriture concurrente refusée : version ${existing.version} attendue, ${version} reçue. Rechargez la parcelle avant de réessayer.`,
    );
  }

  const plot = await prisma.plot.update({
    where: { id },
    data: { ...rest, ...geo, version: { increment: 1 } },
  });

  await audit({
    actorId: req.user.id,
    action: 'plot.update',
    resource: 'plots',
    resourceId: id,
    req,
    oldValue: { name: existing.name, status: existing.status },
    newValue: payload,
  });

  return plot;
};

/** PLOT-04 : archivage logique, l'historique est conservé. */
export const archive = async (id, req) => {
  assertOwnership(
    await prisma.plot.findUnique({ where: { id } }),
    req.tenant.organizationId,
    'Parcelle',
  );

  await prisma.plot.update({
    where: { id },
    data: { deletedAt: new Date(), version: { increment: 1 } },
  });

  await audit({
    actorId: req.user.id,
    action: 'plot.archive',
    resource: 'plots',
    resourceId: id,
    req,
  });

  return { archived: true };
};

// ─────────────────────────────────────────────────────────────
// PLOT-03 — historique cultural
// ─────────────────────────────────────────────────────────────

export const listHistory = async (plotId, req) => {
  assertOwnership(
    await prisma.plot.findUnique({ where: { id: plotId } }),
    req.tenant.organizationId,
    'Parcelle',
  );

  const items = await prisma.plotCropHistory.findMany({
    where: { plotId, deletedAt: null },
    orderBy: [{ year: 'desc' }, { season: 'desc' }],
    include: { crop: { select: { id: true, slug: true, names: true } } },
  });

  // Frise chronologique (SOIL-03)
  const timeline = items
    .slice()
    .reverse()
    .map((h) => ({
      id: h.id,
      label: `${h.crop?.names?.fr ?? h.cropId} · ${h.season} ${h.year}`,
      year: h.year,
      season: h.season,
      cropId: h.cropId,
      plantedAt: h.plantedAt,
      harvestedAt: h.harvestedAt,
      declaredYield: h.declaredYield,
      unit: h.unit,
      source: h.source,
    }));

  return { items, timeline };
};

export const addHistory = async (plotId, payload, req) => {
  assertOwnership(
    await prisma.plot.findUnique({ where: { id: plotId } }),
    req.tenant.organizationId,
    'Parcelle',
  );

  const crop = await prisma.crop.findFirst({ where: { id: payload.cropId, deletedAt: null } });
  if (!crop) throw ApiError.badRequest('Culture inconnue dans le référentiel');

  const entry = await prisma.plotCropHistory.create({
    data: {
      id: resolveId(payload.id),
      organizationId: req.tenant.organizationId,
      plotId,
      season: payload.season,
      year: payload.year,
      cropId: payload.cropId,
      plantedAt: payload.plantedAt ?? null,
      harvestedAt: payload.harvestedAt ?? null,
      declaredYield: payload.declaredYield ?? null,
      unit: payload.unit ?? null,
      notes: payload.notes ?? null,
      createdBy: req.user.id,
    },
    include: { crop: { select: { id: true, slug: true, names: true } } },
  });

  await audit({
    actorId: req.user.id,
    action: 'plot.history.create',
    resource: 'plot_crop_history',
    resourceId: entry.id,
    req,
    newValue: { plotId, cropId: payload.cropId, year: payload.year, season: payload.season },
  });

  return entry;
};

export const updateHistory = async (plotId, historyId, payload, req) => {
  assertOwnership(
    await prisma.plot.findUnique({ where: { id: plotId } }),
    req.tenant.organizationId,
    'Parcelle',
  );

  const entry = await prisma.plotCropHistory.findUnique({ where: { id: historyId } });
  if (!entry || entry.plotId !== plotId || entry.deletedAt) {
    throw ApiError.notFound('Entrée d\'historique introuvable');
  }

  const updated = await prisma.plotCropHistory.update({
    where: { id: historyId },
    data: { ...payload, version: { increment: 1 } },
  });

  await audit({
    actorId: req.user.id,
    action: 'plot.history.update',
    resource: 'plot_crop_history',
    resourceId: historyId,
    req,
    oldValue: { declaredYield: entry.declaredYield, notes: entry.notes },
    newValue: payload,
  });

  return updated;
};
