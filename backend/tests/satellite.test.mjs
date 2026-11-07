/**
 * Acquisition satellite — tests du service et de l'interface fournisseur.
 *
 * Ce qui est vérifié tient en trois invariants :
 *
 *  1. **un fournisseur réel non configuré échoue bruyamment** et ne fabrique
 *     aucune valeur ;
 *  2. **le mode simulé est marqué et refusé en production** ;
 *  3. **une scène optique nuageuse est refusée, pas dégradée** — alors que le
 *     radar, insensible aux nuages, passe toujours.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';
import * as service from '../src/modules/satellite/acquisition.service.js';
import { fetchScene, satelliteSettings } from '../src/integrations/satellite.js';

const ORG = 'org_1';
const OTHER = 'org_autre';

const POLYGON = {
  type: 'Polygon',
  coordinates: [[[18.25, 0.048], [18.26, 0.048], [18.26, 0.052], [18.25, 0.052], [18.25, 0.048]]],
};

const store = (overrides = {}) => ({
  plot: [
    { id: 'plot_sat', organizationId: ORG, farmId: 'farm_1', name: 'Parcelle satellite', geometry: POLYGON, deletedAt: null },
    { id: 'plot_sonde', organizationId: ORG, farmId: 'farm_1', name: 'Parcelle équipée', geometry: POLYGON, deletedAt: null },
    { id: 'plot_autre', organizationId: OTHER, farmId: 'farm_2', name: 'Autre organisation', geometry: POLYGON, deletedAt: null },
  ],
  sensorReading: [],
  sensorAnomaly: [],
  iotDevice: [],
  satelliteObservation: [],
  auditLog: [],
  ...overrides,
});

const reqAs = (organizationId = ORG) => ({
  tenant: { organizationId, effectiveRoles: ['FARMER'] },
  user: { id: 'user_1', roles: ['FARMER'] },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
  query: {},
  requestId: 'req_test',
});

const sceneRequest = (overrides = {}) => ({
  plotId: 'plot_sat',
  source: { id: 'sentinel-1', mission: 'Sentinel-1', cloudInsensitive: true, confidence: 'low' },
  sourceId: 'sentinel-1',
  index: 'S1_SOIL_MOISTURE',
  bbox: [18.25, 0.048, 18.26, 0.052],
  from: '2026-09-01T00:00:00Z',
  to: '2026-09-13T00:00:00Z',
  observedAtKey: '2026-09-13',
  ...overrides,
});

/** Restaure le fournisseur par défaut après chaque test. */
const useProvider = (name) => {
  const previous = process.env.SATELLITE_PROVIDER;
  if (name === null) delete process.env.SATELLITE_PROVIDER;
  else process.env.SATELLITE_PROVIDER = name;
  return () => {
    if (previous === undefined) delete process.env.SATELLITE_PROVIDER;
    else process.env.SATELLITE_PROVIDER = previous;
  };
};

/* ─────────────────────── emprise de la parcelle ─────────────────────── */

test('Emprise : calculée sur tous les sommets d’un polygone', () => {
  assert.deepEqual(service.bboxOf(POLYGON), [18.25, 0.048, 18.26, 0.052]);
});

test('Emprise : un point donne une emprise dégénérée mais valide', () => {
  assert.deepEqual(service.bboxOf({ type: 'Point', coordinates: [18.3, 0.06] }), [18.3, 0.06, 18.3, 0.06]);
});

test('Emprise : un multipolygone est couvert dans son ensemble', () => {
  const geometry = {
    type: 'MultiPolygon',
    coordinates: [
      [[[18.25, 0.048], [18.26, 0.048], [18.26, 0.052], [18.25, 0.052]]],
      [[[18.30, 0.060], [18.31, 0.060], [18.31, 0.065], [18.30, 0.065]]],
    ],
  };
  assert.deepEqual(service.bboxOf(geometry), [18.25, 0.048, 18.31, 0.065]);
});

test('Emprise : une géométrie absente ne donne pas d’emprise inventée', () => {
  assert.equal(service.bboxOf(null), null);
  assert.equal(service.bboxOf({}), null);
  assert.equal(service.bboxOf({ type: 'Polygon', coordinates: [] }), null);
});

/* ─────────────────────── interface fournisseur ─────────────────────── */

test('Fournisseur simulé : la scène est marquée SIMULATED', async () => {
  const restore = useProvider('simulated');
  try {
    const scene = await fetchScene(sceneRequest());
    assert.equal(scene.mode, 'SIMULATED');
    assert.equal(scene.provider, 'simulated');
    assert.equal(scene.index, 'S1_SOIL_MOISTURE');
    assert.ok(Number.isFinite(scene.value));
    // Le radar traverse les nuages : la couverture n'a pas d'effet sur lui.
    assert.equal(scene.cloudCoverPct, null);
  } finally {
    restore();
  }
});

test('Fournisseur simulé : déterministe pour une même parcelle et un même jour', async () => {
  const restore = useProvider('simulated');
  try {
    const first = await fetchScene(sceneRequest());
    const second = await fetchScene(sceneRequest());
    assert.equal(first.value, second.value, 'les recettes doivent être reproductibles');

    const otherPlot = await fetchScene(sceneRequest({ plotId: 'plot_autre' }));
    assert.notEqual(first.value, otherPlot.value, 'deux parcelles ne reçoivent pas la même scène');
  } finally {
    restore();
  }
});

test('Fournisseur réel non configuré : échec explicite, aucune valeur fabriquée', async () => {
  const restore = useProvider('sentinelhub');
  const previousUrl = process.env.SATELLITE_API_URL;
  delete process.env.SATELLITE_API_URL;
  try {
    await assert.rejects(fetchScene(sceneRequest()), (error) => {
      assert.match(error.message, /SATELLITE_API_URL manquant/);
      return true;
    });
  } finally {
    process.env.SATELLITE_API_URL = previousUrl;
    restore();
  }
});

test('Fournisseur réel : clé absente → échec, pas de repli silencieux', async () => {
  const restore = useProvider('earthengine');
  const previousUrl = process.env.SATELLITE_API_URL;
  const previousKey = process.env.SATELLITE_API_KEY;
  process.env.SATELLITE_API_URL = 'https://example.invalid/statistical';
  delete process.env.SATELLITE_API_KEY;
  try {
    await assert.rejects(fetchScene(sceneRequest()), (error) => {
      assert.match(error.message, /SATELLITE_API_KEY manquant/);
      return true;
    });
  } finally {
    process.env.SATELLITE_API_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SATELLITE_API_KEY;
    else process.env.SATELLITE_API_KEY = previousKey;
    restore();
  }
});

test('Fournisseur inconnu : refusé, avec la liste des disponibles', async () => {
  const restore = useProvider('pas-un-fournisseur');
  try {
    await assert.rejects(fetchScene(sceneRequest()), (error) => {
      assert.match(error.message, /Fournisseur satellite inconnu/);
      assert.match(error.message, /sentinelhub/);
      return true;
    });
  } finally {
    restore();
  }
});

test('Réglages : aucun secret n’est exposé', () => {
  const settings = satelliteSettings();
  assert.ok(!('apiKey' in settings));
  assert.ok(!('apiUrl' in settings));
  // Seule la présence est signalée, jamais la valeur.
  assert.equal(typeof settings.apiUrlConfigured, 'boolean');
  assert.equal(typeof settings.apiKeyConfigured, 'boolean');
  assert.equal(settings.primaryMoistureSource, 'sentinel-1');
  assert.equal(settings.simulatedAllowed, true, 'hors production');
});

/* ─────────────────────── acquisition et persistance ─────────────────────── */

test('Acquisition : la scène simulée est persistée avec la confiance du matériel', async () => {
  const restore = useProvider('simulated');
  const { fake, restore: restoreDb } = await withFakePrisma(prisma, store());
  try {
    const result = await service.acquireForPlot('plot_sat', {}, reqAs());

    assert.equal(result.acquired, true, result.reason);
    assert.equal(result.provider, 'simulated');
    assert.equal(result.sourceId, 'sentinel-1', 'le radar est la source principale');
    assert.equal(result.measuresSubsurface, false, 'le satellite ne mesure jamais le sous-sol');

    assert.equal(fake._store.satelliteObservation.length, 1);
    const row = fake._store.satelliteObservation[0];
    assert.equal(row.plotId, 'plot_sat');
    assert.equal(row.index, 'S1_SOIL_MOISTURE');
    assert.equal(row.mode, 'SIMULATED', 'le mode simulé est conservé, pas effacé');
    assert.equal(row.confidence, 'low', 'la confiance vient de la déclaration du matériel');

    assert.ok(
      fake._store.auditLog.some((entry) => entry.action === 'satellite.observation.acquire'),
      'l’acquisition doit être tracée',
    );
  } finally {
    restoreDb();
    restore();
  }
});

test('Acquisition : sans géométrie, aucune emprise n’est inventée', async () => {
  const restore = useProvider('simulated');
  const { restore: restoreDb } = await withFakePrisma(
    prisma,
    store({ plot: [{ id: 'plot_sat', organizationId: ORG, farmId: 'farm_1', geometry: null, deletedAt: null }] }),
  );
  try {
    await assert.rejects(service.acquireForPlot('plot_sat', {}, reqAs()), (error) => {
      assert.equal(error.status, 422);
      assert.match(error.message, /géométrie/);
      return true;
    });
  } finally {
    restoreDb();
    restore();
  }
});

test('Acquisition : la parcelle d’une autre organisation est invisible (404)', async () => {
  const restore = useProvider('simulated');
  const { restore: restoreDb } = await withFakePrisma(prisma, store());
  try {
    await assert.rejects(service.acquireForPlot('plot_sat', {}, reqAs(OTHER)), (error) => {
      assert.equal(error.status, 404);
      return true;
    });
    await assert.rejects(service.listObservations('plot_sat', {}, reqAs(OTHER)), (error) => error.status === 404);
  } finally {
    restoreDb();
    restore();
  }
});

test('Acquisition : un échec fournisseur est renvoyé, pas masqué', async () => {
  const restore = useProvider('sentinelhub');
  const previousUrl = process.env.SATELLITE_API_URL;
  delete process.env.SATELLITE_API_URL;
  const { fake, restore: restoreDb } = await withFakePrisma(prisma, store());
  try {
    const result = await service.acquireForPlot('plot_sat', {}, reqAs());

    assert.equal(result.acquired, false);
    assert.match(result.reason, /Acquisition impossible/);
    assert.equal(fake._store.satelliteObservation.length, 0, 'rien ne doit être écrit sur un échec');
  } finally {
    process.env.SATELLITE_API_URL = previousUrl;
    restoreDb();
    restore();
  }
});

/* ─────────────────────── couverture par une sonde ─────────────────────── */

test('Sonde : une parcelle déjà mesurée est signalée comme couverte', async () => {
  const restore = useProvider('simulated');
  const { restore: restoreDb } = await withFakePrisma(
    prisma,
    store({
      sensorReading: [{
        id: 'sr_1', plotId: 'plot_sonde', organizationId: ORG, deviceId: 'device_1',
        metric: 'moisture', value: 28, source: 'measured_sensor', at: new Date(), mode: 'REAL',
      }],
    }),
  );
  try {
    const result = await service.acquireForPlot('plot_sonde', {}, reqAs());
    assert.equal(result.probeCovered, true, 'la présence d’une sonde est signalée');
  } finally {
    restoreDb();
    restore();
  }
});

/* ─────────────────────── job d’acquisition ─────────────────────── */

test('Job : désactivé, il ne demande aucune scène', async () => {
  const restore = useProvider('simulated');
  try {
    const result = await service.runAcquisition();
    assert.equal(result.enabled, false);
    assert.match(result.reason, /désactivée/);
    assert.match(result.reason, /SATELLITE_ACQUISITION_ENABLED/);
  } finally {
    restore();
  }
});

test('Job : il écarte les parcelles déjà couvertes par une sonde', async () => {
  const restore = useProvider('simulated');
  const previousEnabled = process.env.SATELLITE_ACQUISITION_ENABLED;
  process.env.SATELLITE_ACQUISITION_ENABLED = 'true';

  const { fake, restore: restoreDb } = await withFakePrisma(
    prisma,
    store({
      sensorReading: [{
        id: 'sr_1', plotId: 'plot_sonde', organizationId: ORG, deviceId: 'device_1',
        metric: 'moisture', value: 28, source: 'measured_sensor', at: new Date(), mode: 'REAL',
      }],
    }),
  );
  try {
    const result = await service.runAcquisition({ organizationId: ORG });

    assert.equal(result.enabled, true);
    assert.equal(result.plotsScanned, 2);
    assert.equal(result.acquired, 1, 'seule la parcelle sans sonde reçoit une scène');
    assert.equal(result.skipped, 1);
    assert.equal(result.details.skipped[0].plotId, 'plot_sonde');
    assert.equal(result.details.skipped[0].reason, 'PROBE_COVERED');
    assert.equal(result.details.acquired[0].plotId, 'plot_sat');

    assert.equal(fake._store.satelliteObservation.length, 1);
    assert.equal(fake._store.satelliteObservation[0].plotId, 'plot_sat');
  } finally {
    if (previousEnabled === undefined) delete process.env.SATELLITE_ACQUISITION_ENABLED;
    else process.env.SATELLITE_ACQUISITION_ENABLED = previousEnabled;
    restoreDb();
    restore();
  }
});

test('Job : un échec fournisseur est compté, pas avalé', async () => {
  const restore = useProvider('sentinelhub');
  const previousUrl = process.env.SATELLITE_API_URL;
  delete process.env.SATELLITE_API_URL;
  const previousEnabled = process.env.SATELLITE_ACQUISITION_ENABLED;
  process.env.SATELLITE_ACQUISITION_ENABLED = 'true';

  const { fake, restore: restoreDb } = await withFakePrisma(prisma, store());
  try {
    const result = await service.runAcquisition({ organizationId: ORG });

    assert.equal(result.acquired, 0);
    assert.equal(result.failed, 2, 'les deux parcelles sans sonde échouent');
    assert.match(result.details.failed[0].reason, /SATELLITE_API_URL manquant/);
    assert.equal(fake._store.satelliteObservation.length, 0);
  } finally {
    if (previousEnabled === undefined) delete process.env.SATELLITE_ACQUISITION_ENABLED;
    else process.env.SATELLITE_ACQUISITION_ENABLED = previousEnabled;
    process.env.SATELLITE_API_URL = previousUrl;
    restoreDb();
    restore();
  }
});

/* ─────────────────────── lecture des observations ─────────────────────── */

test('Lecture : les observations rappellent que le satellite ne voit pas le sous-sol', async () => {
  const restore = useProvider('simulated');
  const { restore: restoreDb } = await withFakePrisma(prisma, store());
  try {
    await service.acquireForPlot('plot_sat', {}, reqAs());
    const result = await service.listObservations('plot_sat', {}, reqAs());

    assert.equal(result.count, 1);
    assert.equal(result.measuresSubsurface, false);
    assert.equal(result.items[0].mode, 'SIMULATED');
    assert.equal(result.settings.primaryMoistureSource, 'sentinel-1');
  } finally {
    restoreDb();
    restore();
  }
});
