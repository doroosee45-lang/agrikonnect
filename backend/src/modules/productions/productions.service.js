/**
 * Exigences CDC couvertes : PROD-01, PROD-02, PROD-03, PROD-04.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { toKilograms, isConvertible } from '../../shared/units.js';
import { paginationArgs, orderBy } from '../../shared/pagination.js';
import { assertOwnership } from '../../middleware/tenant.js';
import { audit } from '../../shared/audit.js';

const assertFarm = async (farmId, organizationId) => {
  const farm = await prisma.farm.findUnique({ where: { id: farmId } });
  return assertOwnership(farm, organizationId, 'Exploitation');
};

/**
 * PROD-02 : conversion via le référentiel d'unités. Si l'unité locale n'est
 * pas convertible, `quantityKg` reste null — on n'invente jamais de valeur.
 */
const resolveQuantityKg = async ({ cropId, unit, quantity }) => {
  const crop = await prisma.crop.findUnique({ where: { id: cropId }, select: { units: true } });
  const overrides = (crop?.units && typeof crop.units === 'object' ? crop.units : {}) ?? {};
  const kg = toKilograms(quantity, unit, overrides);
  return {
    quantityKg: kg,
    convertible: isConvertible(unit, overrides),
  };
};

export const list = async (query, req) => {
  const { page, limit, sort, order, farmId, plotId, cropId, season, from, to } = query;

  const where = {
    organizationId: req.tenant.organizationId,
    deletedAt: null,
    ...(farmId ? { farmId } : {}),
    ...(plotId ? { plotId } : {}),
    ...(cropId ? { cropId } : {}),
    ...(season ? { season } : {}),
    ...(from || to
      ? { harvestedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.production.findMany({
      where,
      ...paginationArgs({ page, limit }),
      orderBy: orderBy(sort, order, ['harvestedAt', 'createdAt']),
      include: {
        crop: { select: { id: true, slug: true, names: true } },
        plot: { select: { id: true, name: true } },
        farm: { select: { id: true, name: true } },
      },
    }),
    prisma.production.count({ where }),
  ]);

  return { items, total, page, limit };
};

export const getOne = async (id, req) => {
  const production = await prisma.production.findUnique({
    where: { id },
    include: { crop: true, plot: { select: { id: true, name: true } }, farm: { select: { id: true, name: true } } },
  });
  return assertOwnership(production, req.tenant.organizationId, 'Production');
};

export const create = async (payload, req) => {
  await assertFarm(payload.farmId, req.tenant.organizationId);

  if (payload.plotId) {
    const plot = await prisma.plot.findUnique({ where: { id: payload.plotId } });
    const owned = assertOwnership(plot, req.tenant.organizationId, 'Parcelle');
    if (owned.farmId !== payload.farmId) {
      throw ApiError.badRequest('La parcelle n\'appartient pas à cette exploitation');
    }
  }

  const crop = await prisma.crop.findFirst({ where: { id: payload.cropId, deletedAt: null } });
  if (!crop) throw ApiError.badRequest('Culture inconnue dans le référentiel');

  const { quantityKg, convertible } = await resolveQuantityKg(payload);

  const production = await prisma.production.create({
    data: {
      id: resolveId(payload.id),
      organizationId: req.tenant.organizationId,
      farmId: payload.farmId,
      plotId: payload.plotId ?? null,
      cropId: payload.cropId,
      harvestedAt: payload.harvestedAt,
      season: payload.season,
      quantity: payload.quantity,
      unit: payload.unit,
      quantityKg,
      quality: payload.quality ?? null,
      destination: payload.destination ?? null,
      source: 'declared', // PROD-04
      createdBy: req.user.id,
    },
    include: { crop: { select: { id: true, slug: true, names: true } } },
  });

  await audit({
    actorId: req.user.id,
    action: 'production.create',
    resource: 'productions',
    resourceId: production.id,
    req,
    newValue: {
      cropId: payload.cropId,
      quantity: payload.quantity,
      unit: payload.unit,
      season: payload.season,
    },
  });

  return {
    production,
    conversion: {
      quantityKg,
      convertible,
      message: convertible
        ? null
        : `L'unité « ${payload.unit} » n'est pas convertible en kg dans le référentiel : la valeur est conservée telle quelle.`,
    },
  };
};

export const update = async (id, payload, req) => {
  const existing = assertOwnership(
    await prisma.production.findUnique({ where: { id } }),
    req.tenant.organizationId,
    'Production',
  );

  const merged = {
    cropId: payload.cropId ?? existing.cropId,
    unit: payload.unit ?? existing.unit,
    quantity: payload.quantity ?? existing.quantity,
  };

  const { quantityKg } = await resolveQuantityKg(merged);

  // PROD-04 : toute modification est historisée (audit) et conserve la provenance
  const updated = await prisma.production.update({
    where: { id },
    data: { ...payload, quantityKg, version: { increment: 1 } },
    include: { crop: { select: { id: true, slug: true, names: true } } },
  });

  await audit({
    actorId: req.user.id,
    action: 'production.update',
    resource: 'productions',
    resourceId: id,
    req,
    oldValue: {
      quantity: existing.quantity,
      unit: existing.unit,
      cropId: existing.cropId,
      quality: existing.quality,
    },
    newValue: payload,
  });

  return updated;
};

export const archive = async (id, req) => {
  assertOwnership(
    await prisma.production.findUnique({ where: { id } }),
    req.tenant.organizationId,
    'Production',
  );
  await prisma.production.update({
    where: { id },
    data: { deletedAt: new Date(), version: { increment: 1 } },
  });
  await audit({ actorId: req.user.id, action: 'production.archive', resource: 'productions', resourceId: id, req });
  return { archived: true };
};

/**
 * PROD-03 — statistiques issues d'agrégations réelles (CDC P3 : aucun chiffre inventé).
 * Chaque valeur renvoyée est calculable par une requête sur `productions`.
 */
export const stats = async (query, req) => {
  const { groupBy, farmId, season, from, to } = query;

  const where = {
    organizationId: req.tenant.organizationId,
    deletedAt: null,
    ...(farmId ? { farmId } : {}),
    ...(season ? { season } : {}),
    ...(from || to
      ? { harvestedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
  };

  const rows = await prisma.production.findMany({
    where,
    select: {
      cropId: true,
      plotId: true,
      harvestedAt: true,
      quantity: true,
      quantityKg: true,
      unit: true,
      crop: { select: { names: true, slug: true } },
      plot: { select: { name: true } },
    },
  });

  const buckets = new Map();

  for (const row of rows) {
    let key;
    let label;

    if (groupBy === 'crop') {
      key = row.cropId;
      label = row.crop?.names?.fr ?? row.crop?.slug ?? row.cropId;
    } else if (groupBy === 'plot') {
      key = row.plotId ?? 'unassigned';
      label = row.plot?.name ?? 'Sans parcelle';
    } else {
      const date = new Date(row.harvestedAt);
      key = groupBy === 'month'
        ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
        : String(date.getUTCFullYear());
      label = key;
    }

    const current = buckets.get(key) ?? {
      key,
      label,
      records: 0,
      quantityKg: 0,
      convertibleRecords: 0,
      units: {},
    };

    current.records += 1;
    current.units[row.unit] = (current.units[row.unit] ?? 0) + row.quantity;
    if (row.quantityKg !== null) {
      current.quantityKg = Math.round((current.quantityKg + row.quantityKg) * 1000) / 1000;
      current.convertibleRecords += 1;
    }
    buckets.set(key, current);
  }

  const series = [...buckets.values()].sort((a, b) => b.records - a.records);

  const totalKg = series.reduce((acc, s) => acc + s.quantityKg, 0);

  return {
    groupBy,
    filters: { farmId: farmId ?? null, season: season ?? null, from: from ?? null, to: to ?? null },
    totals: {
      records: rows.length,
      quantityKg: Math.round(totalKg * 1000) / 1000,
      // Explicitement exposé : les unités non convertibles ne sont pas
      // additionnées dans quantityKg (P3 — pas de total trompeur).
      recordsWithoutKg: rows.length - rows.filter((r) => r.quantityKg !== null).length,
    },
    series,
    source: 'declared',
  };
};
