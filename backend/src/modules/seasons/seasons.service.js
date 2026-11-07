/**
 * Retours de saison — le rendement réellement obtenu, et son rapprochement
 * avec la recommandation qui l'a précédé.
 *
 * ## La règle qui gouverne ce fichier
 *
 * Le score d'une recommandation mesure une **adéquation** entre un sol et une
 * culture. Ce n'est pas une prédiction de rendement. Donc un rendement faible
 * sur une culture bien classée **n'invalide pas** la recommandation, et un
 * rendement élevé sur une culture mal classée ne la valide pas : la pluie, les
 * ravageurs, la date de semis réelle, la main-d'œuvre et les pertes
 * post-récolte ne sont mesurés nulle part dans cette base.
 *
 * Tout rapprochement produit ici porte donc les deux valeurs **côte à côte,
 * sans verdict**. Aucun champ « la recommandation avait raison », aucun
 * pourcentage de réussite : ce serait affirmer une causalité que les données
 * ne portent pas.
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { paginationArgs, orderBy } from '../../shared/pagination.js';
import { assertOwnership } from '../../middleware/tenant.js';
import { audit } from '../../shared/audit.js';
import { yieldPerHectare } from './seasons.schema.js';

/** Relations utiles à l'affichage, jamais la totalité des tables liées. */
const INCLUDES = {
  crop: { select: { id: true, slug: true, names: true } },
  plot: { select: { id: true, name: true } },
  recommendation: {
    select: { id: true, periodStart: true, periodEnd: true, status: true, ruleSetVersion: true },
  },
};

/** Projection renvoyée à l'écran : le rendement par hectare est calculé, pas stocké. */
const toSeasonFeedback = (row) => {
  if (!row) return null;
  return {
    ...row,
    yieldPerHa: yieldPerHectare(row.actualYieldKg, row.areaHa),
  };
};

const assertPlot = async (plotId, organizationId) => {
  const plot = await prisma.plot.findUnique({ where: { id: plotId } });
  return assertOwnership(plot, organizationId, 'Parcelle');
};

const assertCrop = async (cropId) => {
  const crop = await prisma.crop.findFirst({ where: { OR: [{ id: cropId }, { slug: cropId }] } });
  if (!crop) throw ApiError.notFound('Culture introuvable');
  return crop;
};

/**
 * La recommandation doit appartenir à la même organisation **et** à la même
 * parcelle. Sans le second contrôle, un retour pourrait être rattaché à la
 * recommandation d'une autre parcelle et fausser tout rapprochement ultérieur.
 */
const assertRecommendation = async (recommendationId, { organizationId, plotId }) => {
  const recommendation = await prisma.cropRecommendation.findUnique({
    where: { id: recommendationId },
  });
  assertOwnership(recommendation, organizationId, 'Recommandation');
  if (recommendation.plotId !== plotId) {
    throw ApiError.badRequest(
      'Cette recommandation porte sur une autre parcelle : le rapprochement serait faux',
    );
  }
  return recommendation;
};

const buildWhere = (query, organizationId) => {
  const { plotId, cropId, season, year, withRecommendation, from, to } = query;
  return {
    organizationId,
    deletedAt: null,
    ...(plotId ? { plotId } : {}),
    ...(cropId ? { cropId } : {}),
    ...(season ? { season } : {}),
    ...(year ? { year } : {}),
    ...(withRecommendation === undefined
      ? {}
      : { recommendationId: withRecommendation ? { not: null } : null }),
    ...(from || to
      ? { periodEnd: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
  };
};

export const list = async (query, req) => {
  const where = buildWhere(query, req.tenant.organizationId);
  const [items, total] = await Promise.all([
    prisma.seasonFeedback.findMany({
      where,
      ...paginationArgs(query),
      orderBy: orderBy(query.sort, query.order, ['periodEnd', 'createdAt']),
      include: INCLUDES,
    }),
    prisma.seasonFeedback.count({ where }),
  ]);
  return {
    items: items.map(toSeasonFeedback),
    total,
    page: Number(query.page ?? 1),
    limit: Number(query.limit ?? 20),
  };
};

export const getOne = async (id, req) => {
  const row = await prisma.seasonFeedback.findUnique({
    where: { id },
    include: INCLUDES,
  });
  assertOwnership(row, req.tenant.organizationId, 'Retour de saison');
  return toSeasonFeedback(row);
};

/**
 * Enregistre un rendement réellement obtenu.
 *
 * La source par défaut est `declared` : c'est l'agriculteur qui le dit. Aucune
 * valeur n'est calculée, estimée ni complétée — un champ absent reste absent.
 */
export const create = async (payload, req) => {
  const organizationId = req.tenant.organizationId;

  await assertPlot(payload.plotId, organizationId);
  const crop = await assertCrop(payload.cropId);
  if (payload.recommendationId) {
    await assertRecommendation(payload.recommendationId, {
      organizationId,
      plotId: payload.plotId,
    });
  }

  const created = await prisma.seasonFeedback.create({
    data: {
      id: resolveId(payload.id),
      organizationId,
      plotId: payload.plotId,
      cropId: crop.id,
      recommendationId: payload.recommendationId ?? null,
      season: payload.season,
      year: payload.year,
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      actualYieldKg: payload.actualYieldKg,
      areaHa: payload.areaHa ?? null,
      unit: payload.unit ?? null,
      observations: payload.observations ?? null,
      source: payload.source ?? 'declared',
      createdBy: req.user.id,
    },
    include: INCLUDES,
  });

  await audit({
    actorId: req.user.id,
    action: 'seasons.feedback.created',
    resource: 'season_feedback',
    resourceId: created.id,
    req,
  });

  return toSeasonFeedback(created);
};

/**
 * Corrige un rendement déclaré.
 *
 * `version` est incrémentée à chaque modification : un rendement qui change
 * après coup doit rester repérable, parce que les statistiques calculées avant
 * la correction ne correspondent plus à rien.
 */
export const update = async (id, payload, req) => {
  const organizationId = req.tenant.organizationId;
  const existing = await prisma.seasonFeedback.findUnique({ where: { id } });
  assertOwnership(existing, organizationId, 'Retour de saison');

  if (payload.plotId) await assertPlot(payload.plotId, organizationId);
  const cropId = payload.cropId ? (await assertCrop(payload.cropId)).id : undefined;
  const plotId = payload.plotId ?? existing.plotId;
  if (payload.recommendationId) {
    await assertRecommendation(payload.recommendationId, { organizationId, plotId });
  }

  // Les bornes de période peuvent être modifiées séparément : la cohérence est
  // revérifiée sur l'état **résultant**, pas sur le seul champ fourni.
  const periodStart = payload.periodStart ?? existing.periodStart;
  const periodEnd = payload.periodEnd ?? existing.periodEnd;
  if (periodEnd <= periodStart) {
    throw ApiError.badRequest('La fin de période doit suivre son début');
  }

  const actualYieldKg = payload.actualYieldKg ?? existing.actualYieldKg;
  const areaHa = payload.areaHa === undefined ? existing.areaHa : payload.areaHa;
  const perHa = yieldPerHectare(actualYieldKg, areaHa);
  if (perHa !== null && perHa > 100000) {
    throw ApiError.badRequest(
      'Rendement par hectare au-dessus de 100000 kg/ha : vérifiez la surface ou l\'unité',
    );
  }

  const updated = await prisma.seasonFeedback.update({
    where: { id },
    data: {
      ...payload,
      ...(cropId ? { cropId } : {}),
      periodStart,
      periodEnd,
      actualYieldKg,
      areaHa: areaHa ?? null,
      version: { increment: 1 },
    },
    include: INCLUDES,
  });

  await audit({
    actorId: req.user.id,
    action: 'seasons.feedback.updated',
    resource: 'season_feedback',
    resourceId: id,
    req,
  });

  return toSeasonFeedback(updated);
};

/** Archivage logique : la vérité déclarée ne se supprime pas. */
export const archive = async (id, req) => {
  const existing = await prisma.seasonFeedback.findUnique({ where: { id } });
  assertOwnership(existing, req.tenant.organizationId, 'Retour de saison');
  await prisma.seasonFeedback.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await audit({
    actorId: req.user.id,
    action: 'seasons.feedback.archived',
    resource: 'season_feedback',
    resourceId: id,
    req,
  });
};

/**
 * Rapprochement entre une recommandation et le rendement obtenu.
 *
 * **Aucun verdict n'est produit.** Les deux grandeurs sont renvoyées côte à
 * côte, avec le rappel explicite que le score mesure une adéquation. Un écran
 * qui afficherait « la recommandation s'est trompée » mentirait : il attribuerait
 * au classement du sol des effets qui viennent du climat, des ravageurs ou de la
 * récolte.
 */
export const compareWithRecommendation = async (id, req) => {
  const row = await prisma.seasonFeedback.findUnique({ where: { id } });
  assertOwnership(row, req.tenant.organizationId, 'Retour de saison');

  if (!row.recommendationId) {
    return {
      comparable: false,
      reason: 'Aucune recommandation rattachée à ce retour de saison',
      seasonFeedback: toSeasonFeedback(row),
      recommendation: null,
      scoreNote:
        'Le score d’une recommandation mesure l’adéquation d’un sol à une culture, '
        + 'pas un rendement attendu. Ce rapprochement ne permet donc ni de valider '
        + 'ni d’invalider la recommandation.',
    };
  }

  const recommendation = await prisma.cropRecommendation.findUnique({
    where: { id: row.recommendationId },
  });
  if (!recommendation) {
    return {
      comparable: false,
      reason: 'La recommandation rattachée a été supprimée',
      seasonFeedback: toSeasonFeedback(row),
      recommendation: null,
      scoreNote: null,
    };
  }

  const scores = Array.isArray(recommendation.scores) ? recommendation.scores : [];
  const entry = scores.find((item) => item?.cropId === row.cropId) ?? null;

  return {
    comparable: true,
    seasonFeedback: toSeasonFeedback(row),
    recommendation: {
      id: recommendation.id,
      periodStart: recommendation.periodStart,
      periodEnd: recommendation.periodEnd,
      status: recommendation.status,
      ruleSetVersion: recommendation.ruleSetVersion,
      /** Rang et score de **cette** culture dans le classement d'alors. */
      cultureRank: entry
        ? {
            cropId: entry.cropId,
            score: entry.score ?? null,
            rank: scores.findIndex((item) => item?.cropId === row.cropId) + 1,
            eliminated: Boolean(entry.eliminated),
          }
        : null,
      /** Nombre de cultures classées : sans ça, un rang ne veut rien dire. */
      culturesClassified: scores.length,
    },
    scoreNote:
      'Le score d’une recommandation mesure l’adéquation d’un sol à une culture, '
      + 'pas un rendement attendu. Un rendement faible sur une culture bien classée '
      + 'peut venir du climat, des ravageurs ou de la récolte, qui ne sont pas '
      + 'mesurés ici. Ce rapprochement est informatif, pas un verdict.',
  };
};

/**
 * Rendements agrégés, par culture, parcelle, saison ou année.
 *
 * Les moyennes sont calculées **sur les retours qui portent une surface**. Sans
 * surface, un rendement à l'hectare n'existe pas : l'inventer en divisant par une
 * valeur par défaut produirait un chiffre faux mais plausible, exactement le
 * travers que ce module doit éviter. Les retours sans surface sont comptés à
 * part et affichés, pas intégrés en silence.
 */
export const stats = async (query, req) => {
  const where = buildWhere(query, req.tenant.organizationId);
  const rows = await prisma.seasonFeedback.findMany({
    where,
    select: {
      cropId: true,
      plotId: true,
      season: true,
      year: true,
      actualYieldKg: true,
      areaHa: true,
      crop: { select: { slug: true } },
      plot: { select: { name: true } },
    },
  });

  const keyOf = (row) => {
    switch (query.groupBy) {
      case 'plot':
        return row.plotId;
      case 'season':
        return row.season;
      case 'year':
        return String(row.year);
      default:
        return row.cropId;
    }
  };

  const groups = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label:
          query.groupBy === 'plot'
            ? row.plot?.name ?? key
            : query.groupBy === 'crop'
              ? row.crop?.slug ?? key
              : key,
        feedbackCount: 0,
        totalYieldKg: 0,
        totalAreaHa: 0,
        /** Retours sans surface : exclus de la moyenne, jamais devinés. */
        withoutArea: 0,
        /**
         * Kilos portés par ces retours sans surface. Comptés à part : ils sont
         * réels, mais ils n'entrent pas dans `totalYieldKg` parce qu'aucune
         * surface ne leur correspond. Les additionner au numérateur sans pouvoir
         * rien ajouter au dénominateur gonflerait le rendement à l'hectare.
         */
        yieldKgWithoutArea: 0,
      });
    }
    const group = groups.get(key);
    group.feedbackCount += 1;
    if (row.areaHa && row.areaHa > 0) {
      group.totalYieldKg += row.actualYieldKg;
      group.totalAreaHa += row.areaHa;
    } else {
      group.withoutArea += 1;
      group.yieldKgWithoutArea += row.actualYieldKg;
    }
  }

  const groupsOut = [...groups.values()].map((group) => ({
    ...group,
    /** null quand aucune surface n'est connue : pas de moyenne inventée. */
    yieldPerHa: group.totalAreaHa > 0
      ? Math.round((group.totalYieldKg / group.totalAreaHa) * 100) / 100
      : null,
    totalYieldKg: Math.round(group.totalYieldKg * 100) / 100,
    totalAreaHa: Math.round(group.totalAreaHa * 100) / 100,
    yieldKgWithoutArea: Math.round(group.yieldKgWithoutArea * 100) / 100,
  }));

  groupsOut.sort((a, b) => (b.yieldPerHa ?? -1) - (a.yieldPerHa ?? -1));

  return {
    groupBy: query.groupBy,
    groups: groupsOut,
    feedbackCount: rows.length,
    /**
     * Couverture du retour d'expérience. Sans ce nombre, une moyenne calculée
     * sur deux parcelles se lirait comme une vérité générale.
     */
    withoutAreaCount: rows.filter((row) => !row.areaHa || row.areaHa <= 0).length,
    /**
     * Kilos totaux portés par les retours sans surface. Séparés de
     * `totalYieldKg` : réels, mais exclus de tout rendement à l'hectare.
     */
    yieldKgWithoutArea:
      Math.round(
        rows
          .filter((row) => !row.areaHa || row.areaHa <= 0)
          .reduce((total, row) => total + row.actualYieldKg, 0) * 100,
      ) / 100,
  };
};
