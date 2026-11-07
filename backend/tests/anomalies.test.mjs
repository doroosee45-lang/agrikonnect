/**
 * Anomalies de mesure — revue par l'agronome et effet sur le calcul.
 *
 * La détection elle-même (moteur Python, mesure des taux) est couverte par
 * `tests/anomalies.integration.test.mjs`, et le trajet complet contre une vraie
 * base par `tests/e2e/anomalies.e2e.test.mjs`.
 *
 * Ce qui est vérifié ici tient en une règle : **une mesure signalée est écartée
 * du calcul, et un rejet la réhabilite** — sans autre action.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/config/prisma.js';
import { provisionalThresholds, pendingConfirmations } from '../src/config/hardware.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';
import * as service from '../src/modules/anomalies/anomalies.service.js';

const ORG = 'org_anomalies';
const OTHER = 'org_autre';

const store = (overrides = {}) => ({
  iotDevice: [
    { id: 'device_sonde_1', organizationId: ORG, plotId: 'plot_anomalie', label: 'Sonde humidité' },
    { id: 'device_etranger', organizationId: OTHER, plotId: 'plot_autre', label: 'Sonde autre org' },
  ],
  sensorReading: [],
  sensorAnomaly: [
    {
      id: 'an_new', organizationId: ORG, deviceId: 'device_sonde_1', readingId: 'sr_001',
      episodeKey: 'sensorAnomaly:sr_001', reason: 'STATISTICAL_OUTLIER', severity: 'WARNING',
      status: 'NEW', detectedAt: new Date(), details: { value: 96 },
    },
    {
      id: 'an_confirmed', organizationId: ORG, deviceId: 'device_sonde_1', readingId: 'sr_002',
      episodeKey: 'sensorAnomaly:sr_002', reason: 'FROZEN_VALUE', severity: 'CRITICAL',
      status: 'CONFIRMED', detectedAt: new Date(), details: { value: 25 },
    },
    {
      id: 'an_dismissed', organizationId: ORG, deviceId: 'device_sonde_1', readingId: 'sr_003',
      episodeKey: 'sensorAnomaly:sr_003', reason: 'STATISTICAL_OUTLIER', severity: 'WARNING',
      status: 'DISMISSED', detectedAt: new Date(), details: { value: 31 },
    },
    {
      id: 'an_etranger', organizationId: OTHER, deviceId: 'device_etranger', readingId: 'sr_100',
      episodeKey: 'sensorAnomaly:sr_100', reason: 'STATISTICAL_OUTLIER', severity: 'WARNING',
      status: 'NEW', detectedAt: new Date(), details: {},
    },
  ],
  auditLog: [],
  ...overrides,
});

const reqAs = (organizationId = ORG, roles = ['AGRONOMIST']) => ({
  tenant: { organizationId, effectiveRoles: roles },
  user: { id: 'user_agronome', roles },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
  query: {},
  requestId: 'req_test',
});

/* ─────────────────────── exclusion du calcul ─────────────────────── */

test('Exclusion : NEW et CONFIRMED écartent la mesure, DISMISSED non', async () => {
  const { restore } = await withFakePrisma(prisma, store());
  try {
    const excluded = await service.excludedReadingIds('plot_anomalie');

    assert.ok(excluded.includes('sr_001'), 'une anomalie non revue écarte la mesure');
    assert.ok(excluded.includes('sr_002'), 'une anomalie confirmée écarte la mesure');
    assert.ok(
      !excluded.includes('sr_003'),
      'une anomalie rejetée ne doit plus écarter la mesure',
    );
  } finally {
    restore();
  }
});

test('Exclusion : la liste est dédoublonnée', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      sensorAnomaly: [
        {
          id: 'a1', organizationId: ORG, deviceId: 'device_sonde_1', readingId: 'sr_001',
          episodeKey: 'k1', reason: 'STATISTICAL_OUTLIER', status: 'NEW', details: {},
        },
        {
          id: 'a2', organizationId: ORG, deviceId: 'device_sonde_1', readingId: 'sr_001',
          episodeKey: 'k2', reason: 'FROZEN_VALUE', status: 'CONFIRMED', details: {},
        },
      ],
    }),
  );
  try {
    const excluded = await service.excludedReadingIds('plot_anomalie');
    assert.deepEqual(excluded, ['sr_001'], 'une mesure écartée ne doit pas apparaître deux fois');
  } finally {
    restore();
  }
});

test('Exclusion : les statuts qui écartent sont déclarés, pas implicites', () => {
  assert.deepEqual(service.EXCLUDING_STATUSES, ['NEW', 'CONFIRMED']);
});

/* ─────────────────────── revue par l’agronome ─────────────────────── */

test('Revue : rejeter une anomalie réhabilite la mesure', async () => {
  const { fake, restore } = await withFakePrisma(prisma, store());
  try {
    const result = await service.reviewAnomaly('an_new', { decision: 'DISMISSED', note: 'Vérifié sur site' }, reqAs());

    assert.equal(result.anomaly.status, 'DISMISSED');
    assert.equal(result.readingExcluded, false, 'la mesure réintègre le calcul');
    assert.equal(result.anomaly.reviewedBy, 'user_agronome');
    assert.ok(result.anomaly.reviewedAt instanceof Date);
    assert.equal(result.anomaly.details.reviewNote, 'Vérifié sur site');

    const excluded = await service.excludedReadingIds('plot_anomalie');
    assert.ok(!excluded.includes('sr_001'), 'l’effet du rejet est immédiat');
  } finally {
    restore();
  }
});

test('Revue : confirmer une anomalie maintient la mesure écartée', async () => {
  const { restore } = await withFakePrisma(prisma, store());
  try {
    const result = await service.reviewAnomaly('an_new', { decision: 'CONFIRMED' }, reqAs());

    assert.equal(result.anomaly.status, 'CONFIRMED');
    assert.equal(result.readingExcluded, true);

    const excluded = await service.excludedReadingIds('plot_anomalie');
    assert.ok(excluded.includes('sr_001'));
  } finally {
    restore();
  }
});

test('Revue : la décision est tracée, avant et après', async () => {
  const { fake, restore } = await withFakePrisma(prisma, store());
  try {
    await service.reviewAnomaly('an_new', { decision: 'DISMISSED' }, reqAs());

    const entry = fake._store.auditLog.find((log) => log.action === 'sensorAnomaly.review');
    assert.ok(entry, 'la revue doit être tracée');
    assert.equal(entry.oldValue.status, 'NEW');
    assert.equal(entry.newValue.status, 'DISMISSED');
  } finally {
    restore();
  }
});

test('Revue : l’anomalie d’une autre organisation est invisible (404)', async () => {
  const { restore } = await withFakePrisma(prisma, store());
  try {
    await assert.rejects(
      service.reviewAnomaly('an_etranger', { decision: 'DISMISSED' }, reqAs()),
      (error) => error.status === 404,
    );
    await assert.rejects(service.getAnomaly('an_etranger', reqAs()), (error) => error.status === 404);
  } finally {
    restore();
  }
});

/* ─────────────────────── seuils et réglages ─────────────────────── */

test('Réglages : tous les seuils sont annoncés provisoires', async () => {
  const settings = await service.getSettings();

  assert.equal(settings.thresholdsProvisional, true);
  assert.equal(settings.enabledEnvVar, 'ANOMALY_DETECTION_ENABLED');
  assert.deepEqual(settings.excludingStatuses, ['NEW', 'CONFIRMED']);
  assert.equal(
    settings.silenceHandledBy,
    'ThresholdAlert',
    'un capteur silencieux ne relève pas de ce module',
  );

  for (const key of ['madZLimit', 'stuckMinPoints', 'stuckEpsilon', 'gapFactor', 'lookbackDays', 'minReadings']) {
    assert.ok(settings.thresholds[key], `le seuil ${key} doit être exposé`);
    assert.match(
      String(settings.thresholds[key].source),
      /PROVISOIRE/,
      `le seuil ${key} doit porter la mention provisoire`,
    );
    assert.ok(settings.provisionalThresholds.includes(key), `${key} doit figurer dans la liste provisoire`);
  }
});

test('Configuration : les seuils provisoires sont recensables hors des valeurs vides', () => {
  const provisional = provisionalThresholds().map((entry) => entry.path);
  assert.ok(
    provisional.some((path) => path.startsWith('anomalies.')),
    'les seuils d’anomalie doivent apparaître comme provisoires',
  );
  /**
   * Ils ne peuvent pas vivre dans `pendingConfirmations()` : celui-ci ne collecte
   * que les valeurs vides, or ces seuils sont opérationnels.
   */
  const pending = pendingConfirmations().map((entry) => entry.path);
  assert.ok(
    !pending.some((path) => path === 'anomalies.madZLimit.value'),
    'un seuil pourvu d’une valeur ne doit pas être compté comme manquant',
  );
});
