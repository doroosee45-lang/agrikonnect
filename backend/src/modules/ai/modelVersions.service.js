/**
 * Versionnage des modèles — CDC : « un modèle appris n'entre en production que
 * s'il bat le moteur à règles sur les données de test ».
 *
 * Le point central : **`beatsBaseline` n'est jamais fourni par l'appelant.**
 * Il est calculé ici, à partir des métriques du modèle et de celles du moteur à
 * règles sur le *même* découpage. Un appelant ne peut donc pas déclarer un
 * modèle meilleur qu'il ne l'est.
 *
 * Conséquence directe : la promotion en `PRODUCTION` est refusée tant que cette
 * comparaison n'est pas favorable. Un modèle en `TESTING` peut être inspecté,
 * jamais servir.
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { audit } from '../../shared/audit.js';

/**
 * Métrique de décision par famille de modèles, et son sens.
 *
 * Explicite plutôt qu'implicite : comparer un F1 à un MAE n'a pas de sens, et
 * choisir la métrique au moment de la promotion serait choisir son vainqueur.
 */
export const METRIC_RULES = Object.freeze({
  FORECAST: { metric: 'mae', better: 'lower' },
  INTERPOLATION: { metric: 'mae', better: 'lower' },
  GPR: { metric: 'mae', better: 'lower' },
  ANOMALY: { metric: 'f1', better: 'higher' },
  RECOMMENDATION: { metric: 'precisionAtK', better: 'higher' },
  ZONES: { metric: 'silhouette', better: 'higher' },
});

export const MODEL_KINDS = Object.freeze(Object.keys(METRIC_RULES));

/**
 * Compare un modèle au moteur à règles.
 *
 * @returns {{beatsBaseline: boolean|null, metric: string, better: string,
 *            modelValue: number|null, baselineValue: number|null, margin: number|null}}
 *          `beatsBaseline` vaut `null` quand la comparaison est impossible :
 *          absence de métriques, ou référence non mesurée. On ne présume alors
 *          rien — ni victoire, ni défaite.
 */
export const compareAgainstBaseline = (kind, metrics, baselineMetrics) => {
  const rule = METRIC_RULES[kind];
  if (!rule) {
    return { beatsBaseline: null, metric: null, better: null, modelValue: null, baselineValue: null, margin: null };
  }

  const modelValue = Number(metrics?.[rule.metric]);
  const baselineValue = Number(baselineMetrics?.[rule.metric]);
  const comparable =
    Number.isFinite(modelValue) && Number.isFinite(baselineValue) && baselineValue !== null;

  if (!comparable) {
    return {
      beatsBaseline: null,
      metric: rule.metric,
      better: rule.better,
      modelValue: Number.isFinite(modelValue) ? modelValue : null,
      baselineValue: Number.isFinite(baselineValue) ? baselineValue : null,
      margin: null,
    };
  }

  /**
   * Strictement meilleur. À égalité, la méthode apprise n'apporte rien et ne
   * justifie pas sa complexité : elle ne doit pas être promue.
   */
  const beats = rule.better === 'lower' ? modelValue < baselineValue : modelValue > baselineValue;

  return {
    beatsBaseline: beats,
    metric: rule.metric,
    better: rule.better,
    modelValue,
    baselineValue,
    margin: Number(Math.abs(baselineValue - modelValue).toFixed(6)),
  };
};

const findVersion = async (id, req) => {
  const version = await prisma.aiModelVersion.findFirst({
    where: {
      id,
      OR: [{ organizationId: req.tenant.organizationId }, { organizationId: null }],
    },
  });
  // 404 et non 403 : ne pas révéler l'existence d'un modèle d'un autre tenant.
  if (!version) throw ApiError.notFound('Version de modèle introuvable');
  return version;
};

/** Enregistre une version en `TESTING`, avec la comparaison déjà tranchée. */
export const register = async (payload, req) => {
  const {
    name,
    version,
    kind,
    datasetDescription,
    metrics,
    baselineMetrics,
    artifactKey = null,
    trainedAt = null,
    shared = false,
  } = payload;

  const comparison = compareAgainstBaseline(kind, metrics, baselineMetrics);

  const created = await prisma.aiModelVersion.create({
    data: {
      id: `aim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      // `shared` permet un modèle commun à toutes les organisations (référentiel) ;
      // sinon le modèle appartient au tenant qui l'a entraîné.
      organizationId: shared ? null : req.tenant.organizationId,
      name,
      kind,
      version,
      trainedAt: trainedAt ? new Date(trainedAt) : null,
      datasetDescription,
      metrics,
      baselineMetrics: baselineMetrics ?? null,
      beatsBaseline: comparison.beatsBaseline,
      // Toujours TESTING à l'enregistrement : la promotion est un acte distinct.
      status: 'TESTING',
      artifactKey,
      trainedBy: req.user?.id ?? null,
    },
  });

  await audit({
    actorId: req.user?.id ?? null,
    action: 'aiModelVersion.register',
    resource: 'AiModelVersion',
    resourceId: created.id,
    req,
    newValue: {
      name,
      version,
      kind,
      status: 'TESTING',
      beatsBaseline: comparison.beatsBaseline,
      comparison,
    },
  });

  return { ...created, comparison };
};

/**
 * Promeut une version en `PRODUCTION`.
 *
 * Refusée si la comparaison n'est pas **explicitement** favorable — y compris
 * quand elle est impossible (`null`) : l'absence de preuve n'est pas une preuve.
 */
export const promote = async (id, req) => {
  const version = await findVersion(id, req);

  if (version.status === 'PRODUCTION') return version;

  const comparison = compareAgainstBaseline(version.kind, version.metrics, version.baselineMetrics);

  if (comparison.beatsBaseline !== true) {
    throw ApiError.conflict(
      comparison.beatsBaseline === null
        ? `Promotion refusée : la comparaison au moteur à règles est impossible pour ${version.kind} `
          + `(métrique « ${comparison.metric} » absente du modèle ou de la référence). `
          + 'Aucun modèle n’entre en production sans preuve.'
        : `Promotion refusée : ${version.name} ${version.version} ne bat pas le moteur à règles `
          + `(${comparison.metric} ${comparison.modelValue} contre ${comparison.baselineValue}, `
          + `${comparison.better === 'lower' ? 'plus bas' : 'plus haut'} attendu).`,
      { comparison },
    );
  }

  const promoted = await prisma.$transaction(async (tx) => {
    // Une seule version en production par famille et par périmètre.
    await tx.aiModelVersion.updateMany({
      where: {
        kind: version.kind,
        status: 'PRODUCTION',
        organizationId: version.organizationId,
        id: { not: version.id },
      },
      data: { status: 'RETIRED' },
    });
    return tx.aiModelVersion.update({
      where: { id: version.id },
      data: { status: 'PRODUCTION', promotedBy: req.user?.id ?? null, promotedAt: new Date() },
    });
  });

  await audit({
    actorId: req.user?.id ?? null,
    action: 'aiModelVersion.promote',
    resource: 'AiModelVersion',
    resourceId: version.id,
    req,
    oldValue: { status: version.status },
    newValue: { status: 'PRODUCTION', comparison },
  });

  return { ...promoted, comparison };
};

/** Retire une version du service. L'historique et les métriques sont conservés. */
export const retire = async (id, req) => {
  const version = await findVersion(id, req);
  if (version.status === 'RETIRED') return version;

  const updated = await prisma.aiModelVersion.update({
    where: { id },
    data: { status: 'RETIRED' },
  });

  await audit({
    actorId: req.user?.id ?? null,
    action: 'aiModelVersion.retire',
    resource: 'AiModelVersion',
    resourceId: id,
    req,
    oldValue: { status: version.status },
    newValue: { status: 'RETIRED' },
  });

  return updated;
};

export const list = async (query, req) => {
  const where = {
    OR: [{ organizationId: req.tenant.organizationId }, { organizationId: null }],
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const items = await prisma.aiModelVersion.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(query.limit ?? 50), 200),
  });
  return { items, count: items.length };
};

export const getOne = async (id, req) => findVersion(id, req);
