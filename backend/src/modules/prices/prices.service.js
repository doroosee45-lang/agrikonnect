/**
 * Exigences CDC couvertes : PRI-01, PRI-02, PRI-03
 * (identifiants du cahier des charges : PRC-01, PRC-02, PRC-03).
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { audit } from '../../shared/audit.js';

/**
 * PRI-01 → PRI-03 — Prix de marché.
 *
 * Chaque prix est daté (`observedAt`) et sourcé (`source` + `sourceLabel`).
 * Aucune moyenne « estimée » n'est présentée comme un prix observé :
 * l'agrégat renvoie systématiquement le nombre de relevés et la période.
 */

export const list = async (query, req) => {
  const { cropId, market, countryCode, since, limit } = query;

  const where = {
    ...(cropId ? { cropId } : {}),
    ...(market ? { market: { contains: market, mode: 'insensitive' } } : {}),
    ...(countryCode ? { countryCode } : {}),
    ...(since ? { observedAt: { gte: since } } : {}),
  };

  const items = await prisma.marketPrice.findMany({
    where,
    orderBy: { observedAt: 'desc' },
    take: Math.min(Number(limit ?? 50), 200),
    include: { },
  });

  if (items.length === 0) {
    return {
      items: [],
      available: false,
      message: 'Aucun relevé de prix pour ces critères. La plateforme ne publie pas de prix estimé sans source.',
    };
  }

  return {
    items,
    count: items.length,
    period: {
      from: items[items.length - 1].observedAt,
      to: items[0].observedAt,
    },
    sources: [...new Set(items.map((i) => i.sourceLabel ?? i.source))],
  };
};

/** PRI-02 — série temporelle par culture et marché. */
export const series = async (query, req) => {
  const { cropId, market, countryCode, days = 90 } = query;
  const since = new Date(Date.now() - Number(days) * 24 * 3600 * 1000);

  const prices = await prisma.marketPrice.findMany({
    where: { cropId, ...(market ? { market } : {}), ...(countryCode ? { countryCode } : {}), observedAt: { gte: since } },
    orderBy: { observedAt: 'asc' },
  });

  if (prices.length === 0) {
    return { cropId, available: false, points: [], message: 'Aucun relevé sur la période.' };
  }

  const values = prices.map((p) => Number(p.price));
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  return {
    cropId,
    market: market ?? null,
    available: true,
    points: prices.map((p) => ({
      observedAt: p.observedAt,
      price: p.price,
      currency: p.currency,
      unit: p.unit,
      source: p.source,
      sourceLabel: p.sourceLabel,
    })),
    stats: {
      count: prices.length,
      min: Math.min(...values),
      max: Math.max(...values),
      // Moyenne observée (et non « prix recommandé »)
      mean: Math.round(avg * 100) / 100,
      currency: prices[0].currency,
      unit: prices[0].unit,
    },
    method: {
      label: 'moyenne arithmétique des relevés datés',
      observations: prices.length,
      minObservationsForDisplay: 3,
      reliable: prices.length >= 3,
    },
    disclaimer:
      'Prix indicatifs issus de relevés de marché. Ils ne constituent ni une offre commerciale ni un conseil en investissement.',
  };
};

/** PRI-03 — saisie d'un relevé par un agent de terrain ou un partenaire. */
export const record = async (payload, req) => {
  const crop = await prisma.crop.findFirst({ where: { id: payload.cropId, deletedAt: null } });
  if (!crop) throw ApiError.badRequest('Culture inconnue dans le référentiel');

  const price = await prisma.marketPrice.create({
    data: {
      id: `prc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      cropId: payload.cropId,
      market: payload.market,
      city: payload.city ?? null,
      countryCode: payload.countryCode,
      price: payload.price,
      currency: payload.currency,
      unit: payload.unit,
      observedAt: payload.observedAt,
      source: payload.source,
      sourceLabel: payload.sourceLabel ?? null,
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'price.record',
    resource: 'market_prices',
    resourceId: price.id,
    req,
    newValue: { cropId: price.cropId, market: price.market, price: price.price, currency: price.currency, source: price.source },
  });

  return price;
};

/** Relevés à valider (contrôle qualité des saisies partenaires). */
export const staleMarkets = async () => {
  const cutoff = new Date(Date.now() - 14 * 24 * 3600 * 1000);

  const recent = await prisma.marketPrice.groupBy({
    by: ['cropId', 'market'],
    _max: { observedAt: true },
    _count: { _all: true },
  });

  const stale = recent.filter((r) => !r._max.observedAt || r._max.observedAt < cutoff);

  if (stale.length === 0) return { stale: [], message: 'Tous les marchés suivis ont un relevé récent.' };

  return {
    stale: stale.map((s) => ({
      cropId: s.cropId,
      market: s.market,
      lastObservedAt: s._max.observedAt,
      observations: s._count._all,
      warning: 'Aucun relevé récent : aucun prix ne doit être affiché comme actuel pour ce marché.',
    })),
    cutoff,
  };
};
