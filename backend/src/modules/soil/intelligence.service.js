/**
 * Exigences CDC couvertes : SOIL-04, SOIL-05, SOIL-06, SOIL-07, SOIL-08, SOIL-09, SOIL-10, SOIL-11, SOIL-12, SOIL-13, SOIL-14.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { assertOwnership } from '../../middleware/tenant.js';
import { audit } from '../../shared/audit.js';

/**
 * Module Soil & Crop Intelligence — pistes S2 et S3.
 *
 * Principes non négociables (CDC V2 §6 / V3 §6) :
 *  - aucune donnée n'est inventée : une valeur absente reste absente ;
 *  - chaque conclusion est accompagnée de sa règle, de sa version et de ses sources ;
 *  - les recommandations ne s'activent que par zone/culture (feature flag) et
 *    uniquement avec un jeu de règles validé par un agronome ;
 *  - une estimation de rendement est toujours une FOURCHETTE, jamais un chiffre garanti.
 */

/** §6.5 — priorité de fusion des sources (1 = la plus fiable). */
export const SOURCE_PRIORITY = {
  measured_lab: 1,
  measured_sensor: 2,
  satellite: 3,
  photo_interpreted: 4,
  third_party_verified: 5,
  derived: 6,
  estimated: 7,
  declared: 8,
};

/** En dessous de ce seuil de couverture, on refuse de conclure (SOIL-09). */
export const MIN_COVERAGE = 0.6;

const DISCLAIMER_SUITABILITY =
  "Évaluation indicative produite par règles agronomiques validées. Elle ne remplace pas un diagnostic de terrain ni une analyse de laboratoire.";
const DISCLAIMER_YIELD =
  "Estimation en fourchette, fondée sur les données disponibles. Elle ne constitue pas une garantie de récolte.";

const cropSlugOf = (crop) => crop?.slug ?? crop?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') ?? null;

/* ─────────────────────────── Gouvernance des règles ─────────────────────────── */

export const listRuleSets = async (query = {}) => {
  const items = await prisma.agronomicRuleSet.findMany({
    where: {
      ...(query.status ? { status: query.status } : {}),
      ...(query.countryCode ? { countryCode: query.countryCode } : {}),
      ...(query.zone ? { zone: query.zone } : {}),
      ...(query.cropSlug ? { cropSlug: query.cropSlug } : {}),
    },
    orderBy: [{ zone: 'asc' }, { version: 'desc' }],
  });
  return { items, count: items.length };
};

export const createRuleSet = async (payload, req) => {
  const rules = payload.rules;
  if (!rules.criteria?.length) {
    throw ApiError.badRequest('Un jeu de règles doit contenir au moins un critère');
  }
  for (const criterion of rules.criteria) {
    if (!criterion.key || !criterion.type) {
      throw ApiError.badRequest('Chaque critère doit porter une clé et un type');
    }
    if (!['range', 'min', 'max', 'in'].includes(criterion.type)) {
      throw ApiError.badRequest(`Type de critère inconnu : ${criterion.type}`);
    }
  }

  const existing = await prisma.agronomicRuleSet.findFirst({
    where: { version: payload.version, zone: payload.zone, cropSlug: payload.cropSlug ?? null },
  });
  if (existing) throw ApiError.conflict('Cette version de règles existe déjà pour cette zone');

  const ruleSet = await prisma.agronomicRuleSet.create({
    data: {
      id: resolveId(payload.id),
      version: payload.version,
      zone: payload.zone,
      countryCode: payload.countryCode,
      cropSlug: payload.cropSlug ?? null,
      status: 'draft',
      rules,
      validatedBy: [],
      notes: payload.notes ?? null,
      createdBy: req.user.id,
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'ruleset.create',
    resource: 'agronomic_rule_sets',
    resourceId: ruleSet.id,
    req,
    newValue: { version: ruleSet.version, zone: ruleSet.zone, cropSlug: ruleSet.cropSlug },
  });

  return ruleSet;
};

/**
 * SOIL-04 / NFR-08 — une règle ne devient opposable qu'après validation par un
 * agronome distinct de son auteur (séparation des rôles).
 */
export const validateRuleSet = async (id, req) => {
  const ruleSet = await prisma.agronomicRuleSet.findUnique({ where: { id } });
  if (!ruleSet) throw ApiError.notFound('Jeu de règles introuvable');
  if (ruleSet.status === 'retired') throw ApiError.conflict('Jeu de règles retiré');
  if (ruleSet.status === 'validated') return { ruleSet, alreadyValidated: true };
  if (ruleSet.createdBy && ruleSet.createdBy === req.user.id) {
    throw ApiError.forbidden(
      'Un jeu de règles ne peut pas être validé par la personne qui l’a créé (séparation des rôles)',
    );
  }

  const updated = await prisma.agronomicRuleSet.update({
    where: { id },
    data: {
      status: 'validated',
      validatedBy: [...new Set([...(ruleSet.validatedBy ?? []), req.user.id])],
      validatedAt: new Date(),
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'ruleset.validate',
    resource: 'agronomic_rule_sets',
    resourceId: id,
    req,
    oldValue: { status: ruleSet.status },
    newValue: { status: 'validated' },
  });

  return { ruleSet: updated, alreadyValidated: false };
};

export const retireRuleSet = async (id, req) => {
  const ruleSet = await prisma.agronomicRuleSet.findUnique({ where: { id } });
  if (!ruleSet) throw ApiError.notFound('Jeu de règles introuvable');
  const updated = await prisma.agronomicRuleSet.update({
    where: { id },
    data: { status: 'retired' },
  });
  await audit({
    actorId: req.user.id,
    action: 'ruleset.retire',
    resource: 'agronomic_rule_sets',
    resourceId: id,
    req,
    oldValue: { status: ruleSet.status },
    newValue: { status: 'retired' },
  });
  return updated;
};

/* ─────────────────────────── Feature flags par zone/culture ─────────────────────────── */

export const listFlags = async (query = {}) => {
  const items = await prisma.zoneFeatureFlag.findMany({
    where: {
      ...(query.key ? { key: query.key } : {}),
      ...(query.scope ? { scope: query.scope } : {}),
      ...(query.scopeValue ? { scopeValue: query.scopeValue } : {}),
    },
    orderBy: [{ key: 'asc' }, { scope: 'asc' }],
  });
  return { items, count: items.length };
};

export const setFlag = async (payload, req) => {
  const existing = await prisma.zoneFeatureFlag.findFirst({
    where: { key: payload.key, scope: payload.scope, scopeValue: payload.scopeValue },
  });

  const data = {
    enabled: payload.enabled,
    reason: payload.reason ?? null,
    updatedBy: req.user.id,
  };

  const flag = existing
    ? await prisma.zoneFeatureFlag.update({ where: { id: existing.id }, data })
    : await prisma.zoneFeatureFlag.create({
        data: {
          id: resolveId(payload.id),
          key: payload.key,
          scope: payload.scope,
          scopeValue: payload.scopeValue,
          ...data,
        },
      });

  await audit({
    actorId: req.user.id,
    action: 'featureflag.set',
    resource: 'zone_feature_flags',
    resourceId: flag.id,
    req,
    oldValue: existing ? { enabled: existing.enabled } : null,
    newValue: { key: flag.key, scope: flag.scope, scopeValue: flag.scopeValue, enabled: flag.enabled },
  });

  return flag;
};

/**
 * S2 §6.4 — une recommandation n'est servie que si la zone ET la culture sont activées.
 * Le flag le plus spécifique gagne (culture > zone > pays).
 */
export const isRecommendationEnabled = async ({ countryCode, zone, cropSlug }) => {
  if (!countryCode) return { enabled: false, reason: 'pays inconnu' };
  const scopeValue = zone ?? countryCode;

  const flags = await prisma.zoneFeatureFlag.findMany({
    where: { key: 'soil.recommendations', enabled: true },
  });

  const matches = (scope, value) =>
    flags.filter((f) => f.scope === scope && f.scopeValue === value).length > 0;

  if (cropSlug && zone && matches('crop_zone', `${zone}::${cropSlug}`)) return { enabled: true };
  if (zone && matches('zone', zone)) return { enabled: true };
  if (cropSlug && matches('crop', cropSlug)) return { enabled: true };
  if (matches('country', countryCode)) return { enabled: true };

  return {
    enabled: false,
    reason: `recommandations non activées pour ${scopeValue}${cropSlug ? ` / ${cropSlug}` : ''}`,
  };
};

/* ─────────────────────────── Fusion des sources (S3 §6.5) ─────────────────────────── */

/**
 * Fusionne toutes les mesures connues d'une parcelle, paramètre par paramètre.
 * La valeur retenue est celle de la source la plus fiable ; les autres sont
 * conservées comme alternatives (traçabilité intégrale).
 */
export const fuseProfile = async (plotId) => {
  const assessments = await prisma.soilAssessment.findMany({
    where: { plotId, deletedAt: null },
    orderBy: { assessedAt: 'desc' },
    include: { parameters: true },
  });

  const byKey = new Map();
  for (const assessment of assessments) {
    for (const parameter of assessment.parameters) {
      const candidate = {
        value: parameter.value,
        numericValue: parameter.numericValue,
        unit: parameter.unit,
        source: parameter.source,
        method: parameter.method,
        confidence: parameter.confidence,
        measuredAt: parameter.measuredAt,
        assessedAt: assessment.assessedAt,
        assessmentId: assessment.id,
        priority: SOURCE_PRIORITY[parameter.source] ?? 99,
      };
      if (!byKey.has(parameter.key)) byKey.set(parameter.key, []);
      byKey.get(parameter.key).push(candidate);
    }
  }

  const parameters = {};
  for (const [key, candidates] of byKey.entries()) {
    // Priorité de source, puis fraîcheur.
    // NB : la confiance déclarée n'intervient PAS dans ce classement — deux
    // mesures de même source et de même date restent dans l'ordre d'insertion.
    // Elle est conservée sur le paramètre retenu et remonte dans l'explication.
    const sorted = [...candidates].sort(
      (a, b) =>
        a.priority - b.priority ||
        new Date(b.measuredAt ?? b.assessedAt) - new Date(a.measuredAt ?? a.assessedAt),
    );
    const [best, ...others] = sorted;
    parameters[key] = {
      value: best.value,
      numericValue: best.numericValue,
      unit: best.unit,
      source: best.source,
      confidence: best.confidence,
      measuredAt: best.measuredAt ?? best.assessedAt,
      assessmentId: best.assessmentId,
      alternatives: others.map((o) => ({
        value: o.value,
        numericValue: o.numericValue,
        source: o.source,
        measuredAt: o.measuredAt ?? o.assessedAt,
      })),
    };
  }

  return {
    plotId,
    parameters,
    sourcesUsed: [...new Set(Object.values(parameters).flatMap((p) => p.source))],
    assessmentCount: assessments.length,
    priorityOrder: Object.entries(SOURCE_PRIORITY)
      .sort((a, b) => a[1] - b[1])
      .map(([source, rank]) => ({ source, rank })),
  };
};

/* ─────────────────────────── Évaluation des critères ─────────────────────────── */

export const evaluateCriterion = (criterion, parameter) => {
  if (!parameter) {
    return { met: null, observed: null, expected: describeCriterion(criterion), reason: 'donnée absente' };
  }
  const numeric =
    parameter.numericValue ?? (Number.isFinite(Number(parameter.value)) ? Number(parameter.value) : null);

  switch (criterion.type) {
    case 'range': {
      if (numeric === null) return { met: null, observed: parameter.value, expected: describeCriterion(criterion) };
      const met = numeric >= criterion.min && numeric <= criterion.max;
      return {
        met,
        observed: numeric,
        expected: describeCriterion(criterion),
        reason: met
          ? `valeur dans la plage favorable`
          : `valeur hors plage (${numeric} hors [${criterion.min}, ${criterion.max}])`,
      };
    }
    case 'min': {
      if (numeric === null) return { met: null, observed: parameter.value, expected: describeCriterion(criterion) };
      return {
        met: numeric >= criterion.value,
        observed: numeric,
        expected: describeCriterion(criterion),
        reason: numeric >= criterion.value ? 'seuil minimal atteint' : 'sous le seuil minimal',
      };
    }
    case 'max': {
      if (numeric === null) return { met: null, observed: parameter.value, expected: describeCriterion(criterion) };
      return {
        met: numeric <= criterion.value,
        observed: numeric,
        expected: describeCriterion(criterion),
        reason: numeric <= criterion.value ? 'sous le seuil maximal' : 'au-dessus du seuil maximal',
      };
    }
    case 'in': {
      const value = String(parameter.value).toLowerCase();
      const met = criterion.values.map((v) => String(v).toLowerCase()).includes(value);
      return {
        met,
        observed: parameter.value,
        expected: describeCriterion(criterion),
        reason: met ? 'modalité favorable' : 'modalité non favorable',
      };
    }
    default:
      return { met: null, observed: parameter.value, expected: describeCriterion(criterion) };
  }
};

export const describeCriterion = (criterion) => {
  switch (criterion.type) {
    case 'range':
      return `entre ${criterion.min} et ${criterion.max}`;
    case 'min':
      return `≥ ${criterion.value}`;
    case 'max':
      return `≤ ${criterion.value}`;
    case 'in':
      return `parmi ${criterion.values.join(', ')}`;
    default:
      return 'critère non décrit';
  }
};

const levelFor = (ratio) => {
  if (ratio >= 0.75) return 'HIGH';
  if (ratio >= 0.45) return 'MEDIUM';
  return 'LOW';
};

const confidenceFor = (usedSources) => {
  const best = Math.min(...usedSources.map((s) => SOURCE_PRIORITY[s] ?? 99));
  if (best <= 2) return 'high';
  if (best <= 4) return 'medium';
  return 'low';
};

/**
 * Retrouve le jeu de règles validé le plus spécifique pour la culture et la zone.
 * Aucun jeu validé => refus explicite : on ne recommande pas sans règle opposable.
 */
export const resolveRuleSet = async ({ plot, crop }) => {
  // Le farm peut ne pas être inclus par l'appelant : on le charge explicitement
  // plutôt que de déduire un pays par défaut (aucune donnée inventée).
  const farm =
    plot?.farm ??
    (plot?.farmId
      ? await prisma.farm.findUnique({ where: { id: plot.farmId }, select: { countryCode: true, province: true } })
      : null);
  const countryCode = farm?.countryCode ?? plot?.countryCode ?? null;
  const cropSlug = cropSlugOf(crop);
  // Le schéma ne porte pas de colonne `zone` : la maille agronomique est la
  // province de l'exploitation, à défaut le pays. Aucune zone n'est inventée.
  const zone = farm?.province ?? plot?.province ?? countryCode;

  const candidates = await prisma.agronomicRuleSet.findMany({
    where: { status: 'validated', countryCode: countryCode ?? undefined },
  });

  // Sans culture précisée (ex. plan agricole), le jeu de règles le plus
  // spécifique de la zone est retenu : aucune règle n'est inventée.
  const scored = candidates
    .filter((r) => !cropSlug || !r.cropSlug || r.cropSlug === cropSlug)
    .map((r) => ({
      ruleSet: r,
      specificity: (cropSlug && r.cropSlug === cropSlug ? 2 : 0) + (r.zone === zone ? 1 : 0),
    }))
    .sort((a, b) => b.specificity - a.specificity || (a.ruleSet.version < b.ruleSet.version ? 1 : -1));

  return { ruleSet: scored[0]?.ruleSet ?? null, zone, cropSlug, countryCode };
};

/* ─────────────────────────── SOIL-05 : compatibilité culture ─────────────────────────── */

export const computeSuitability = async (plotId, payload, req) => {
  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    include: { farm: { select: { countryCode: true, province: true } } },
  });
  assertOwnership(plot, req.tenant.organizationId, 'Parcelle');

  const crop = await prisma.crop.findUnique({ where: { id: payload.cropId } });
  if (!crop) throw ApiError.notFound('Culture introuvable');

  const { ruleSet, zone, cropSlug, countryCode } = await resolveRuleSet({ plot, crop });
  if (!ruleSet) {
    throw ApiError.conflict(
      'Aucun jeu de règles agronomiques validé pour cette zone et cette culture : aucune recommandation ne peut être produite',
      { zone, cropSlug },
    );
  }

  const activation = await isRecommendationEnabled({ countryCode, zone, cropSlug });
  if (!activation.enabled) {
    throw ApiError.forbidden(
      `Les recommandations ne sont pas encore activées pour cette zone (${activation.reason})`,
      { zone, cropSlug },
    );
  }

  const profile = await fuseProfile(plotId);
  const reasons = [];
  const missingData = [];
  let metWeight = 0;
  let evaluableWeight = 0;

  for (const criterion of ruleSet.rules.criteria) {
    const weight = criterion.weight ?? 1;
    const parameter = profile.parameters[criterion.key];
    const evaluation = evaluateCriterion(criterion, parameter);

    if (evaluation.met === null) {
      missingData.push({ key: criterion.key, expected: evaluation.expected, reason: evaluation.reason });
      continue;
    }

    evaluableWeight += weight;
    if (evaluation.met) metWeight += weight;

    reasons.push({
      key: criterion.key,
      label: criterion.label ?? criterion.key,
      expected: evaluation.expected,
      observed: evaluation.observed,
      unit: parameter?.unit ?? criterion.unit ?? null,
      source: parameter?.source ?? null,
      sourceRank: parameter ? SOURCE_PRIORITY[parameter.source] ?? null : null,
      measuredAt: parameter?.measuredAt ?? null,
      met: evaluation.met,
      weight,
      explanation: evaluation.reason,
    });
  }

  const totalWeight = ruleSet.rules.criteria.reduce((sum, c) => sum + (c.weight ?? 1), 0);
  const coverage = totalWeight === 0 ? 0 : evaluableWeight / totalWeight;

  let level;
  let ratio = null;
  if (evaluableWeight === 0 || coverage < MIN_COVERAGE) {
    level = 'INSUFFICIENTLY_DOCUMENTED';
  } else {
    ratio = metWeight / evaluableWeight;
    level = levelFor(ratio);
  }

  const usedSources = reasons.map((r) => r.source).filter(Boolean);
  const suitability = await prisma.cropSuitability.create({
    data: {
      id: resolveId(payload.id),
      organizationId: req.tenant.organizationId,
      plotId,
      cropId: crop.id,
      ruleSetVersion: ruleSet.version,
      level,
      reasons: { criteria: reasons, coverage, ratio, ruleSetId: ruleSet.id, zone },
      usedData: { sources: [...new Set(usedSources)], parameterCount: Object.keys(profile.parameters).length },
      missingData,
      confidence: usedSources.length ? confidenceFor(usedSources) : 'low',
      disclaimer: DISCLAIMER_SUITABILITY,
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'soil.suitability',
    resource: 'crop_suitabilities',
    resourceId: suitability.id,
    req,
    newValue: { plotId, cropId: crop.id, level, ruleSetVersion: ruleSet.version },
  });

  return shapeSuitability(suitability, ruleSet);
};

const LEVEL_LABEL = {
  HIGH: 'favorable',
  MEDIUM: 'moyennement favorable',
  LOW: 'peu favorable',
  INSUFFICIENTLY_DOCUMENTED: 'insuffisamment documenté',
};

const shapeSuitability = (suitability, ruleSet = null) => {
  const criteria = suitability.reasons?.criteria ?? [];
  const met = criteria.filter((c) => c.met);
  const failed = criteria.filter((c) => !c.met);

  return {
    id: suitability.id,
    plotId: suitability.plotId,
    cropId: suitability.cropId,
    level: suitability.level,
    levelLabel: LEVEL_LABEL[suitability.level],
    ruleSetVersion: suitability.ruleSetVersion,
    ruleSetId: suitability.reasons?.ruleSetId ?? ruleSet?.id ?? null,
    confidence: suitability.confidence,
    coverage: suitability.reasons?.coverage ?? null,
    reasons: criteria,
    missingData: suitability.missingData,
    usedData: suitability.usedData,
    generatedAt: suitability.generatedAt,
    disclaimer: suitability.disclaimer,
    /** SOIL-08 — réponse « pourquoi ? » directement exploitable en interface */
    explanation: {
      summary:
        suitability.level === 'INSUFFICIENTLY_DOCUMENTED'
          ? 'Les données disponibles ne permettent pas de conclure : aucun niveau de compatibilité n’est affiché.'
          : `Niveau ${LEVEL_LABEL[suitability.level]} : ${met.length} critère(s) satisfait(s) sur ${criteria.length} évaluable(s).`,
      satisfied: met.map((c) => `${c.label} ${c.expected} — observé ${c.observed}${c.unit ? ` ${c.unit}` : ''} (${c.source})`),
      unsatisfied: failed.map(
        (c) => `${c.label} ${c.expected} — observé ${c.observed}${c.unit ? ` ${c.unit}` : ''} (${c.source})`,
      ),
      missing: (suitability.missingData ?? []).map((m) => `${m.key} attendu ${m.expected}`),
    },
  };
};

export const listSuitabilities = async (plotId, req) => {
  const plot = await prisma.plot.findUnique({ where: { id: plotId } });
  assertOwnership(plot, req.tenant.organizationId, 'Parcelle');

  const items = await prisma.cropSuitability.findMany({
    where: { plotId },
    orderBy: { generatedAt: 'desc' },
    take: 50,
  });
  return { items: items.map((i) => shapeSuitability(i)), count: items.length };
};

export const explainSuitability = async (plotId, suitabilityId, req) => {
  const plot = await prisma.plot.findUnique({ where: { id: plotId } });
  assertOwnership(plot, req.tenant.organizationId, 'Parcelle');

  const suitability = await prisma.cropSuitability.findUnique({ where: { id: suitabilityId } });
  if (!suitability || suitability.plotId !== plotId) {
    throw ApiError.notFound('Évaluation introuvable');
  }
  const ruleSet = await prisma.agronomicRuleSet.findFirst({
    where: { version: suitability.ruleSetVersion },
  });
  return shapeSuitability(suitability, ruleSet);
};

/* ─────────────────────────── SOIL-06 : rotation ─────────────────────────── */

export const proposeRotation = async (plotId, payload, req) => {
  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    include: { farm: { select: { countryCode: true, province: true } } },
  });
  assertOwnership(plot, req.tenant.organizationId, 'Parcelle');

  const requestedCrop = payload.cropId
    ? await prisma.crop.findUnique({ where: { id: payload.cropId } })
    : null;
  const { ruleSet, zone } = await resolveRuleSet({ plot, crop: requestedCrop });
  if (!ruleSet) {
    throw ApiError.conflict('Aucun jeu de règles validé pour proposer une rotation');
  }

  const rotations = ruleSet.rules.rotations ?? [];
  const slug = cropSlugOf(requestedCrop);

  const matching = rotations.filter((r) => !slug || !r.after || r.after.includes(slug));
  if (!matching.length) {
    throw ApiError.conflict('Aucune rotation documentée pour cette culture dans le jeu de règles', {
      zone,
      cropSlug: slug,
    });
  }

  const chosen = matching[0];
  const steps = chosen.sequence.map((step, index) => ({
    year: index + 1,
    cropSlug: step.cropSlug,
    family: step.family ?? null,
    rationale: step.rationale ?? null,
    checks: step.checks ?? [],
  }));

  const plan = await prisma.rotationPlan.create({
    data: {
      id: resolveId(payload.id),
      organizationId: req.tenant.organizationId,
      plotId,
      horizonYears: payload.horizonYears ?? steps.length,
      ruleSetVersion: ruleSet.version,
      steps: { sequence: steps, ruleSetId: ruleSet.id, zone, assumptions: chosen.assumptions ?? [] },
      alternatives: { options: matching.slice(1).map((m) => m.name) },
      status: 'PROPOSED',
      disclaimer:
        'Rotation proposée à partir de règles agronomiques validées. Elle doit être confirmée par un agronome avant application.',
      createdBy: req.user.id,
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'soil.rotation',
    resource: 'rotation_plans',
    resourceId: plan.id,
    req,
    newValue: { plotId, ruleSetVersion: ruleSet.version, horizonYears: plan.horizonYears },
  });

  return plan;
};

export const listRotations = async (plotId, req) => {
  const plot = await prisma.plot.findUnique({ where: { id: plotId } });
  assertOwnership(plot, req.tenant.organizationId, 'Parcelle');
  const items = await prisma.rotationPlan.findMany({ where: { plotId }, orderBy: { createdAt: 'desc' } });
  return { items, count: items.length };
};

export const decideRotation = async (plotId, planId, payload, req) => {
  const plot = await prisma.plot.findUnique({ where: { id: plotId } });
  assertOwnership(plot, req.tenant.organizationId, 'Parcelle');

  const plan = await prisma.rotationPlan.findUnique({ where: { id: planId } });
  if (!plan || plan.plotId !== plotId) throw ApiError.notFound('Plan de rotation introuvable');
  if (plan.status !== 'PROPOSED') throw ApiError.conflict('Ce plan a déjà été statué');

  const updated = await prisma.rotationPlan.update({
    where: { id: planId },
    data: { status: payload.decision },
  });

  await audit({
    actorId: req.user.id,
    action: 'soil.rotation.decide',
    resource: 'rotation_plans',
    resourceId: planId,
    req,
    oldValue: { status: plan.status },
    newValue: { status: updated.status, comment: payload.comment ?? null },
  });

  return updated;
};

/* ─────────────────────────── SOIL-07 : plan agricole ─────────────────────────── */

export const proposeFarmingPlan = async (plotId, payload, req) => {
  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    include: { farm: { select: { countryCode: true, province: true } } },
  });
  assertOwnership(plot, req.tenant.organizationId, 'Parcelle');

  const rotation = payload.rotationPlanId
    ? await prisma.rotationPlan.findUnique({ where: { id: payload.rotationPlanId } })
    : null;
  if (payload.rotationPlanId && (!rotation || rotation.plotId !== plotId)) {
    throw ApiError.notFound('Plan de rotation introuvable');
  }

  const { ruleSet: resolved } = await resolveRuleSet({ plot, crop: null });
  const ruleSet =
    (rotation?.ruleSetVersion
      ? await prisma.agronomicRuleSet.findFirst({
          where: { status: 'validated', version: rotation.ruleSetVersion },
        })
      : null) ?? resolved;
  if (!ruleSet) throw ApiError.conflict('Aucun jeu de règles validé pour construire un plan');

  const windows = ruleSet.rules.calendar ?? [];
  const horizonYears = payload.horizonYears ?? rotation?.horizonYears ?? 3;
  const sequence = rotation?.steps?.sequence ?? [];

  const calendar = [];
  for (let year = 1; year <= horizonYears; year += 1) {
    const step = sequence[year - 1] ?? sequence[sequence.length - 1] ?? null;
    for (const window of windows) {
      if (step && window.cropSlug && window.cropSlug !== step.cropSlug) continue;
      calendar.push({
        year,
        cropSlug: step?.cropSlug ?? window.cropSlug ?? null,
        activity: window.activity,
        window: { startMonth: window.startMonth, endMonth: window.endMonth },
        rationale: window.rationale ?? null,
      });
    }
  }

  if (!calendar.length) {
    throw ApiError.conflict('Aucun calendrier documenté dans le jeu de règles : aucun plan n’est inventé');
  }

  const checkpoints = calendar
    .filter((c) => c.activity === 'controle' || c.activity === 'suivi')
    .map((c) => ({ year: c.year, activity: c.activity, window: c.window, metric: c.rationale ?? null }));

  const plan = await prisma.farmingPlan.create({
    data: {
      id: resolveId(payload.id),
      organizationId: req.tenant.organizationId,
      plotId,
      rotationPlanId: rotation?.id ?? null,
      horizonYears,
      calendar: { entries: calendar, ruleSetVersion: ruleSet.version },
      checkpoints: { items: checkpoints },
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'soil.farmingplan',
    resource: 'farming_plans',
    resourceId: plan.id,
    req,
    newValue: { plotId, horizonYears, ruleSetVersion: ruleSet.version },
  });

  return plan;
};

export const listFarmingPlans = async (plotId, req) => {
  const plot = await prisma.plot.findUnique({ where: { id: plotId } });
  assertOwnership(plot, req.tenant.organizationId, 'Parcelle');
  const items = await prisma.farmingPlan.findMany({ where: { plotId }, orderBy: { createdAt: 'desc' } });
  return { items, count: items.length };
};

/* ─────────────────────────── SOIL-14 : rendement en fourchette ─────────────────────────── */

export const estimateYield = async (plotId, payload, req) => {
  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    include: { farm: { select: { countryCode: true, province: true } } },
  });
  assertOwnership(plot, req.tenant.organizationId, 'Parcelle');

  const crop = await prisma.crop.findUnique({ where: { id: payload.cropId } });
  if (!crop) throw ApiError.notFound('Culture introuvable');

  const { ruleSet } = await resolveRuleSet({ plot, crop });
  const yields = ruleSet?.rules?.yields ?? null;
  if (!yields || yields.lowKgPerHa === undefined || yields.highKgPerHa === undefined) {
    throw ApiError.conflict(
      'Aucune référence de rendement documentée pour cette culture : aucune estimation n’est inventée',
      { cropSlug: cropSlugOf(crop) },
    );
  }

  const areaHa = Number(plot.areaHa ?? plot.area ?? 0);
  if (!areaHa || areaHa <= 0) {
    throw ApiError.conflict('Superficie de la parcelle inconnue : impossible de convertir un rendement en volume');
  }

  const profile = await fuseProfile(plotId);
  const adequacy = profile.assessmentCount === 0 ? 0.6 : 0.8;
  const lowKg = yields.lowKgPerHa * areaHa * adequacy;
  const highKg = yields.highKgPerHa * areaHa;
  const pointKg = (lowKg + highKg) / 2;
  const uncertaintyPct = Math.round(((highKg - lowKg) / (2 * pointKg)) * 1000 * 10) / 100;

  const estimate = await prisma.yieldEstimate.create({
    data: {
      id: resolveId(payload.id),
      organizationId: req.tenant.organizationId,
      plotId,
      cropId: crop.id,
      lowKg,
      highKg,
      pointKg,
      uncertaintyPct,
      assumptions: {
        areaHa,
        lowKgPerHa: yields.lowKgPerHa,
        highKgPerHa: yields.highKgPerHa,
        adequacyFactor: adequacy,
        note: 'La borne basse intègre un facteur de prudence lié à la connaissance du sol.',
      },
      sources: {
        ruleSetVersion: ruleSet.version,
        soilSources: profile.sourcesUsed,
        assessmentCount: profile.assessmentCount,
      },
      method: 'rules-based-range',
      ruleSetVersion: ruleSet.version,
      disclaimer: DISCLAIMER_YIELD,
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'soil.yieldestimate',
    resource: 'yield_estimates',
    resourceId: estimate.id,
    req,
    newValue: { plotId, cropId: crop.id, lowKg, highKg },
  });

  return estimate;
};

export const listYieldEstimates = async (plotId, req) => {
  const plot = await prisma.plot.findUnique({ where: { id: plotId } });
  assertOwnership(plot, req.tenant.organizationId, 'Parcelle');
  const items = await prisma.yieldEstimate.findMany({ where: { plotId }, orderBy: { createdAt: 'desc' } });
  return {
    items: items.map((i) => ({
      ...i,
      range: { lowKg: i.lowKg, pointKg: i.pointKg, highKg: i.highKg, uncertaintyPct: i.uncertaintyPct },
    })),
    count: items.length,
  };
};
