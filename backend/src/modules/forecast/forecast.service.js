/**
 * Prévision des paramètres du sol — CDC phase 7 et §16.
 *
 * Trois règles non négociables, appliquées ici :
 *
 *  1. **Pas de prévision sans données réelles suffisantes.** La série envoyée
 *     au moteur ne contient que des mesures réelles (`mode ≠ SIMULATED`). Si le
 *     moteur répond `sufficient: false`, **rien n'est persisté** : on renvoie le
 *     motif, pas une valeur. Une prévision absente est préférable à une
 *     prévision inventée.
 *  2. **La persistance est la référence.** Le moteur évalue la méthode sur un
 *     découpage chronologique et rend `beatsBaseline`. Cette valeur est
 *     persistée telle quelle : c'est elle, et non une impression, qui autorise
 *     le job d'alertes à émettre une alerte préventive.
 *  3. **Chaque résultat porte ses sources.** La liste des provenances des
 *     mesures ayant alimenté la série accompagne la réponse.
 *
 * Le calcul scientifique vit en Python (`geoai/forecast.py`). Node reste seul
 * propriétaire des données, de l'isolation multi-tenant et de la persistance.
 */
import { prisma } from '../../config/prisma.js';
import { excludedReadingIds } from '../anomalies/anomalies.service.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { audit } from '../../shared/audit.js';
import { forecastSoil, forecastBacktest } from '../../integrations/geospatial.js';
import { SOIL_PARAMETER_KEYS } from '../soil/soil.schema.js';

/** Paramètres pour lesquels une prévision a du sens. */
export const FORECASTABLE_PARAMETERS = Object.freeze([
  ...SOIL_PARAMETER_KEYS.filter((key) => key !== 'texture'),
  /**
   * La température de l'air n'est pas un paramètre d'analyse de sol, mais c'est
   * une métrique de station météo suivie par le moteur de recommandation : la
   * prévoir est utile et cohérent avec les plages agronomiques.
   */
  'airTemperatureC',
]);

/** Nombre maximal de mesures envoyées au moteur par série. */
export const MAX_SERIES_POINTS = 5_000;

/**
 * Construit la série réelle d'un paramètre sur une parcelle.
 *
 * Les mesures simulées sont exclues : une prévision fondée sur des valeurs
 * générées serait présentée à l'agriculteur comme une anticipation du réel.
 */
export const buildSeries = async (plotId, parameter, { depthCm = null, limit = MAX_SERIES_POINTS } = {}) => {
  // Une valeur aberrante fausserait la pente ajustée : elle est écartée de la
  // série tant qu'un agronome ne l'a pas réhabilitée.
  const excludedReadings = await excludedReadingIds(plotId);
  const readings = await prisma.sensorReading.findMany({
    where: {
      plotId,
      metric: parameter,
      mode: { not: 'SIMULATED' },
      ...(depthCm === null ? {} : { depthCm }),
      ...(excludedReadings.length > 0 ? { id: { notIn: excludedReadings } } : {}),
    },
    orderBy: { at: 'asc' },
    take: limit,
  });

  return {
    series: readings.map((reading) => ({ at: reading.at, value: reading.value })),
    sources: [...new Set(readings.map((reading) => reading.source ?? 'measured_sensor'))],
    modes: [...new Set(readings.map((reading) => reading.mode ?? 'REAL'))],
    depthCm: depthCm ?? (readings[0]?.depthCm ?? null),
    oldestAt: readings[0]?.at ?? null,
    newestAt: readings.at(-1)?.at ?? null,
    count: readings.length,
  };
};

/** Le modèle de prévision en production, s'il existe, pour tracer la version. */
const productionModelVersion = async (organizationId) =>
  prisma.aiModelVersion.findFirst({
    where: {
      kind: 'FORECAST',
      status: 'PRODUCTION',
      OR: [{ organizationId }, { organizationId: null }],
    },
    orderBy: { promotedAt: 'desc' },
  });

const findPlot = async (plotId, req) => {
  const plot = await prisma.plot.findFirst({
    where: { id: plotId, organizationId: req.tenant.organizationId, deletedAt: null },
  });
  // 404 et non 403 : ne pas révéler l'existence d'une parcelle d'un autre tenant.
  if (!plot) throw ApiError.notFound('Parcelle introuvable');
  return plot;
};

const assertForecastable = (parameter) => {
  if (!FORECASTABLE_PARAMETERS.includes(parameter)) {
    throw ApiError.badRequest(
      `Paramètre « ${parameter} » non prévirable. Grandeurs acceptées : ${FORECASTABLE_PARAMETERS.join(', ')}.`
    );
  }
};

/**
 * Calcule et persiste une prévision pour une parcelle et un paramètre.
 *
 * @returns l'enregistrement `SoilPrediction`, ou un objet `{ sufficient: false, reason }`
 *          quand les données réelles ne permettent pas de prévoir.
 */
export const forecastForPlot = async (plotId, parameter, payload = {}, req) => {
  assertForecastable(parameter);
  const plot = await findPlot(plotId, req);
  const organizationId = plot.organizationId;

  const { series, sources, modes, depthCm, oldestAt, newestAt, count } = await buildSeries(
    plotId,
    parameter,
    { depthCm: payload.depthCm ?? null },
  );

  const horizonDays = Number(payload.horizonDays ?? 14);
  const engineResult = await forecastSoil({
    parameter,
    series,
    horizonDays,
    stepDays: Number(payload.stepDays ?? 1),
    now: payload.now ?? new Date(),
  });

  /**
   * Données insuffisantes : on ne persiste **rien**. Créer une ligne vide
   * laisserait croire qu'une prévision existe alors qu'aucune n'a été produite.
   */
  if (!engineResult.sufficient) {
    return {
      sufficient: false,
      reason: engineResult.reason,
      parameter,
      plotId,
      observationCount: count,
      seriesSpan: { oldestAt, newestAt },
      sources,
      // Rappel explicite : aucune valeur de substitution n'est fournie.
      values: [],
    };
  }

  const evaluation = engineResult.evaluation ?? {};
  const modelVersion = await productionModelVersion(organizationId);
  const simulated = modes.includes('SIMULATED');

  const prediction = await prisma.soilPrediction.create({
    data: {
      id: `prd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      organizationId,
      plotId,
      parameter,
      depthCm: depthCm ?? null,
      horizonDays: Math.round(engineResult.horizonDays ?? horizonDays),
      values: engineResult.values,
      mae: evaluation.model?.mae ?? null,
      rmse: evaluation.model?.rmse ?? null,
      baselineMae: evaluation.baseline?.mae ?? null,
      /**
       * Copie fidèle du verdict du moteur. Le job d'alertes refuse toute
       * prévision dont ce drapeau n'est pas explicitement vrai.
       */
      beatsBaseline: evaluation.beatsBaseline ?? false,
      modelVersionId: modelVersion?.id ?? null,
      mode: simulated ? 'SIMULATED' : 'REAL',
    },
  });

  await audit({
    actorId: req.user?.id ?? null,
    action: 'soilPrediction.create',
    resource: 'SoilPrediction',
    resourceId: prediction.id,
    req,
    newValue: {
      plotId,
      parameter,
      horizonDays: prediction.horizonDays,
      beatsBaseline: prediction.beatsBaseline,
      mae: prediction.mae,
      baselineMae: prediction.baselineMae,
      observationCount: count,
      sources,
    },
  });

  return {
    sufficient: true,
    prediction,
    parameter,
    plotId,
    observationCount: count,
    rejectedPoints: engineResult.rejectedPoints ?? 0,
    seriesSpan: { oldestAt, newestAt },
    sources,
    method: engineResult.method,
    baselineMethod: engineResult.baselineMethod,
    evaluation,
    values: engineResult.values,
    modelVersionId: prediction.modelVersionId,
    /** Le moteur dit si sa méthode bat la persistance ; on ne le reformule pas. */
    beatsBaseline: prediction.beatsBaseline,
  };
};

/** Évaluation sans prévision : sert à décider de la promotion d'un modèle. */
export const backtestForPlot = async (plotId, parameter, payload = {}, req) => {
  assertForecastable(parameter);
  await findPlot(plotId, req);

  const { series, sources, count, oldestAt, newestAt } = await buildSeries(plotId, parameter, {
    depthCm: payload.depthCm ?? null,
  });

  const result = await forecastBacktest({
    parameter,
    series,
    horizonDays: Number(payload.horizonDays ?? 14),
    stepDays: Number(payload.stepDays ?? 1),
    now: payload.now ?? new Date(),
  });

  return {
    ...result,
    plotId,
    observationCount: count,
    seriesSpan: { oldestAt, newestAt },
    sources,
  };
};

/** Prévisions enregistrées d'une parcelle, les plus récentes d'abord. */
export const listPredictions = async (plotId, query, req) => {
  await findPlot(plotId, req);

  const where = {
    plotId,
    organizationId: req.tenant.organizationId,
    ...(query.parameter ? { parameter: query.parameter } : {}),
  };
  const items = await prisma.soilPrediction.findMany({
    where,
    orderBy: { computedAt: 'desc' },
    take: Math.min(Number(query.limit ?? 20), 100),
  });

  return {
    plotId,
    items,
    /**
     * Seules les prévisions qui battent la persistance sont exploitables. Le
     * reste est conservé pour l'historique, pas pour la décision.
     */
    usable: items.filter((item) => item.beatsBaseline === true),
  };
};
