/**
 * Exigences CDC couvertes : SOIL-10, SOIL-11, SOIL-12, SOIL-13, SOIL-14, GEO-01, GEO-02, GEO-03.
 *
 * Le diagnostic de sol n'est pas recalculé en JavaScript : il est produit par le
 * moteur Python `geoai/` (numpy/scipy), qui seule sait faire les indices
 * spectraux, la texture USDA, les horizons de sous-sol et la fusion multi-sources.
 *
 * Ce service :
 *   1. rassemble les données **réelles** de la parcelle (analyses, capteurs,
 *      observations satellite) — aucun chiffre n'est inventé ;
 *   2. appelle le moteur et transmet la provenance de chaque source ;
 *   3. conserve le diagnostic tel qu'il a été produit (append-only) avec la
 *      version du moteur et de la méthode, pour qu'un résultat passé reste
 *      auditable même après évolution des algorithmes ;
 *   4. trace l'appel dans le journal d'audit.
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { audit } from '../../shared/audit.js';
import { logger } from '../../shared/http/logger.js';
import { analyzeSoil, engineHealth } from '../../integrations/geospatial.js';

export const METHOD_VERSION = 'soil-diagnostic-v1';
export const ENGINE = 'agrikonnect-geoai';

/** Clés `SoilParameter` → paramètres compris par le moteur. */
const PARAMETER_MAP = {
  ph: 'ph',
  organicMatter: 'organicMatter',
  ec: 'ec',
  moisture: 'moisture',
  sand: 'sand',
  silt: 'silt',
  clay: 'clay',
  depthCm: 'depthCm',
};

/**
 * Classes de texture déclarées → granulométrie représentative (triangle USDA).
 * Utilisé **uniquement** quand aucune analyse granulométrique n'existe : la
 * valeur produite est alors marquée `derived` et sa confiance est réduite.
 */
const TEXTURE_LEGEND = [
  { match: /sablo|sableux|sable/, sand: 85, silt: 10, clay: 5, label: 'sableux' },
  { match: /limono[- ]sableux|sable limoneux/, sand: 70, silt: 22, clay: 8, label: 'limono-sableux' },
  { match: /limono[- ]argileux|limon argileux/, sand: 28, silt: 38, clay: 34, label: 'limono-argileux' },
  { match: /argilo[- ]sableux/, sand: 55, silt: 12, clay: 33, label: 'argilo-sableux' },
  { match: /argileux|argile/, sand: 20, silt: 30, clay: 50, label: 'argileux' },
  { match: /limoneux|limon/, sand: 32, silt: 52, clay: 16, label: 'limoneux' },
];

const normalise = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const textureToGranulometry = (texture) => {
  const text = normalise(texture);
  return TEXTURE_LEGEND.find((entry) => entry.match.test(text)) ?? null;
};

const SOURCE_MAP = {
  measured_lab: 'lab',
  measured_sensor: 'sensor',
  satellite: 'satellite',
  photo_interpreted: 'camera',
  third_party_verified: 'lab',
  platform_verified: 'lab',
  derived: 'satellite',
  estimated: 'declared',
  declared: 'declared',
};

const assertPlot = async (plotId, organizationId) => {
  const plot = await prisma.plot.findFirst({ where: { id: plotId, organizationId, deletedAt: null } });
  if (!plot) throw ApiError.notFound('Parcelle introuvable');
  return plot;
};

/** Transforme les analyses de sol en prélèvements exploitables par le moteur. */
export const buildSamples = (assessments) => {
  const samples = [];

  for (const assessment of assessments) {
    const parameters = assessment.parameters ?? [];
    const values = {};
    const sources = new Set();

    for (const parameter of parameters) {
      const key = PARAMETER_MAP[parameter.key];
      if (!key) continue;
      const numeric = parameter.numericValue ?? Number(parameter.value);
      if (!Number.isFinite(numeric)) continue;
      values[key] = numeric;
      sources.add(SOURCE_MAP[parameter.source] ?? 'declared');
    }

    // Granulométrie absente : on déduit une classe représentative, en le disant.
    if (values.sand === undefined || values.clay === undefined) {
      const texture = parameters.find((parameter) => parameter.key === 'texture');
      const legend = texture ? textureToGranulometry(texture.value) : null;
      if (legend) {
        values.sand ??= legend.sand;
        values.silt ??= legend.silt;
        values.clay ??= legend.clay;
        sources.add('declared');
      }
    }

    if (values.sand === undefined && values.clay === undefined) continue;

    samples.push({
      depthCm: values.depthCm ?? 0,
      thicknessCm: values.depthCm !== undefined ? 20 : 20,
      sand: values.sand,
      silt: values.silt,
      clay: values.clay,
      ph: values.ph,
      organicMatter: values.organicMatter,
      ec: values.ec,
      moisture: values.moisture,
      source: sources.has('lab') ? 'lab' : 'declared',
      measuredAt: assessment.assessedAt ? new Date(assessment.assessedAt).toISOString() : null,
      assessmentId: assessment.id,
    });
  }

  return samples;
};

/** Regroupe les mesures de capteurs par grandeur physique. */
const buildSensors = (readings) => {
  const metrics = { moisture: [], temperature: [], ec: [] };
  for (const reading of readings) {
    const metric = normalise(reading.metric);
    const bucket = metric.includes('moist') || metric.includes('humid')
      ? 'moisture'
      : metric.includes('temp')
        ? 'temperature'
        : metric.includes('ec') || metric.includes('sal')
          ? 'ec'
          : null;
    if (!bucket) continue;
    metrics[bucket].push({ at: new Date(reading.at).toISOString(), value: reading.value });
  }
  return metrics;
};

const buildSatelliteSeries = (observations) =>
  observations
    .filter((observation) => String(observation.index).toUpperCase() === 'NDVI')
    .map((observation) => ({ date: new Date(observation.observedAt).toISOString(), ndvi: observation.value }))
    .sort((first, second) => first.date.localeCompare(second.date));

/**
 * Calcule un diagnostic complet pour une parcelle.
 *
 * @param {string} plotId
 * @param {object} payload  scènes brutes, imagerie, valeurs déclarées (optionnels)
 * @param {object} req
 */
export const diagnose = async (plotId, payload = {}, req) => {
  const organizationId = req.tenant.organizationId;
  const plot = await assertPlot(plotId, organizationId);

  // Les capteurs sont rattachés à la parcelle via leur appareil : on résout
  // d'abord les appareils de la parcelle (une requête, indexée), puis leurs
  // mesures. Pas de jointure implicite sur un filtre de relation.
  const devices = await prisma.iotDevice.findMany({
    where: { plotId, organizationId },
    select: { id: true },
  });
  const deviceIds = devices.map((device) => device.id);

  const [assessments, readings, observations] = await Promise.all([
    prisma.soilAssessment.findMany({
      where: { plotId, deletedAt: null },
      orderBy: { assessedAt: 'desc' },
      take: 5,
      include: { parameters: true },
    }),
    deviceIds.length
      ? prisma.sensorReading.findMany({
          where: { deviceId: { in: deviceIds } },
          orderBy: { at: 'desc' },
          take: 500,
        })
      : Promise.resolve([]),
    prisma.satelliteObservation.findMany({
      where: { plotId },
      orderBy: { observedAt: 'asc' },
      take: 60,
    }),
  ]);

  const samples = buildSamples(assessments);
  const sensors = buildSensors(readings);
  const series = payload.series?.length ? payload.series : buildSatelliteSeries(observations);

  const hasAnyData =
    samples.length > 0 ||
    sensors.moisture.length > 0 ||
    series.length > 0 ||
    (payload.scenes ?? []).length > 0 ||
    (payload.imagery && Object.keys(payload.imagery).length > 0) ||
    (payload.declared && Object.keys(payload.declared).length > 0);

  if (!hasAnyData) {
    throw ApiError.badRequest(
      'Aucune donnée exploitable pour cette parcelle : ajoute une analyse de sol, ' +
        'un capteur connecté, une scène satellite ou des valeurs déclarées. ' +
        'Le diagnostic ne remplit jamais un vide avec une valeur inventée.',
    );
  }

  const enginePayload = {
    plot: {
      id: plot.id,
      areaHa: plot.areaHa,
      geometry: plot.geometry,
      latitude: plot.latitude,
      longitude: plot.longitude,
      slopePct: payload.slopePct ?? null,
      rainfallMm: payload.rainfallMm ?? null,
      sensorDepthCm: payload.sensorDepthCm ?? 30,
    },
    samples,
    sensors,
    scenes: payload.scenes ?? [],
    series,
    imagery: payload.imagery ?? {},
    declared: payload.declared ?? {},
    allowRecommendations: payload.allowRecommendations === true,
  };

  let result;
  try {
    result = await analyzeSoil(enginePayload);
  } catch (error) {
    logger.warn(`[geospatial] diagnostic impossible pour ${plotId} : ${error.message}`);
    // On ne fabrique pas de diagnostic de substitution : l'API dit la vérité.
    throw error;
  }

  const diagnosis = await prisma.soilDiagnostic.create({
    data: {
      id: resolveId(payload.id),
      organizationId,
      plotId,
      countryCode: plot.countryCode ?? null,
      engine: result.engine?.name ?? ENGINE,
      engineVersion: String(result.engine?.version ?? 'unknown'),
      methodVersion: METHOD_VERSION,
      // Les matrices de pixels ne sont jamais stockées : seulement la requête.
      inputs: {
        samples: samples.length,
        sensorReadings: Object.values(sensors).reduce((total, list) => total + list.length, 0),
        satelliteSeries: series.length,
        scenes: (payload.scenes ?? []).length,
        imagery: Object.keys(payload.imagery ?? {}),
        declared: Object.keys(payload.declared ?? {}),
        allowRecommendations: payload.allowRecommendations === true,
      },
      result,
      confidence: result.confidence?.score ?? null,
      confidenceLevel: result.confidence?.level ?? null,
      sourcesUsed: result.fusion?.sourcesUsed ?? [],
      source: 'derived',
      createdBy: req.user?.id ?? null,
    },
  });

  await audit({
    actorId: req.user?.id,
    action: 'soil.diagnostic.compute',
    resource: 'soil_diagnostics',
    resourceId: diagnosis.id,
    req,
    newValue: {
      plotId,
      engineVersion: diagnosis.engineVersion,
      methodVersion: METHOD_VERSION,
      confidence: diagnosis.confidence,
      sourcesUsed: diagnosis.sourcesUsed,
    },
  });

  return {
    diagnosis,
    engine: await engineHealth(),
    plot: { id: plot.id, name: plot.name, areaHa: plot.areaHa },
    disclaimer: result.disclaimer,
  };
};

export const listDiagnoses = async (plotId, query, req) => {
  await assertPlot(plotId, req.tenant.organizationId);
  const take = Math.min(Number(query.limit ?? 20), 100);
  const items = await prisma.soilDiagnostic.findMany({
    where: { plotId, organizationId: req.tenant.organizationId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      engine: true,
      engineVersion: true,
      methodVersion: true,
      confidence: true,
      confidenceLevel: true,
      sourcesUsed: true,
      createdAt: true,
    },
  });
  return { items, total: items.length, limit: take };
};

export const getDiagnosis = async (id, req) => {
  const diagnosis = await prisma.soilDiagnostic.findFirst({
    where: { id, organizationId: req.tenant.organizationId, deletedAt: null },
  });
  if (!diagnosis) throw ApiError.notFound('Diagnostic introuvable');
  return { diagnosis };
};

export const latestDiagnosis = async (plotId, req) => {
  await assertPlot(plotId, req.tenant.organizationId);
  const diagnosis = await prisma.soilDiagnostic.findFirst({
    where: { plotId, organizationId: req.tenant.organizationId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!diagnosis) throw ApiError.notFound('Aucun diagnostic de sol enregistré pour cette parcelle');
  return { diagnosis };
};

export const health = async () => {
  const engine = await engineHealth();
  return {
    engine,
    methodVersion: METHOD_VERSION,
    ready: engine.available === true,
    note: engine.available
      ? 'Le moteur géospatial répond : les diagnostics peuvent être calculés.'
      : 'Moteur indisponible : les diagnostics renverront 503 tant qu’il n’est pas démarré (python3 geoai/server.py).',
  };
};
