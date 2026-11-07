/**
 * Détection d'anomalies sur les mesures de sonde.
 *
 * Le calcul existe déjà dans le moteur (`geoai/sensors.py` : écart absolu médian
 * robuste, capteur figé, trous de transmission). Ce qui manquait, c'était la
 * persistance : la route `POST /geospatial/sensors/quality` renvoyait le
 * résultat au client, qui le jetait. Le modèle `SensorAnomaly` n'avait aucun
 * point d'écriture.
 *
 * Quatre règles structurantes :
 *
 *  1. **Une mesure signalée est écartée du calcul** — état du sol, cartes
 *     interpolées, prévisions. Tant qu'un agronome ne l'a pas réhabilitée, une
 *     valeur suspecte ne fonde aucune recommandation.
 *  2. **Une anomalie rejetée n'est plus écartée.** Le dernier mot revient à
 *     l'agronome, pas au seuil statistique : les seuils sont provisoires.
 *  3. **Pas assez de mesures → rien n'est signalé.** Un MAD sur cinq points n'a
 *     pas de sens statistique ; signaler au hasard serait pire que se taire.
 *  4. **Dédoublonnage par épisode**, comme pour `ThresholdAlert` : relancer la
 *     détection ne crée pas de doublons.
 *
 * **Ne pas confondre avec `ThresholdAlert`.** Un capteur **silencieux** reste
 * dans `ThresholdAlert` (décision déjà prise) : c'est l'absence de mesure, pas
 * une mesure mauvaise. Ce module couvre les valeurs aberrantes et figées.
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { audit } from '../../shared/audit.js';
import { resolveId } from '../../shared/ids.js';
import { env } from '../../config/env.js';
import { hardware } from '../../config/hardware.js';
import { sensorQuality } from '../../integrations/geospatial.js';

/** Statuts qui maintiennent la mesure écartée du calcul. */
export const EXCLUDING_STATUSES = ['NEW', 'CONFIRMED'];

/**
 * Seuils transmis au moteur, lus à chaque appel.
 *
 * Leur source de vérité est `src/config/hardware.js` — jamais `geoai/config.py`,
 * qui ne sert que de repli. Un seuil `null` n'est pas envoyé : le moteur
 * appliquerait alors sa propre valeur, et le résultat ne serait plus reproductible
 * depuis la configuration déclarée.
 */
const thresholdsForEngine = () => {
  const thresholds = {};
  for (const [key, entry] of [
    ['madZLimit', hardware.anomalies.madZLimit],
    ['stuckMinPoints', hardware.anomalies.stuckMinPoints],
    ['stuckEpsilon', hardware.anomalies.stuckEpsilon],
    ['gapFactor', hardware.anomalies.gapFactor],
  ]) {
    if (entry?.value !== null && entry?.value !== undefined) thresholds[key] = entry.value;
  }
  return thresholds;
};

/** Activation du job, lue à l'appel — `env` est figé au chargement. */
const detectionEnabled = () =>
  (process.env.ANOMALY_DETECTION_ENABLED ?? env.ANOMALY_DETECTION_ENABLED) === 'true';

/** Clé d'épisode : une mesure ne porte qu'une anomalie, quel que soit le motif. */
const episodeKeyFor = (readingId) => `sensorAnomaly:${readingId}`;

/**
 * Identifiants des mesures écartées du calcul pour une parcelle.
 *
 * Exporté : c'est le point unique par lequel l'état du sol, l'interpolation et
 * la prévision appliquent l'exclusion. Trois copies de cette requête finiraient
 * par diverger.
 *
 * Une anomalie `DISMISSED` ne figure pas ici — c'est ce qui rend la réhabilitation
 * effective.
 *
 * Deux requêtes scalaires plutôt qu'un filtre relationnel `device: { plotId }` :
 * la liste des sondes d'une parcelle est minuscule et indexée, et le cas courant
 * (parcelle sans sonde) sort immédiatement sans toucher `sensor_anomalies`.
 */
export const excludedReadingIds = async (plotId) => {
  const devices = await prisma.iotDevice.findMany({
    where: { plotId },
    select: { id: true },
  });
  if (devices.length === 0) return [];

  const rows = await prisma.sensorAnomaly.findMany({
    where: {
      readingId: { not: null },
      status: { in: EXCLUDING_STATUSES },
      deviceId: { in: devices.map((device) => device.id) },
    },
    select: { readingId: true },
  });
  return [...new Set(rows.map((row) => row.readingId).filter(Boolean))];
};

const findDevice = async (deviceId, req) => {
  const device = await prisma.iotDevice.findFirst({
    where: { id: deviceId, organizationId: req.tenant.organizationId },
  });
  // 404 et non 403 : ne pas révéler l'existence d'une sonde d'un autre tenant.
  if (!device) throw ApiError.notFound('Sonde introuvable');
  return device;
};

/**
 * Détecte les anomalies d'une sonde et persiste le résultat.
 *
 * @returns `{ detected, anomalies, reason? }` — `detected: false` quand il n'y a
 *          pas assez de mesures : ce n'est pas un échec, c'est un refus motivé.
 */
export const detectForDevice = async (deviceId, req) => {
  const device = await findDevice(deviceId, req);
  const organizationId = req.tenant.organizationId;

  const lookbackDays = hardware.anomalies.lookbackDays.value;
  const since = new Date(Date.now() - lookbackDays * 86_400_000);
  const minReadings = hardware.anomalies.minReadings.value;

  /**
   * Les mesures déjà simulées sont ignorées : elles ne doivent de toute façon
   * jamais entrer dans le calcul, et qualifier une valeur inventée n'a pas de sens.
   */
  const readings = await prisma.sensorReading.findMany({
    where: { deviceId, mode: { not: 'SIMULATED' }, at: { gte: since } },
    orderBy: { at: 'asc' },
    take: 2000,
  });

  if (readings.length < minReadings) {
    return {
      detected: false,
      reason:
        `${readings.length} mesure(s) sur ${lookbackDays} jour(s), seuil minimal ${minReadings} : `
        + 'détection statistique refusée. Un écart absolu médian sur trop peu de points '
        + 'signalerait au hasard.',
      deviceId,
      readings: readings.length,
      minReadings,
    };
  }

  // Unité et profondeur dominantes : le moteur en a besoin pour la conversion.
  const units = readings.map((reading) => reading.unit).filter(Boolean);
  const depths = readings.map((reading) => reading.depthCm).filter((value) => value !== null);
  const dominant = (values) => {
    if (values.length === 0) return undefined;
    const counts = new Map();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };

  const thresholds = thresholdsForEngine();
  const quality = await sensorQuality({
    // L'identifiant est indispensable : le moteur trie et filtre la série, donc
    // ses indices ne correspondent pas à la liste envoyée.
    readings: readings.map((reading) => ({ id: reading.id, at: reading.at, value: reading.value })),
    unit: dominant(units) ?? 'vol %',
    depthCm: dominant(depths) ?? 30,
    thresholds,
  });

  if (!quality.available) {
    return { detected: false, reason: quality.reason, deviceId, readings: readings.length };
  }

  /**
   * Le capteur figé prime sur l'aberration statistique : une valeur figée explique
   * mécaniquement un écart, et c'est le défaut le plus actionable pour l'agronome.
   */
  const reasonsByReading = new Map();
  const addReason = (readingId, reason) => {
    if (!readingId) return;
    const existing = reasonsByReading.get(readingId) ?? [];
    if (!existing.includes(reason)) existing.push(reason);
    reasonsByReading.set(readingId, existing);
  };
  for (const readingId of quality.stuckReadingIds ?? []) addReason(readingId, 'FROZEN_VALUE');
  for (const readingId of quality.outlierReadingIds ?? []) addReason(readingId, 'STATISTICAL_OUTLIER');

  const byId = new Map(readings.map((reading) => [reading.id, reading]));
  const created = [];
  const skipped = [];

  for (const [readingId, reasons] of reasonsByReading) {
    const reading = byId.get(readingId);
    if (!reading) {
      skipped.push({ readingId, reason: 'Mesure absente de la fenêtre analysée' });
      continue;
    }

    const primary = reasons.includes('FROZEN_VALUE') ? 'FROZEN_VALUE' : reasons[0];
    const episodeKey = episodeKeyFor(readingId);

    const existing = await prisma.sensorAnomaly.findFirst({
      where: { organizationId, episodeKey },
    });

    if (existing) {
      /**
       * Déjà signalée : on ne crée pas de doublon. Une anomalie déjà revue n'est
       * **pas** rouverte — réinitialiser le statut annulerait la décision de
       * l'agronome à chaque passage du job.
       */
      skipped.push({ readingId, reason: 'Déjà signalée', status: existing.status });
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const anomaly = await prisma.sensorAnomaly.create({
      data: {
        id: resolveId(),
        organizationId,
        deviceId,
        readingId,
        /**
         * Clé de dédoublonnage — champ **requis** sans valeur par défaut.
         *
         * `fakePrisma` ne valide pas le schéma et laisserait passer une insertion
         * sans cette clé ; PostgreSQL la rejetterait. C'est la recette de bout en
         * bout, contre une vraie base, qui garantit ce champ.
         */
        episodeKey,
        reason: primary,
        severity: primary === 'FROZEN_VALUE' ? 'CRITICAL' : 'WARNING',
        status: 'NEW',
        detectedAt: reading.at,
        mode: reading.mode ?? 'REAL',
        details: {
          reasons,
          value: reading.value,
          unit: reading.unit ?? null,
          depthCm: reading.depthCm ?? null,
          observedAt: reading.at,
          /** Seuils appliqués : le verdict doit être reproductible. */
          thresholdsUsed: quality.thresholdsUsed ?? thresholds,
          quality: {
            confidence: quality.confidence,
            validReadings: quality.validReadings,
            outliers: quality.outliers,
            stuckSensor: quality.stuckSensor,
          },
        },
      },
    });
    created.push(anomaly);
  }

  if (req?.user?.id) {
    await audit({
      actorId: req.user.id,
      action: 'sensorAnomaly.detect',
      resource: 'IotDevice',
      resourceId: deviceId,
      req,
      newValue: {
        readings: readings.length,
        anomalies: created.length,
        reasons: [...reasonsByReading.values()].flat(),
      },
    });
  }

  return {
    detected: true,
    deviceId,
    readings: readings.length,
    anomalies: created.length,
    alreadyKnown: skipped.length,
    quality: {
      confidence: quality.confidence,
      outliers: quality.outliers,
      stuckSensor: quality.stuckSensor,
      gaps: quality.gaps?.length ?? 0,
      thresholdsUsed: quality.thresholdsUsed ?? thresholds,
    },
    /** Rappel : ces seuils sont provisoires, à recaler sur les données du pilote. */
    thresholdsProvisional: true,
  };
};

/** Détection sur toutes les sondes d'une parcelle. */
export const detectForPlot = async (plotId, req) => {
  const devices = await prisma.iotDevice.findMany({
    where: { plotId, organizationId: req.tenant.organizationId },
    select: { id: true, label: true },
  });

  const results = [];
  for (const device of devices) {
    try {
      // eslint-disable-next-line no-await-in-loop
      results.push({ deviceId: device.id, label: device.label, ...(await detectForDevice(device.id, req)) });
    } catch (error) {
      // L'échec d'une sonde ne prive pas les autres de détection.
      results.push({ deviceId: device.id, label: device.label, detected: false, reason: error.message });
    }
  }

  return {
    plotId,
    devices: devices.length,
    anomalies: results.reduce((total, entry) => total + (entry.anomalies ?? 0), 0),
    results,
  };
};

/**
 * Détection planifiée.
 *
 * Désactivée par défaut : sans moteur Python joignable, un job actif ne
 * produirait que des erreurs. Les échecs sont comptés et restitués, jamais avalés.
 */
export const runDetection = async ({ organizationId = null, limit = 200 } = {}) => {
  if (!detectionEnabled()) {
    return {
      enabled: false,
      reason: `Détection désactivée (${hardware.anomalies.enabledEnvVar} != true). Aucune sonde analysée.`,
      at: new Date(),
    };
  }

  const devices = await prisma.iotDevice.findMany({
    where: { status: 'ACTIVE', ...(organizationId ? { organizationId } : {}) },
    select: { id: true, organizationId: true, plotId: true },
    take: Math.min(Number(limit), 500),
  });

  const analysed = [];
  const refused = [];
  const failed = [];

  for (const device of devices) {
    const jobRequest = {
      tenant: { organizationId: device.organizationId },
      user: null,
      headers: { 'user-agent': 'job:sensors.detectAnomalies' },
      ip: '127.0.0.1',
      requestId: 'job-anomalies',
    };
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await detectForDevice(device.id, jobRequest);
      if (result.detected) analysed.push({ deviceId: device.id, anomalies: result.anomalies });
      else refused.push({ deviceId: device.id, reason: result.reason });
    } catch (error) {
      failed.push({ deviceId: device.id, reason: error.message });
    }
  }

  return {
    enabled: true,
    devicesScanned: devices.length,
    analysed: analysed.length,
    anomalies: analysed.reduce((total, entry) => total + entry.anomalies, 0),
    refused: refused.length,
    failed: failed.length,
    details: { analysed, refused, failed },
    thresholdsProvisional: true,
    at: new Date(),
  };
};

/** Liste filtrable et paginée. */
export const listAnomalies = async (query, req) => {
  const organizationId = req.tenant.organizationId;
  const where = {
    organizationId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.deviceId ? { deviceId: query.deviceId } : {}),
    ...(query.reason ? { reason: query.reason } : {}),
  };

  const page = Number(query.page ?? 1);
  const limit = Math.min(Number(query.limit ?? 50), 200);
  const [items, total] = await prisma.$transaction([
    prisma.sensorAnomaly.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { device: { select: { id: true, label: true, plotId: true } } },
    }),
    prisma.sensorAnomaly.count({ where }),
  ]);

  return {
    items,
    page,
    limit,
    total,
    /** Rappel permanent : les seuils qui ont produit ces lignes sont provisoires. */
    thresholdsProvisional: true,
  };
};

export const getAnomaly = async (anomalyId, req) => {
  const anomaly = await prisma.sensorAnomaly.findFirst({
    where: { id: anomalyId, organizationId: req.tenant.organizationId },
    include: {
      device: { select: { id: true, label: true, plotId: true } },
      reading: true,
    },
  });
  if (!anomaly) throw ApiError.notFound('Anomalie introuvable');
  return anomaly;
};

/**
 * Confirme ou rejette une anomalie.
 *
 * **Un rejet réhabilite la mesure** : elle cesse d'être écartée du calcul dès la
 * mise à jour, sans aucune autre action. C'est le correctif prévu pour les faux
 * positifs d'un seuil provisoire.
 */
export const reviewAnomaly = async (anomalyId, payload, req) => {
  const anomaly = await getAnomaly(anomalyId, req);

  const updated = await prisma.sensorAnomaly.update({
    where: { id: anomaly.id },
    data: {
      status: payload.decision,
      reviewedBy: req.user.id,
      reviewedAt: new Date(),
      details: {
        ...(anomaly.details ?? {}),
        reviewNote: payload.note ?? null,
      },
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'sensorAnomaly.review',
    resource: 'SensorAnomaly',
    resourceId: anomaly.id,
    req,
    oldValue: { status: anomaly.status },
    newValue: { status: updated.status, note: payload.note ?? null },
  });

  return {
    anomaly: updated,
    /**
     * Conséquence explicite : la mesure est-elle encore écartée du calcul ?
     * Le dire évite que l'effet d'un rejet reste implicite.
     */
    readingExcluded: EXCLUDING_STATUSES.includes(updated.status),
  };
};

/** Réglages exposés, pour rendre le verdict explicable. */
export const getSettings = async () => ({
  enabledEnvVar: hardware.anomalies.enabledEnvVar,
  detectionEnabled: detectionEnabled(),
  thresholds: Object.fromEntries(
    ['madZLimit', 'stuckMinPoints', 'stuckEpsilon', 'gapFactor', 'lookbackDays', 'minReadings']
      .map((key) => [key, hardware.anomalies[key]]),
  ),
  /**
   * Tous les seuils sont provisoires : ils sont ajustés sur des séries
   * synthétiques et **doivent être recalés sur les données réelles du pilote**.
   * Les taux de fausse alerte mesurés sur synthétique ne remplacent pas une
   * mesure sur données réelles.
   */
  thresholdsProvisional: true,
  provisionalThresholds: hardware.anomalies
    ? Object.entries(hardware.anomalies)
      .filter(([, entry]) => entry && typeof entry === 'object' && String(entry.source ?? '').includes('PROVISOIRE'))
      .map(([key]) => key)
    : [],
  excludingStatuses: EXCLUDING_STATUSES,
  /** Un capteur silencieux relève de `ThresholdAlert`, pas d'ici. */
  silenceHandledBy: 'ThresholdAlert',
});
