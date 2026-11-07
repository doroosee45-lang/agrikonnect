/**
 * Cartes interpolées des paramètres du sol — CDC phase 6.
 *
 * À partir d'au moins trois sondes géolocalisées, produire une carte **avec son
 * incertitude**, signaler toute valeur aberrante **avec son motif**, et rendre
 * chaque nombre nécessaire à l'explication.
 *
 * Trois règles, dans l'ordre :
 *
 *  1. **Pas de carte sans support spatial réel.** Le krigeage vit en Python
 *     (`geoai/interpolation.py`) et refuse en dessous de ses seuils. Node ne
 *     persiste alors **rien** : une carte absente vaut mieux qu'une carte
 *     inventée.
 *  2. **Une sonde n'est pas une série.** Un capteur remonte des centaines de
 *     mesures dans le temps ; une carte se construit sur un échantillon spatial.
 *     On retient la mesure la plus récente de chaque sonde — retenir la plus
 *     ancienne, ou toutes, fausserait la carte.
 *  3. **Une profondeur par carte.** Un pH à 10 cm et un pH à 60 cm ne décrivent
 *     pas le même horizon. Sans profondeur demandée, on retient la profondeur la
 *     plus représentée et on déclare ce qui a été écarté.
 */
import { prisma } from '../../config/prisma.js';
import { excludedReadingIds } from '../anomalies/anomalies.service.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { audit } from '../../shared/audit.js';
import { interpolateGrid, interpolationLoo } from '../../integrations/geospatial.js';
import { SOIL_PARAMETER_KEYS } from '../soil/soil.schema.js';

/** Paramètres pour lesquels une carte a un sens : grandeurs numériques. */
export const INTERPOLABLE_PARAMETERS = Object.freeze(
  SOIL_PARAMETER_KEYS.filter((key) => key !== 'texture'),
);

/** Nombre maximal de mesures lues avant sélection de la plus récente par sonde. */
export const MAX_READINGS_SCANNED = 5_000;

const findPlot = async (plotId, req) => {
  const plot = await prisma.plot.findFirst({
    where: { id: plotId, organizationId: req.tenant.organizationId, deletedAt: null },
  });
  // 404 et non 403 : ne pas révéler l'existence d'une parcelle d'un autre tenant.
  if (!plot) throw ApiError.notFound('Parcelle introuvable');
  return plot;
};

const assertInterpolable = (parameter) => {
  if (!INTERPOLABLE_PARAMETERS.includes(parameter)) {
    throw ApiError.badRequest(
      `Paramètre « ${parameter} » non interpolable. Grandeurs acceptées : `
      + `${INTERPOLABLE_PARAMETERS.join(', ')}.`,
    );
  }
};

/**
 * Retient la mesure la plus récente de chaque sonde géolocalisée.
 *
 * @returns points exploitables, plus tout ce qui a été écarté **et pourquoi**.
 */
export const buildInterpolationPoints = async (plotId, parameter, { depthCm = null } = {}) => {
  // Une mesure aberrante produirait un trou ou une bosse artificielle sur la
  // carte : elle est écartée tant qu'un agronome ne l'a pas réhabilitée.
  const excludedReadings = await excludedReadingIds(plotId);
  const readings = await prisma.sensorReading.findMany({
    where: {
      plotId,
      metric: parameter,
      mode: { not: 'SIMULATED' },
      position: { not: null },
      ...(depthCm === null ? {} : { depthCm }),
      ...(excludedReadings.length > 0 ? { id: { notIn: excludedReadings } } : {}),
    },
    orderBy: { at: 'desc' },
    take: MAX_READINGS_SCANNED,
  });

  // Sans profondeur demandée, on retient celle qui domine : mélanger deux
  // horizons dans une même carte n'a pas de sens agronomique.
  let effectiveDepthCm = depthCm;
  let excludedForDepth = 0;
  if (depthCm === null && readings.length > 0) {
    const counts = new Map();
    for (const reading of readings) {
      const key = reading.depthCm ?? 'surface';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const [dominant] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    effectiveDepthCm = dominant[0] === 'surface' ? null : dominant[0];
    excludedForDepth = readings.filter((reading) => (reading.depthCm ?? null) !== effectiveDepthCm).length;
  }

  const selected = readings.filter((reading) => (reading.depthCm ?? null) === effectiveDepthCm);

  /**
   * Une mesure par sonde : la plus récente. `readings` est trié par date
   * décroissante, donc la première occurrence d'un appareil est la bonne.
   */
  const latestByDevice = new Map();
  for (const reading of selected) {
    if (!latestByDevice.has(reading.deviceId)) latestByDevice.set(reading.deviceId, reading);
  }

  const points = [...latestByDevice.values()].map((reading) => ({
    id: reading.deviceId,
    coordinates: reading.position?.coordinates ?? null,
    value: reading.value,
    source: reading.source ?? 'measured_sensor',
    measuredAt: reading.at,
  }));

  return {
    points,
    depthCm: effectiveDepthCm,
    depthsSeen: [...new Set(readings.map((reading) => reading.depthCm ?? null))],
    readingsScanned: readings.length,
    /** Sondes sans mesure à la profondeur retenue, et mesures plus anciennes. */
    seriesReadingsDropped: selected.length - points.length,
    excludedForDepth,
    sources: [...new Set(points.map((point) => point.source))],
    oldestAt: selected.at(-1)?.at ?? null,
    newestAt: selected[0]?.at ?? null,
  };
};

/** Le modèle d'interpolation en production, s'il existe, pour tracer la version. */
const productionModelVersion = async (organizationId) =>
  prisma.aiModelVersion.findFirst({
    where: {
      kind: 'INTERPOLATION',
      status: 'PRODUCTION',
      OR: [{ organizationId }, { organizationId: null }],
    },
    orderBy: { promotedAt: 'desc' },
  });

/**
 * Calcule et persiste une carte interpolée.
 *
 * @returns l'enregistrement `InterpolatedMap`, ou `{ sufficient: false, reason }`
 *          quand les sondes sont trop peu nombreuses ou trop peu dispersées.
 */
export const interpolateForPlot = async (plotId, parameter, payload = {}, req) => {
  assertInterpolable(parameter);
  const plot = await findPlot(plotId, req);
  const organizationId = plot.organizationId;

  const selection = await buildInterpolationPoints(plotId, parameter, {
    depthCm: payload.depthCm ?? null,
  });

  const engineResult = await interpolateGrid({
    parameter,
    points: selection.points,
    resolutionM: payload.resolutionM,
    bbox: payload.bbox,
  });

  /**
   * Données insuffisantes : rien n'est persisté. Créer une ligne vide
   * laisserait croire qu'une carte existe alors qu'aucune n'a été produite.
   */
  if (!engineResult.sufficient) {
    return {
      sufficient: false,
      reason: engineResult.reason,
      parameter,
      plotId,
      sondesUsed: selection.points.length,
      depthCm: selection.depthCm,
      sources: selection.sources,
      grid: null,
      outliers: [],
    };
  }

  const crossValidation = engineResult.crossValidation ?? {};
  const grid = engineResult.grid ?? {};
  const modelVersion = await productionModelVersion(organizationId);

  const map = await prisma.interpolatedMap.create({
    data: {
      id: `imap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      organizationId,
      plotId,
      parameter,
      depthCm: selection.depthCm,
      method: engineResult.method,
      gridSize: grid.cellCount ?? 0,
      /**
       * La grille porte son incertitude cellule par cellule : une carte dont
       * l'incertitude serait résumée à un seul nombre global masquerait les
       * zones réellement mal couvertes.
       */
      values: {
        bbox: grid.bbox,
        columns: grid.columns,
        rows: grid.rows,
        resolutionM: grid.resolutionM,
        cells: grid.cells,
      },
      uncertainty: {
        method: engineResult.uncertainty,
        sdMin: grid.sdMin ?? null,
        sdMax: grid.sdMax ?? null,
        clampedCells: grid.clampedCells ?? 0,
        unsolvedCells: grid.unsolvedCells ?? 0,
        crossValidation: {
          method: crossValidation.method ?? null,
          n: crossValidation.n ?? null,
          mae: crossValidation.mae ?? null,
          rmse: crossValidation.rmse ?? null,
          meanError: crossValidation.meanError ?? null,
        },
      },
      sondesUsed: engineResult.diagnostics?.locationCount ?? selection.points.length,
      leaveOneOutMae: crossValidation.mae ?? null,
      /** Chaque aberration avec son motif chiffré : résidu, incertitude, seuil. */
      outliers: engineResult.outliers ?? [],
      diagnostics: {
        ...(engineResult.diagnostics ?? {}),
        // Provenance côté Node, absente du moteur qui ne connaît pas la base.
        ingestion: {
          readingsScanned: selection.readingsScanned,
          seriesReadingsDropped: selection.seriesReadingsDropped,
          excludedForDepth: selection.excludedForDepth,
          depthsSeen: selection.depthsSeen,
          oldestAt: selection.oldestAt,
          newestAt: selection.newestAt,
        },
      },
      modelVersionId: modelVersion?.id ?? null,
      mode: 'REAL',
    },
  });

  await audit({
    actorId: req.user?.id ?? null,
    action: 'interpolatedMap.create',
    resource: 'InterpolatedMap',
    resourceId: map.id,
    req,
    newValue: {
      plotId,
      parameter,
      method: map.method,
      gridSize: map.gridSize,
      sondesUsed: map.sondesUsed,
      leaveOneOutMae: map.leaveOneOutMae,
      outliers: (engineResult.outliers ?? []).map((outlier) => outlier.id),
    },
  });

  return {
    sufficient: true,
    map,
    parameter,
    plotId,
    depthCm: selection.depthCm,
    sondesUsed: map.sondesUsed,
    sources: engineResult.sources ?? selection.sources,
    grid: engineResult.grid,
    crossValidation: engineResult.crossValidation,
    outliers: engineResult.outliers ?? [],
    diagnostics: engineResult.diagnostics,
    observed: engineResult.observed,
  };
};

/** Validation croisée seule : qualifie la méthode sans produire de carte. */
export const evaluateForPlot = async (plotId, parameter, payload = {}, req) => {
  assertInterpolable(parameter);
  await findPlot(plotId, req);

  const selection = await buildInterpolationPoints(plotId, parameter, {
    depthCm: payload.depthCm ?? null,
  });

  const result = await interpolationLoo({
    parameter,
    points: selection.points,
  });

  return {
    ...result,
    plotId,
    depthCm: selection.depthCm,
    sondesUsed: selection.points.length,
    sources: selection.sources,
  };
};

/** Cartes enregistrées d'une parcelle, les plus récentes d'abord. */
export const listMaps = async (plotId, query, req) => {
  await findPlot(plotId, req);

  const items = await prisma.interpolatedMap.findMany({
    where: {
      plotId,
      organizationId: req.tenant.organizationId,
      ...(query.parameter ? { parameter: query.parameter } : {}),
    },
    orderBy: { computedAt: 'desc' },
    take: Math.min(Number(query.limit ?? 20), 100),
    /**
     * La grille complète n'est pas renvoyée en liste : elle peut compter des
     * milliers de cellules. `GET /:id` la fournit.
     */
    select: {
      id: true,
      parameter: true,
      depthCm: true,
      method: true,
      gridSize: true,
      sondesUsed: true,
      leaveOneOutMae: true,
      outliers: true,
      modelVersionId: true,
      computedAt: true,
      mode: true,
    },
  });

  return { plotId, items, count: items.length };
};

export const getMap = async (id, req) => {
  const map = await prisma.interpolatedMap.findFirst({
    where: { id, organizationId: req.tenant.organizationId },
  });
  if (!map) throw ApiError.notFound('Carte interpolée introuvable');
  return map;
};
