/**
 * Acquisition satellite programmée — CDC : « satellite via Sentinel Hub / Earth
 * Engine sur une planification ».
 *
 * Jusqu'à cette étape, `satellite_observations` n'était alimentée que par une
 * saisie manuelle (`geodata.recordSatellite`, où l'appelant fournit lui-même la
 * valeur). Cinq modules lisent cette table ; rien ne la remplissait sur
 * planification.
 *
 * Trois règles structurantes :
 *
 *  1. **Le radar d'abord.** Sous couverture nuageuse équatoriale persistante,
 *     l'optique est rarement exploitable. La source est résolue par
 *     `src/config/satellite.js`, qui place Sentinel-1 en tête.
 *  2. **Une scène nuageuse en optique est refusée, pas dégradée.** Au-delà du
 *     seuil, on ne la conserve pas en l'assortissant d'une confiance réduite :
 *     une valeur douteuse finit toujours par être lue comme une mesure.
 *  3. **Le satellite ne complète que les zones sans sonde.** Le job écarte les
 *     parcelles déjà couvertes par des mesures réelles — c'est la règle du CDC,
 *     et cela économise le quota fournisseur.
 *
 * Le fournisseur est interchangeable : voir `src/integrations/satellite.js`.
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { audit } from '../../shared/audit.js';
import { resolveId } from '../../shared/ids.js';
import { assertDataModeAllowed } from '../../shared/dataMode.js';
import { env } from '../../config/env.js';
import { hardware } from '../../config/hardware.js';
import { fetchScene, satelliteSettings } from '../../integrations/satellite.js';
import {
  MOISTURE_INDEXES,
  PRIMARY_MOISTURE_SOURCE,
  resolveMoistureSource,
} from '../../config/satellite.js';
import { RANGE_KEYS } from '../recommendation/agronomicRanges.js';

/** Index d'humidité demandé par défaut, selon la source retenue. */
const defaultIndexFor = (sourceId) =>
  sourceId === PRIMARY_MOISTURE_SOURCE?.id ? (MOISTURE_INDEXES[0] ?? 'S1_SOIL_MOISTURE') : 'NDVI';

/**
 * Emprise d'une géométrie GeoJSON, en [ouest, sud, est, nord].
 *
 * Calculée sur tous les sommets, quel que soit le type de géométrie : une
 * emprise approximative ferait requérir une scène qui ne couvre pas la parcelle.
 */
export const bboxOf = (geometry) => {
  const coordinates = [];
  const walk = (node) => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      coordinates.push(node);
      return;
    }
    for (const child of node) walk(child);
  };
  walk(geometry?.coordinates);

  if (coordinates.length === 0) return null;

  const lons = coordinates.map(([lon]) => lon);
  const lats = coordinates.map(([, lat]) => lat);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
};

const findPlot = async (plotId, req) => {
  const plot = await prisma.plot.findFirst({
    where: { id: plotId, organizationId: req.tenant.organizationId, deletedAt: null },
  });
  // 404 et non 403 : ne pas révéler l'existence d'une parcelle d'un autre tenant.
  if (!plot) throw ApiError.notFound('Parcelle introuvable');
  return plot;
};

/**
 * Une parcelle est-elle déjà couverte par des mesures réelles d'humidité ?
 *
 * Le satellite ne complète que les zones sans sonde : là où une sonde mesure,
 * sa valeur prime et la scène ne servirait à rien.
 */
const hasProbeCoverage = async (plotId) => {
  const count = await prisma.sensorReading.count({
    where: {
      plotId,
      metric: RANGE_KEYS.SOIL_MOISTURE,
      mode: { not: 'SIMULATED' },
    },
  });
  return count > 0;
};

/**
 * Acquiert une scène pour une parcelle et la persiste.
 *
 * @returns l'observation créée, ou un objet `{ acquired: false, reason }` quand
 *          la scène est refusée (nuages) ou indisponible.
 */
export const acquireForPlot = async (plotId, payload = {}, req) => {
  const plot = await findPlot(plotId, req);

  const bbox = payload.bbox ?? bboxOf(plot.geometry);
  if (!bbox) {
    throw ApiError.badRequest(
      'La parcelle n’a pas de géométrie exploitable : impossible de déterminer l’emprise de la scène.',
    );
  }

  const settings = satelliteSettings();
  const preferred = resolveMoistureSource({});
  const source = payload.sourceId
    ? hardware.satellite.sources.find((entry) => entry.id === payload.sourceId) ?? preferred.source
    : preferred.source;
  const index = payload.index ?? defaultIndexFor(source.id);

  const lookbackDays = hardware.satellite.sceneLookbackDays.value;
  const to = payload.to ? new Date(payload.to) : new Date();
  const from = new Date(to.getTime() - lookbackDays * 86_400_000);

  let scene;
  try {
    scene = await fetchScene({
      plotId,
      source,
      sourceId: source.id,
      index,
      bbox,
      from: from.toISOString(),
      to: to.toISOString(),
      observedAtKey: to.toISOString().slice(0, 10),
    });
  } catch (error) {
    /**
     * L'échec est renvoyé, pas masqué. Aucune valeur de substitution n'est
     * produite : mieux vaut « pas de scène » qu'une scène inventée.
     */
    return {
      acquired: false,
      reason: `Acquisition impossible auprès du fournisseur « ${settings.provider} » : ${error.message}`,
      plotId,
      provider: settings.provider,
      sourceId: source.id,
      probeCovered: await hasProbeCoverage(plotId),
    };
  }

  /**
   * Contrôle de la couverture nuageuse **après** réception : c'est la seule
   * information fiable sur la scène réellement obtenue.
   */
  const resolution = resolveMoistureSource({
    cloudCoverPct: scene.cloudCoverPct,
    availableSource: scene.sourceId,
  });
  if (resolution.rejectedSource === scene.sourceId) {
    return {
      acquired: false,
      reason: resolution.reason,
      plotId,
      provider: settings.provider,
      sourceId: scene.sourceId,
      cloudCoverPct: scene.cloudCoverPct,
      /** La scène existe mais n'est pas exploitable : elle n'est pas conservée. */
      rejected: true,
      probeCovered: await hasProbeCoverage(plotId),
    };
  }

  /**
   * Garde de mode : une scène simulée est refusée à l'écriture en production.
   * C'est la même protection que pour les mesures de capteur.
   */
  assertDataModeAllowed(scene.mode, { isProd: env.isProd, simulationAllowed: env.simulationAllowed });

  const observation = await prisma.satelliteObservation.create({
    data: {
      id: resolveId(payload.id),
      plotId,
      provider: scene.provider,
      index: scene.index,
      value: scene.value,
      observedAt: scene.observedAt,
      cloudCover: scene.cloudCoverPct,
      /**
       * Confiance plafonnée par la déclaration du matériel : une source de
       * surface ne peut pas prétendre à la fiabilité d'une sonde.
       */
      confidence: source.confidence ?? 'low',
      mode: scene.mode,
    },
  });

  if (req?.user?.id) {
    await audit({
      actorId: req.user.id,
      action: 'satellite.observation.acquire',
      resource: 'SatelliteObservation',
      resourceId: observation.id,
      req,
      newValue: {
        plotId,
        provider: scene.provider,
        sourceId: scene.sourceId,
        index: scene.index,
        mode: scene.mode,
        cloudCoverPct: scene.cloudCoverPct,
      },
    });
  }

  return {
    acquired: true,
    observation,
    plotId,
    provider: scene.provider,
    sourceId: scene.sourceId,
    sourceResolution: resolution.reason,
    /** Rappel explicite : une scène satellite mesure la surface, jamais le sous-sol. */
    measuresSubsurface: false,
    probeCovered: await hasProbeCoverage(plotId),
  };
};

/**
 * Acquisition planifiée sur toutes les parcelles non couvertes par une sonde.
 *
 * @returns un compte-rendu : acquisitions, parcelles écartées et pourquoi, échecs.
 */
export const runAcquisition = async ({ organizationId = null, limit = 200 } = {}) => {
  const settings = satelliteSettings();
  const startedAt = new Date();

  if (!settings.acquisitionEnabled) {
    return {
      enabled: false,
      reason: `Acquisition désactivée (${settings.enabledEnvVar} != true). Aucune scène demandée.`,
      provider: settings.provider,
      at: startedAt,
    };
  }

  const plots = await prisma.plot.findMany({
    where: {
      deletedAt: null,
      ...(organizationId ? { organizationId } : {}),
    },
    select: { id: true, organizationId: true, geometry: true },
    orderBy: { createdAt: 'asc' },
    take: Math.min(Number(limit), 500),
  });

  const acquired = [];
  const skipped = [];
  const failed = [];

  for (const plot of plots) {
    // eslint-disable-next-line no-await-in-loop
    const covered = await hasProbeCoverage(plot.id);
    if (covered) {
      skipped.push({ plotId: plot.id, reason: 'PROBE_COVERED' });
      continue;
    }

    /**
     * Le job n'a pas d'utilisateur : `req` est fabriqué avec le tenant de la
     * parcelle pour que l'isolation reste appliquée partout où elle l'est.
     */
    const jobRequest = {
      tenant: { organizationId: plot.organizationId },
      user: null,
      headers: { 'user-agent': 'job:satellite.acquire' },
      ip: '127.0.0.1',
      requestId: 'job-satellite',
    };

    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await acquireForPlot(plot.id, {}, jobRequest);
      if (result.acquired) acquired.push({ plotId: plot.id, observationId: result.observation.id });
      else if (result.rejected) skipped.push({ plotId: plot.id, reason: 'SCENE_REJECTED', detail: result.reason });
      else failed.push({ plotId: plot.id, reason: result.reason });
    } catch (error) {
      failed.push({ plotId: plot.id, reason: error.message });
    }
  }

  return {
    enabled: true,
    provider: settings.provider,
    plotsScanned: plots.length,
    acquired: acquired.length,
    skipped: skipped.length,
    failed: failed.length,
    details: { acquired, skipped, failed },
    at: startedAt,
  };
};

/** Observations satellite d'une parcelle, les plus récentes d'abord. */
export const listObservations = async (plotId, query, req) => {
  await findPlot(plotId, req);

  const items = await prisma.satelliteObservation.findMany({
    where: {
      plotId,
      ...(query.index ? { index: query.index } : {}),
      ...(query.provider ? { provider: query.provider } : {}),
    },
    orderBy: { observedAt: 'desc' },
    take: Math.min(Number(query.limit ?? 50), 200),
  });

  return {
    plotId,
    items,
    count: items.length,
    settings: satelliteSettings(),
    /**
     * Rappel permanent : aucune de ces valeurs ne décrit le sous-sol. Le
     * rappeler dans la réponse évite qu'un consommateur l'oublie.
     */
    measuresSubsurface: false,
  };
};

/** Réglages d'acquisition exposés, sans les secrets. */
export const getSettings = async () => {
  const settings = satelliteSettings();
  return {
    ...settings,
    /** Les sources et leur rôle, pour rendre le choix de source explicable. */
    sources: hardware.satellite.sources.map((source) => ({
      id: source.id,
      mission: source.mission,
      sensor: source.sensor,
      cloudInsensitive: source.cloudInsensitive,
      measuresSubsurface: source.measuresSubsurface,
      confidence: source.confidence,
      role: source.role,
    })),
  };
};
