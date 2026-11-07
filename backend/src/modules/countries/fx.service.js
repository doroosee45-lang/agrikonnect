/**
 * Exigences CDC couvertes : GLB-03, FX-01, FX-02, FX-03.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { audit } from '../../shared/audit.js';

/**
 * GLB-03 — Taux de change.
 *
 * Le CDC V5 §10 exige qu'aucune conversion ne soit faite sans **date** et
 * **source**. Une table de référence est donc tenue ici, plutôt que de laisser
 * chaque appelant inventer un taux :
 *  - `GET /countries/fx-rates?base=USD&quote=CDF` renvoie la dernière cotation
 *    connue avec sa fraîcheur (`stale` au-delà de 48 h) ;
 *  - un taux périmé n'est jamais présenté comme courant ;
 *  - l'écriture est réservée à l'administration (`fx.write`) et auditée.
 *
 * La conversion elle-même reste dans `shared/money.js` (arrondi + taux fourni) :
 * ce module ne fait que **fournir** un taux vérifiable.
 */

/** Fraîcheur au-delà de laquelle une cotation est signalée comme périmée. */
export const STALE_AFTER_HOURS = 48;

const normalize = (value, field) => {
  const code = String(value ?? '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    throw ApiError.badRequest(`Devise invalide pour ${field} (ISO 4217, ex. USD)`, [
      { field, code: 'invalid' },
    ]);
  }
  return code;
};

const decorate = (rate) => {
  if (!rate) return null;
  const ageHours = Math.max(0, Math.round((Date.now() - new Date(rate.asOf).getTime()) / 3_600_000));

  return {
    ...rate,
    ageHours,
    stale: ageHours > STALE_AFTER_HOURS,
    ...(ageHours > STALE_AFTER_HOURS
      ? { warning: `Cotation vieille de ${ageHours} h : à rafraîchir avant toute conversion opposable.` }
      : {}),
  };
};

/** Dernière cotation connue pour une paire. Renvoie `null` si aucune (jamais un taux par défaut). */
export const latest = async ({ base, quote, at = null }) => {
  const from = normalize(base, 'base');
  const to = normalize(quote, 'quote');

  if (from === to) {
    return { base: from, quote: to, rate: 1, asOf: new Date().toISOString(), source: 'identity', ageHours: 0, stale: false };
  }

  const rate = await prisma.fxRate.findFirst({
    where: {
      base: from,
      quote: to,
      ...(at ? { asOf: { lte: new Date(at) } } : {}),
    },
    orderBy: { asOf: 'desc' },
  });

  return decorate(rate);
};

/** Endpoint de consultation : explicite quand aucune cotation n'existe. */
export const resolve = async (query) => {
  const rate = await latest(query);

  if (!rate) {
    const base = normalize(query.base, 'base');
    const quote = normalize(query.quote, 'quote');
    return {
      base,
      quote,
      rate: null,
      available: false,
      message:
        `Aucune cotation ${base}/${quote} enregistrée. Aucune conversion ne peut être produite : ` +
        'un taux doit être saisi avec sa date et sa source (GLB-03).',
    };
  }

  return { base: rate.base, quote: rate.quote, available: true, ...rate };
};

/** Liste des paires connues, avec leur dernière cotation. */
export const listPairs = async ({ base } = {}) => {
  const where = base ? { base: normalize(base, 'base') } : {};

  const rates = await prisma.fxRate.findMany({
    where,
    orderBy: [{ base: 'asc' }, { quote: 'asc' }, { asOf: 'desc' }],
    take: 500,
  });

  const lowest = new Map();
  for (const rate of rates) {
    const key = `${rate.base}/${rate.quote}`;
    if (!lowest.has(key)) lowest.set(key, rate); // tri décroissant sur asOf : 1re = la plus récente
  }

  return {
    pairs: [...lowest.values()].map(decorate),
    stalePairs: [...lowest.values()].filter((rate) => decorate(rate).stale).length,
    rule: 'Chaque paire porte sa date de cotation et sa source ; aucune interpolation entre deux dates.',
  };
};

/**
 * FX-01 / FX-02 / FX-03 — enregistrement d'une cotation (administration).
 *
 * Une cotation porte **toujours** une date et une source (FX-01), elle est
 * refusée si elle est future ou si le taux n'est pas strictement positif
 * (FX-02), et l'enregistrement est idempotent sur `(base, quote, asOf)` :
 * rejouer la même saisie met à jour la ligne existante au lieu de créer un
 * doublon (FX-03).
 */
export const record = async (payload, req) => {
  const base = normalize(payload.base, 'base');
  const quote = normalize(payload.quote, 'quote');

  if (base === quote) throw ApiError.badRequest('Une paire de devises doit être distincte');
  if (!(Number(payload.rate) > 0)) {
    throw ApiError.badRequest('Le taux doit être strictement positif', [{ field: 'rate', code: 'invalid' }]);
  }

  const asOf = new Date(payload.asOf);
  if (Number.isNaN(asOf.getTime())) {
    throw ApiError.badRequest('asOf requis (date de cotation, ISO 8601)', [{ field: 'asOf', code: 'invalid' }]);
  }
  if (asOf.getTime() > Date.now() + 3_600_000) {
    throw ApiError.badRequest('Une date de cotation ne peut pas être dans le futur', [
      { field: 'asOf', code: 'future' },
    ]);
  }

  const existing = await prisma.fxRate.findUnique({
    where: { base_quote_asOf: { base, quote, asOf } },
  });

  const rate = existing
    ? await prisma.fxRate.update({
        where: { id: existing.id },
        data: { rate: payload.rate, source: payload.source, sourceLabel: payload.sourceLabel ?? null },
      })
    : await prisma.fxRate.create({
        data: {
          id: resolveId(),
          base,
          quote,
          rate: payload.rate,
          asOf,
          source: payload.source,
          sourceLabel: payload.sourceLabel ?? null,
          createdBy: req.user.id,
        },
      });

  await audit({
    actorId: req.user.id,
    action: 'fx.record',
    resource: 'fx_rates',
    resourceId: rate.id,
    req,
    oldValue: existing ? { rate: existing.rate } : null,
    newValue: { base, quote, rate: payload.rate, asOf, source: payload.source },
  });

  return { rate: decorate(rate), replayed: Boolean(existing) };
};
