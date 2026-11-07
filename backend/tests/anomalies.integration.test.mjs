/**
 * Détection d'anomalies — contrat réel avec le moteur et mesure des taux.
 *
 * Le vrai moteur `geoai/server.py` est lancé : ces tests vérifient que les seuils
 * du fichier de configuration matériel sont réellement appliqués, et mesurent les
 * taux de détection et de fausse alerte sur des **séries synthétiques**.
 *
 * ⚠️ Ces taux ne remplacent pas une mesure sur données réelles. Une série
 * synthétique reproduit le bruit que l'on a supposé ; elle ne connaît ni
 * l'encrassement progressif d'une sonde, ni les coupures de couverture réseau,
 * ni la dérive de calibration. Les seuils sont provisoires tant qu'ils n'ont pas
 * été recalés sur le pilote.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { prisma } from '../src/config/prisma.js';
import { hardware } from '../src/config/hardware.js';
import { sensorQuality, engineHealth } from '../src/integrations/geospatial.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';
import * as service from '../src/modules/anomalies/anomalies.service.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ORG = 'org_anomalies';

/**
 * Générateur pseudo-aléatoire déterministe.
 *
 * `Math.random` rendrait les taux non reproductibles d'une exécution à l'autre :
 * un test de taux qui bouge ne prouve rien.
 */
const makeRandom = (seed) => {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
};

/** Série de mesures horodatées, avec identifiants stables. */
const serie = (values, prefix, startMs = Date.UTC(2026, 8, 1)) =>
  values.map((value, index) => ({
    id: `${prefix}_${String(index).padStart(3, '0')}`,
    at: new Date(startMs + index * 6 * 3_600_000).toISOString(),
    value,
  }));

/** Seuils réellement déclarés dans le fichier de configuration matériel. */
const configuredThresholds = () => ({
  madZLimit: hardware.anomalies.madZLimit.value,
  stuckMinPoints: hardware.anomalies.stuckMinPoints.value,
  stuckEpsilon: hardware.anomalies.stuckEpsilon.value,
  gapFactor: hardware.anomalies.gapFactor.value,
});

const freePort = async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
};

/** Lance le moteur Python pour la durée d'un test. */
const withEngine = async (t) => {
  const port = await freePort();
  const engine = spawn('python3', ['geoai/server.py', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: ROOT,
    env: { ...process.env, GEOAI_QUIET: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = [];
  engine.stderr.on('data', (chunk) => log.push(String(chunk)));

  const previousUrl = process.env.GEOAI_URL;
  process.env.GEOAI_URL = `http://127.0.0.1:${port}`;

  let ready = false;
  for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 100));
    // eslint-disable-next-line no-await-in-loop
    ready = (await engineHealth()).available === true;
  }
  if (!ready) {
    process.env.GEOAI_URL = previousUrl;
    engine.kill('SIGTERM');
    t.skip(`moteur Python indisponible : ${log.join('')}`);
    return null;
  }
  return () => {
    process.env.GEOAI_URL = previousUrl;
    engine.kill('SIGTERM');
  };
};

const store = (overrides = {}) => ({
  iotDevice: [
    { id: 'device_sonde_1', organizationId: ORG, plotId: 'plot_anomalie', label: 'Sonde humidité', status: 'ACTIVE' },
    { id: 'device_sonde_2', organizationId: ORG, plotId: 'plot_anomalie', label: 'Sonde pH', status: 'ACTIVE' },
  ],
  sensorReading: [],
  sensorAnomaly: [],
  auditLog: [],
  ...overrides,
});

const reqAs = (organizationId = ORG) => ({
  tenant: { organizationId, effectiveRoles: ['AGRONOMIST'] },
  user: { id: 'user_agronome', roles: ['AGRONOMIST'] },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
  query: {},
  requestId: 'req_test',
});

/* ─────────────────── contrat réel avec le moteur ─────────────────── */

test('Moteur : les seuils du fichier matériel sont réellement appliqués', async (t) => {
  const stop = await withEngine(t);
  if (!stop) return;
  try {
    // Une valeur à +3 unités : aberrante avec un seuil bas, pas avec un seuil haut.
    const readings = serie([24.0, 24.4, 24.2, 27.0, 24.6, 24.1, 24.3, 24.5], 'x');

    const strict = await sensorQuality({ readings, unit: 'vol %', depthCm: 30, thresholds: { madZLimit: 1.5 } });
    const loose = await sensorQuality({ readings, unit: 'vol %', depthCm: 30, thresholds: { madZLimit: 25 } });

    assert.equal(strict.thresholdsUsed.madZLimit, 1.5, 'le seuil fourni est celui appliqué');
    assert.equal(loose.thresholdsUsed.madZLimit, 25);
    assert.ok(strict.outliers > loose.outliers, 'un seuil plus bas signale davantage');
    assert.equal(loose.outliers, 0);
  } finally {
    stop();
  }
});

test('Moteur : les identifiants des mesures aberrantes remontent, malgré le tri', async (t) => {
  const stop = await withEngine(t);
  if (!stop) return;
  try {
    // Entrée volontairement mélangée : le moteur trie par date, donc ses indices
    // ne correspondent pas à l'ordre envoyé.
    const readings = [
      { id: 'r_4', at: '2026-09-04T00:00:00Z', value: 24.6 },
      { id: 'r_1', at: '2026-09-01T00:00:00Z', value: 24.0 },
      { id: 'r_3', at: '2026-09-03T00:00:00Z', value: 99.0 },
      { id: 'r_2', at: '2026-09-02T00:00:00Z', value: 24.4 },
      { id: 'r_5', at: '2026-09-05T00:00:00Z', value: 24.1 },
      { id: 'r_6', at: '2026-09-06T00:00:00Z', value: 24.3 },
      { id: 'r_7', at: '2026-09-07T00:00:00Z', value: 24.2 },
      { id: 'r_8', at: '2026-09-08T00:00:00Z', value: 24.5 },
    ];
    const result = await sensorQuality({ readings, thresholds: configuredThresholds() });

    assert.deepEqual(result.outlierReadingIds, ['r_3'], 'la mesure aberrante est la bonne');
    assert.ok(!result.outlierReadingIds.includes('r_4'), 'l’indice 3 après tri désignerait une autre mesure');
  } finally {
    stop();
  }
});

/* ─────────────── mesure des taux sur séries synthétiques ─────────────── */

test('Taux : détection et fausses alertes mesurés sur séries synthétiques', async (t) => {
  const stop = await withEngine(t);
  if (!stop) return;

  const SERIES = 40;
  const random = makeRandom(20_260_901);
  const thresholds = configuredThresholds();

  /** Bruit de fond plausible pour une humidité volumique. */
  const cleanValues = () => Array.from({ length: 20 }, () => Number((24 + (random() - 0.5) * 1.6).toFixed(2)));

  let falseAlarms = 0;
  let detected = 0;

  try {
    for (let index = 0; index < SERIES; index += 1) {
      // Série propre : toute détection est une fausse alerte.
      // eslint-disable-next-line no-await-in-loop
      const clean = await sensorQuality({
        readings: serie(cleanValues(), `clean_${index}`),
        thresholds,
      });
      if ((clean.outlierReadingIds?.length ?? 0) > 0) falseAlarms += 1;

      // Même série, avec un pic franc injecté à une position connue.
      const dirty = cleanValues();
      const position = 9;
      dirty[position] = 96.0;
      // eslint-disable-next-line no-await-in-loop
      const spiked = await sensorQuality({
        readings: serie(dirty, `spike_${index}`),
        thresholds,
      });
      if ((spiked.outlierReadingIds ?? []).includes(`spike_${index}_009`)) detected += 1;
    }

    const falseAlarmRate = falseAlarms / SERIES;
    const detectionRate = detected / SERIES;

    t.diagnostic(
      `séries synthétiques (n=${SERIES}) : détection ${(detectionRate * 100).toFixed(1)} %, `
      + `fausses alertes ${(falseAlarmRate * 100).toFixed(1)} % — seuils provisoires `
      + `(madZLimit=${thresholds.madZLimit})`,
    );

    /**
     * Bornes volontairement larges : elles attrapent un détecteur cassé, pas un
     * réglage à affiner. Les chiffres exacts sont dans le diagnostic ci-dessus et
     * dans la documentation.
     */
    assert.ok(detectionRate >= 0.9, `un pic franc doit être détecté : ${(detectionRate * 100).toFixed(1)} %`);
    assert.ok(falseAlarmRate <= 0.1, `trop de fausses alertes : ${(falseAlarmRate * 100).toFixed(1)} %`);
  } finally {
    stop();
  }
});

/* ─────────────────── détection et persistance ─────────────────── */

/**
 * Mesures ancrées sur **maintenant**.
 *
 * La fenêtre d'analyse est `lookbackDays` en arrière depuis la date courante :
 * des dates fixes sortiraient silencieusement de la fenêtre et le test
 * constaterait « pas assez de mesures » sans que le code soit en cause.
 */
const readingsFor = (values, deviceId = 'device_sonde_1', prefix = 'sr') => {
  // Recalé sur le début de l'heure, pour que la série reste dans la fenêtre
  // quel que soit le moment de l'exécution.
  const origin = Math.floor(Date.now() / 3_600_000) * 3_600_000 - (values.length * 6 * 3_600_000);
  return values.map((value, index) => ({
    id: `${prefix}_${String(index).padStart(3, '0')}`,
    deviceId,
    plotId: 'plot_anomalie',
    organizationId: ORG,
    metric: 'moisture',
    value,
    unit: '%',
    depthCm: 30,
    at: new Date(origin + index * 6 * 3_600_000),
    source: 'measured_sensor',
    confidence: 'high',
    mode: 'REAL',
  }));
};

test('Détection : la mesure aberrante est signalée et persistée', async (t) => {
  const stop = await withEngine(t);
  if (!stop) return;
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({ sensorReading: readingsFor([24.0, 24.4, 24.2, 96.0, 24.6, 24.1, 24.3, 24.5]) }),
  );
  try {
    const result = await service.detectForDevice('device_sonde_1', reqAs());

    assert.equal(result.detected, true, result.reason);
    assert.equal(result.anomalies, 1);
    assert.equal(result.thresholdsProvisional, true, 'les seuils sont annoncés provisoires');
    assert.equal(result.quality.thresholdsUsed.madZLimit, hardware.anomalies.madZLimit.value);

    const rows = fake._store.sensorAnomaly;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].readingId, 'sr_003');
    assert.equal(rows[0].reason, 'STATISTICAL_OUTLIER');
    assert.equal(rows[0].status, 'NEW');
    assert.equal(rows[0].deviceId, 'device_sonde_1');
    assert.equal(rows[0].details.value, 96.0);
    assert.ok(
      fake._store.auditLog.some((entry) => entry.action === 'sensorAnomaly.detect'),
      'la détection doit être tracée',
    );
  } finally {
    restore();
    stop();
  }
});

test('Détection : un capteur figé prime sur l’aberration statistique', async (t) => {
  const stop = await withEngine(t);
  if (!stop) return;
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({ sensorReading: readingsFor([24.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 26.0]) }),
  );
  try {
    const result = await service.detectForDevice('device_sonde_1', reqAs());

    assert.equal(result.detected, true, result.reason);
    assert.equal(result.quality.stuckSensor, true);

    const frozen = fake._store.sensorAnomaly.filter((row) => row.reason === 'FROZEN_VALUE');
    assert.ok(frozen.length >= 5, `la plage figée doit être signalée : ${frozen.length}`);
    assert.ok(
      frozen.every((row) => row.severity === 'CRITICAL'),
      'un capteur bloqué est plus grave qu’un point aberrant',
    );
  } finally {
    restore();
    stop();
  }
});

test('Détection : trop peu de mesures → rien n’est signalé', async (t) => {
  const stop = await withEngine(t);
  if (!stop) return;
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({ sensorReading: readingsFor([24.0, 96.0, 24.2]) }),
  );
  try {
    const result = await service.detectForDevice('device_sonde_1', reqAs());

    assert.equal(result.detected, false);
    assert.match(result.reason, /détection statistique refusée/);
    assert.equal(result.minReadings, hardware.anomalies.minReadings.value);
    assert.equal(fake._store.sensorAnomaly.length, 0, 'rien ne doit être écrit');
  } finally {
    restore();
    stop();
  }
});

test('Dédoublonnage : un second passage ne crée pas de doublon et ne rouvre pas une revue', async (t) => {
  const stop = await withEngine(t);
  if (!stop) return;
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({ sensorReading: readingsFor([24.0, 24.4, 24.2, 96.0, 24.6, 24.1, 24.3, 24.5]) }),
  );
  try {
    await service.detectForDevice('device_sonde_1', reqAs());
    assert.equal(fake._store.sensorAnomaly.length, 1);

    // Un agronome rejette l'anomalie.
    await service.reviewAnomaly(fake._store.sensorAnomaly[0].id, { decision: 'DISMISSED' }, reqAs());

    const second = await service.detectForDevice('device_sonde_1', reqAs());
    assert.equal(second.anomalies, 0, 'aucune nouvelle anomalie');
    assert.equal(second.alreadyKnown, 1, 'l’anomalie existante est reconnue');
    assert.equal(fake._store.sensorAnomaly.length, 1, 'pas de doublon');
    assert.equal(
      fake._store.sensorAnomaly[0].status,
      'DISMISSED',
      'la décision de l’agronome ne doit pas être annulée par le job',
    );
  } finally {
    restore();
    stop();
  }
});

test('Job : désactivé, il n’analyse aucune sonde', async (t) => {
  const previous = process.env.ANOMALY_DETECTION_ENABLED;
  delete process.env.ANOMALY_DETECTION_ENABLED;
  try {
    const result = await service.runDetection();
    assert.equal(result.enabled, false);
    assert.match(result.reason, /désactivée/);
    assert.match(result.reason, /ANOMALY_DETECTION_ENABLED/);
  } finally {
    if (previous === undefined) delete process.env.ANOMALY_DETECTION_ENABLED;
    else process.env.ANOMALY_DETECTION_ENABLED = previous;
  }
});

test('Job : activé, il compte les refus et les échecs sans les avaler', async (t) => {
  const stop = await withEngine(t);
  if (!stop) return;
  const previous = process.env.ANOMALY_DETECTION_ENABLED;
  process.env.ANOMALY_DETECTION_ENABLED = 'true';
  const { restore } = await withFakePrisma(
    prisma,
    store({ sensorReading: readingsFor([24.0, 96.0, 24.2]) }),
  );
  try {
    const result = await service.runDetection({ organizationId: ORG });

    assert.equal(result.enabled, true);
    assert.equal(result.devicesScanned, 2);
    assert.equal(result.analysed, 0);
    assert.equal(result.refused, 2, 'les deux sondes manquent de mesures');
    assert.match(result.details.refused[0].reason, /détection statistique refusée/);
  } finally {
    if (previous === undefined) delete process.env.ANOMALY_DETECTION_ENABLED;
    else process.env.ANOMALY_DETECTION_ENABLED = previous;
    restore();
    stop();
  }
});
