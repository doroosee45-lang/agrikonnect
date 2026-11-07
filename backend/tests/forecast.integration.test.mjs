/**
 * Contrat Node ⇄ Python pour la prévision, et gouvernance des modèles.
 *
 * Trois niveaux de preuve :
 *  1. **contrat réel** — le vrai moteur `geoai/server.py` est lancé, et l'on
 *     vérifie que sa réponse a exactement la forme que le service Node consomme.
 *     Un double en mémoire prouverait seulement que Node est cohérent avec lui-même.
 *  2. **service Node** sur Prisma simulé : série construite depuis les mesures,
 *     persistance, et refus de persister quand les données sont insuffisantes.
 *  3. **versionnage** : la promotion est refusée sans preuve, accordée avec.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';
import * as client from '../src/integrations/geospatial.js';
import * as forecastService from '../src/modules/forecast/forecast.service.js';
import * as models from '../src/modules/ai/modelVersions.service.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ORG = 'org_1';
const BASE = Date.parse('2026-08-01T00:00:00Z');
const DAY = 86_400_000;

const freePort = async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
};

/** Série en tendance nette : 40 points, −0,3 par jour. */
const trendingSeries = (count = 40) =>
  Array.from({ length: count }, (_, i) => ({
    at: new Date(BASE + i * DAY).toISOString(),
    value: Number((40 - 0.3 * i).toFixed(3)),
  }));

const store = (overrides = {}) => ({
  plot: [{ id: 'plot_prev', organizationId: ORG, farmId: 'farm_1', name: 'Parcelle prévision', deletedAt: null }],
  sensorReading: [],
  sensorAnomaly: [],
  iotDevice: [],
  soilPrediction: [],
  aiModelVersion: [],
  auditLog: [],
  ...overrides,
});

const reqAs = (roles = ['FARMER'], userId = 'user_1', organizationId = ORG) => ({
  tenant: { organizationId, effectiveRoles: roles },
  user: { id: userId, roles },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
  query: {},
  requestId: 'req_test',
});

/* ─────────────── contrat réel avec le moteur Python ─────────────── */

test('Contrat Node⇄Python : le moteur rend exactement la forme attendue', async (t) => {
  const port = await freePort();
  const engine = spawn('python3', ['geoai/server.py', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: ROOT,
    env: { ...process.env, GEOAI_QUIET: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const previousUrl = process.env.GEOAI_URL;
  process.env.GEOAI_URL = `http://127.0.0.1:${port}`;

  try {
    let ready = false;
    for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 100));
      // eslint-disable-next-line no-await-in-loop
      ready = (await client.engineHealth()).available === true;
    }
    if (!ready) {
      t.skip('moteur Python indisponible dans cet environnement');
      return;
    }

    const result = await client.forecastSoil({
      parameter: 'moisture',
      series: trendingSeries(),
      horizonDays: 7,
      stepDays: 1,
      now: new Date(BASE + 40 * DAY).toISOString(),
    });

    // Champs que le service Node lit réellement : leur absence casserait la persistance.
    assert.equal(result.sufficient, true);
    assert.equal(result.parameter, 'moisture');
    assert.equal(typeof result.method, 'string');
    assert.equal(result.baselineMethod, 'persistence');
    assert.ok(Array.isArray(result.values) && result.values.length === 7);

    for (const point of result.values) {
      assert.equal(typeof point.at, 'string');
      assert.ok(point.at.endsWith('Z'), 'horodatage UTC normalisé');
      assert.equal(typeof point.value, 'number');
      assert.ok('low' in point && 'high' in point, 'les bornes doivent être présentes, même nulles');
    }

    const evaluation = result.evaluation;
    assert.equal(evaluation.split, 'chronological', 'le découpage doit être chronologique');
    assert.equal(evaluation.trainPoints + evaluation.testPoints, 40);
    assert.equal(typeof evaluation.model.mae, 'number');
    assert.equal(typeof evaluation.baseline.mae, 'number');
    assert.equal(typeof evaluation.beatsBaseline, 'boolean');
    assert.equal(evaluation.beatsBaseline, true, 'une tendance nette bat la persistance');
    assert.ok(evaluation.model.mae < evaluation.baseline.mae);

    // La projection démarre bien après la dernière observation.
    const first = Date.parse(result.values[0].at);
    assert.ok(first > BASE + 39 * DAY, 'aucun point ne doit retomber dans l’historique');
  } finally {
    process.env.GEOAI_URL = previousUrl;
    engine.kill('SIGTERM');
  }
});

test('Contrat Node⇄Python : données insuffisantes → sufficient:false et aucune valeur', async (t) => {
  const port = await freePort();
  const engine = spawn('python3', ['geoai/server.py', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: ROOT,
    env: { ...process.env, GEOAI_QUIET: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const previousUrl = process.env.GEOAI_URL;
  process.env.GEOAI_URL = `http://127.0.0.1:${port}`;

  try {
    let ready = false;
    for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 100));
      // eslint-disable-next-line no-await-in-loop
      ready = (await client.engineHealth()).available === true;
    }
    if (!ready) {
      t.skip('moteur Python indisponible dans cet environnement');
      return;
    }

    const result = await client.forecastSoil({
      parameter: 'moisture',
      series: trendingSeries(5),
      horizonDays: 7,
    });

    assert.equal(result.sufficient, false);
    assert.deepEqual(result.values, [], 'aucune valeur de substitution');
    assert.equal(typeof result.reason, 'string');
    assert.ok(result.reason.length > 20, 'le motif doit être explicite');
    assert.equal(result.evaluation, null);
  } finally {
    process.env.GEOAI_URL = previousUrl;
    engine.kill('SIGTERM');
  }
});

test('Contrat Node⇄Python : payload invalide → 422 typé, jamais retenté', async (t) => {
  const port = await freePort();
  const engine = spawn('python3', ['geoai/server.py', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: ROOT,
    env: { ...process.env, GEOAI_QUIET: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const previousUrl = process.env.GEOAI_URL;
  process.env.GEOAI_URL = `http://127.0.0.1:${port}`;

  try {
    let ready = false;
    for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 100));
      // eslint-disable-next-line no-await-in-loop
      ready = (await client.engineHealth()).available === true;
    }
    if (!ready) {
      t.skip('moteur Python indisponible dans cet environnement');
      return;
    }

    await assert.rejects(
      client.forecastSoil({ series: trendingSeries() }),
      (error) => {
        assert.equal(error.status, 422);
        assert.equal(error.code, 'GEOSPATIAL_INVALID_PAYLOAD');
        assert.match(error.message, /parameter/i);
        return true;
      },
    );
  } finally {
    process.env.GEOAI_URL = previousUrl;
    engine.kill('SIGTERM');
  }
});

test('Contrat Node⇄Python : les seuils publiés par le moteur sont ceux appliqués', async (t) => {
  const port = await freePort();
  const engine = spawn('python3', ['geoai/server.py', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: ROOT,
    env: { ...process.env, GEOAI_QUIET: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const previousUrl = process.env.GEOAI_URL;
  process.env.GEOAI_URL = `http://127.0.0.1:${port}`;

  try {
    let ready = false;
    for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 100));
      // eslint-disable-next-line no-await-in-loop
      ready = (await client.engineHealth()).available === true;
    }
    if (!ready) {
      t.skip('moteur Python indisponible dans cet environnement');
      return;
    }

    const meta = await client.engineMeta();
    const thresholds = meta.thresholds?.forecast;
    assert.ok(thresholds, 'le moteur doit publier ses seuils de prévision');
    assert.equal(typeof thresholds.minPoints, 'number');
    assert.equal(typeof thresholds.minSpanDays, 'number');
    assert.equal(thresholds.split ?? undefined, undefined);
    assert.ok(thresholds.testFraction > 0 && thresholds.testFraction < 0.5);

    // Le seuil publié explique réellement le refus : 1 point de moins que
    // `minPoints` doit être refusé, et `minPoints` exactement doit passer.
    const justBelow = await client.forecastSoil({
      parameter: 'moisture',
      series: trendingSeries(thresholds.minPoints - 1),
    });
    assert.equal(justBelow.sufficient, false);

    const atThreshold = await client.forecastSoil({
      parameter: 'moisture',
      series: trendingSeries(thresholds.minPoints),
    });
    // Au seuil, la contrainte d'étendue temporelle peut encore s'appliquer :
    // dans les deux cas, aucune valeur n'est inventée.
    if (atThreshold.sufficient === false) {
      assert.match(atThreshold.reason, /jour|observation/i);
    } else {
      assert.ok(Array.isArray(atThreshold.values));
    }

    assert.ok(
      meta.endpoints['/v1/forecast/soil'] === 'POST',
      'la route de prévision doit être exposée',
    );
    assert.ok(meta.endpoints['/v1/forecast/backtest'] === 'POST');
  } finally {
    process.env.GEOAI_URL = previousUrl;
    engine.kill('SIGTERM');
  }
});

/* ─────────────── service Node : série, persistance, refus ─────────────── */

test('Prévision : la série ne contient que des mesures réelles', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      sensorReading: [
        { id: 'r1', plotId: 'plot_prev', metric: 'moisture', value: 30, at: new Date(BASE), source: 'measured_sensor', mode: 'REAL' },
        { id: 'r2', plotId: 'plot_prev', metric: 'moisture', value: 99, at: new Date(BASE + DAY), source: 'measured_sensor', mode: 'SIMULATED' },
        { id: 'r3', plotId: 'plot_prev', metric: 'ph', value: 6.4, at: new Date(BASE), source: 'measured_sensor', mode: 'REAL' },
      ],
    }),
  );
  try {
    const { series, sources, modes, count } = await forecastService.buildSeries('plot_prev', 'moisture');
    assert.equal(count, 1, 'la mesure simulée et l’autre paramètre sont exclus');
    assert.equal(series[0].value, 30);
    assert.deepEqual(sources, ['measured_sensor']);
    assert.deepEqual(modes, ['REAL']);
  } finally {
    restore();
  }
});

test('Prévision : un paramètre non prévirable est refusé avant tout appel', async () => {
  const { restore } = await withFakePrisma(prisma, store());
  try {
    await assert.rejects(
      forecastService.forecastForPlot('plot_prev', 'texture', {}, reqAs()),
      (error) => {
        assert.equal(error.status, 422);
        assert.match(error.message, /non prévirable/);
        return true;
      },
    );
    // La texture n'a pas de sens numérique : elle ne doit pas être prévirable.
    assert.ok(!forecastService.FORECASTABLE_PARAMETERS.includes('texture'));
  } finally {
    restore();
  }
});

test('Prévision : la parcelle d’une autre organisation est invisible (404)', async () => {
  const { restore } = await withFakePrisma(prisma, store());
  try {
    await assert.rejects(
      forecastService.forecastForPlot('plot_prev', 'moisture', {}, reqAs(['FARMER'], 'u2', 'org_autre')),
      (error) => {
        assert.equal(error.status, 404);
        return true;
      },
    );
  } finally {
    restore();
  }
});

/* ─────────────── versionnage des modèles ─────────────── */

test('Modèles : la comparaison est calculée, jamais déclarée par l’appelant', () => {
  // MAE plus bas = meilleur.
  const better = models.compareAgainstBaseline('FORECAST', { mae: 1.2 }, { mae: 2.4 });
  assert.equal(better.beatsBaseline, true);
  assert.equal(better.metric, 'mae');
  assert.equal(better.margin, 1.2);

  const worse = models.compareAgainstBaseline('FORECAST', { mae: 3.0 }, { mae: 2.4 });
  assert.equal(worse.beatsBaseline, false);

  // À égalité, la méthode apprise n'apporte rien.
  const equal = models.compareAgainstBaseline('FORECAST', { mae: 2.4 }, { mae: 2.4 });
  assert.equal(equal.beatsBaseline, false);

  // Sens inverse pour une métrique « plus haut = meilleur ».
  assert.equal(models.compareAgainstBaseline('ANOMALY', { f1: 0.9 }, { f1: 0.7 }).beatsBaseline, true);
  assert.equal(models.compareAgainstBaseline('ANOMALY', { f1: 0.5 }, { f1: 0.7 }).beatsBaseline, false);
});

test('Modèles : comparaison impossible → null, ni victoire ni défaite présumée', () => {
  assert.equal(models.compareAgainstBaseline('FORECAST', { mae: 1.2 }, null).beatsBaseline, null);
  assert.equal(models.compareAgainstBaseline('FORECAST', {}, { mae: 2.4 }).beatsBaseline, null);
  assert.equal(models.compareAgainstBaseline('FORECAST', { mae: 'abc' }, { mae: 2.4 }).beatsBaseline, null);
  // Famille inconnue : aucune règle de comparaison, donc aucun verdict.
  assert.equal(models.compareAgainstBaseline('INCONNU', { mae: 1 }, { mae: 2 }).beatsBaseline, null);
});

test('Modèles : l’enregistrement reste en TESTING, avec le verdict calculé', async () => {
  const { fake, restore } = await withFakePrisma(prisma, store());
  try {
    const created = await models.register(
      {
        name: 'prevision-humidite',
        version: '1.0.0',
        kind: 'FORECAST',
        datasetDescription: '40 jours de mesures de sonde, parcelle Mbandaka, août–septembre 2026',
        metrics: { mae: 1.2, rmse: 1.6 },
        baselineMetrics: { mae: 2.4, rmse: 3.0 },
      },
      reqAs(['ADMIN'], 'admin_1'),
    );

    assert.equal(created.status, 'TESTING', 'aucune promotion implicite à l’enregistrement');
    assert.equal(created.beatsBaseline, true);
    assert.equal(created.organizationId, ORG);
    assert.equal(fake._store.auditLog.some((row) => row.action === 'aiModelVersion.register'), true);
  } finally {
    restore();
  }
});

test('Modèles : promotion refusée sans preuve, accordée avec', async () => {
  const { restore } = await withFakePrisma(prisma, store());
  try {
    const weak = await models.register(
      {
        name: 'prevision-faible',
        version: '0.1.0',
        kind: 'FORECAST',
        datasetDescription: 'Jeu d’essai réduit, 12 mesures seulement',
        metrics: { mae: 5.0 },
        baselineMetrics: { mae: 2.0 },
      },
      reqAs(['ADMIN'], 'admin_1'),
    );

    await assert.rejects(models.promote(weak.id, reqAs(['ADMIN'], 'admin_1')), (error) => {
      assert.equal(error.status, 409);
      assert.match(error.message, /ne bat pas le moteur à règles/);
      return true;
    });

    const strong = await models.register(
      {
        name: 'prevision-humidite',
        version: '1.0.0',
        kind: 'FORECAST',
        datasetDescription: '40 jours de mesures de sonde, parcelle Mbandaka',
        metrics: { mae: 1.1 },
        baselineMetrics: { mae: 2.4 },
      },
      reqAs(['ADMIN'], 'admin_1'),
    );

    const promoted = await models.promote(strong.id, reqAs(['ADMIN'], 'admin_1'));
    assert.equal(promoted.status, 'PRODUCTION');
    assert.ok(promoted.promotedAt, 'la promotion est datée');
    assert.equal(promoted.promotedBy, 'admin_1', 'la promotion est attribuée');
  } finally {
    restore();
  }
});

test('Modèles : promotion refusée quand la comparaison est impossible', async () => {
  const { restore } = await withFakePrisma(prisma, store());
  try {
    const unproven = await models.register(
      {
        name: 'prevision-sans-reference',
        version: '0.2.0',
        kind: 'FORECAST',
        datasetDescription: 'Modèle entraîné sans évaluation contre le moteur à règles',
        metrics: { mae: 0.4 },
        baselineMetrics: null,
      },
      reqAs(['ADMIN'], 'admin_1'),
    );

    assert.equal(unproven.beatsBaseline, null);
    await assert.rejects(models.promote(unproven.id, reqAs(['ADMIN'], 'admin_1')), (error) => {
      assert.equal(error.status, 409);
      assert.match(error.message, /comparaison au moteur à règles est impossible/);
      return true;
    });
  } finally {
    restore();
  }
});

test('Modèles : une seule version en production par famille', async () => {
  const { fake, restore } = await withFakePrisma(prisma, store());
  try {
    const first = await models.register(
      {
        name: 'prevision-humidite',
        version: '1.0.0',
        kind: 'FORECAST',
        datasetDescription: 'Premier lot de mesures, août 2026',
        metrics: { mae: 1.5 },
        baselineMetrics: { mae: 2.4 },
      },
      reqAs(['ADMIN'], 'admin_1'),
    );
    const second = await models.register(
      {
        name: 'prevision-humidite',
        version: '2.0.0',
        kind: 'FORECAST',
        datasetDescription: 'Second lot de mesures, septembre 2026',
        metrics: { mae: 0.9 },
        baselineMetrics: { mae: 2.4 },
      },
      reqAs(['ADMIN'], 'admin_1'),
    );

    await models.promote(first.id, reqAs(['ADMIN'], 'admin_1'));
    await models.promote(second.id, reqAs(['ADMIN'], 'admin_1'));

    const production = fake._store.aiModelVersion.filter((row) => row.status === 'PRODUCTION');
    assert.equal(production.length, 1, `une seule en production, reçu ${production.length}`);
    assert.equal(production[0].id, second.id, 'la plus récente l’emporte');
    assert.equal(
      fake._store.aiModelVersion.find((row) => row.id === first.id).status,
      'RETIRED',
      'l’ancienne version est retirée, pas supprimée',
    );
  } finally {
    restore();
  }
});

test('Modèles : le retrait conserve l’historique et les métriques', async () => {
  const { fake, restore } = await withFakePrisma(prisma, store());
  try {
    const created = await models.register(
      {
        name: 'anomalie-capteurs',
        version: '1.0.0',
        kind: 'ANOMALY',
        datasetDescription: 'Anomalies étiquetées sur 3 mois de remontées',
        metrics: { f1: 0.88 },
        baselineMetrics: { f1: 0.70 },
      },
      reqAs(['ADMIN'], 'admin_1'),
    );
    await models.promote(created.id, reqAs(['ADMIN'], 'admin_1'));
    const retired = await models.retire(created.id, reqAs(['ADMIN'], 'admin_1'));

    assert.equal(retired.status, 'RETIRED');
    const row = fake._store.aiModelVersion.find((item) => item.id === created.id);
    assert.deepEqual(row.metrics, { f1: 0.88 }, 'les métriques restent consultables');
    // Le retrait est idempotent.
    const again = await models.retire(created.id, reqAs(['ADMIN'], 'admin_1'));
    assert.equal(again.status, 'RETIRED');
  } finally {
    restore();
  }
});

test('Modèles : une version d’une autre organisation est invisible (404)', async () => {
  const { restore } = await withFakePrisma(prisma, store());
  try {
    const created = await models.register(
      {
        name: 'modele-confidentiel',
        version: '1.0.0',
        kind: 'FORECAST',
        datasetDescription: 'Modèle propre à une organisation',
        metrics: { mae: 1.0 },
        baselineMetrics: { mae: 2.0 },
      },
      reqAs(['ADMIN'], 'admin_1'),
    );

    await assert.rejects(models.getOne(created.id, reqAs(['ADMIN'], 'admin_2', 'org_autre')), (error) => {
      assert.equal(error.status, 404);
      return true;
    });
    await assert.rejects(models.promote(created.id, reqAs(['ADMIN'], 'admin_2', 'org_autre')), (error) => {
      assert.equal(error.status, 404);
      return true;
    });
  } finally {
    restore();
  }
});

/* ─────────── service Node + moteur réel : persistance ─────────── */

/** Lance le moteur pour la durée d'un test et rend un nettoyeur. */
const withEngine = async (t) => {
  const port = await freePort();
  const engine = spawn('python3', ['geoai/server.py', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: ROOT,
    env: { ...process.env, GEOAI_QUIET: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const previousUrl = process.env.GEOAI_URL;
  process.env.GEOAI_URL = `http://127.0.0.1:${port}`;

  let ready = false;
  for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 100));
    // eslint-disable-next-line no-await-in-loop
    ready = (await client.engineHealth()).available === true;
  }
  if (!ready) {
    process.env.GEOAI_URL = previousUrl;
    engine.kill('SIGTERM');
    t.skip('moteur Python indisponible dans cet environnement');
    return null;
  }
  return () => {
    process.env.GEOAI_URL = previousUrl;
    engine.kill('SIGTERM');
  };
};

test('Prévision : la série réelle alimente SoilPrediction, avec la preuve de qualité', async (t) => {
  const stop = await withEngine(t);
  if (!stop) return;

  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      sensorReading: trendingSeries(40).map((point, index) => ({
        id: `sr_${index}`,
        plotId: 'plot_prev',
        organizationId: ORG,
        deviceId: 'device_prev',
        metric: 'moisture',
        value: point.value,
        unit: '%',
        source: 'measured_sensor',
        confidence: 'high',
        at: new Date(point.at),
        depthCm: 30,
        mode: 'REAL',
      })),
    }),
  );

  try {
    const result = await forecastService.forecastForPlot(
      'plot_prev',
      'moisture',
      { horizonDays: 7, stepDays: 1, now: new Date(BASE + 40 * DAY) },
      reqAs(),
    );

    assert.equal(result.sufficient, true, `prévision attendue : ${result.reason}`);
    assert.equal(result.observationCount, 40);
    assert.deepEqual(result.sources, ['measured_sensor'], 'les sources accompagnent le résultat');

    // La ligne est réellement persistée, avec la référence à battre.
    assert.equal(fake._store.soilPrediction.length, 1);
    const row = fake._store.soilPrediction[0];
    assert.equal(row.parameter, 'moisture');
    assert.equal(row.plotId, 'plot_prev');
    assert.equal(row.organizationId, ORG);
    assert.equal(row.horizonDays, 7);
    assert.equal(row.mode, 'REAL');
    assert.equal(row.depthCm, 30);
    assert.equal(row.beatsBaseline, true, 'le verdict du moteur est conservé tel quel');
    assert.ok(row.mae < row.baselineMae, `MAE ${row.mae} vs référence ${row.baselineMae}`);
    assert.equal(row.values.length, 7);

    // Le job d'alertes n'exploite que `beatsBaseline === true` : la ligne doit
    // donc être utilisable, et c'est ce champ qui le décide.
    assert.equal(result.beatsBaseline, true);

    // L'écriture est tracée, avec les métriques qui la justifient.
    const auditRow = fake._store.auditLog.find((item) => item.action === 'soilPrediction.create');
    assert.ok(auditRow, 'la création doit être auditée');
    assert.equal(auditRow.newValue.beatsBaseline, true);
  } finally {
    restore();
    stop();
  }
});

test('Prévision : données réelles insuffisantes → rien n’est persisté', async (t) => {
  const stop = await withEngine(t);
  if (!stop) return;

  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      sensorReading: trendingSeries(4).map((point, index) => ({
        id: `sr_${index}`,
        plotId: 'plot_prev',
        organizationId: ORG,
        deviceId: 'device_prev',
        metric: 'moisture',
        value: point.value,
        unit: '%',
        source: 'measured_sensor',
        at: new Date(point.at),
        mode: 'REAL',
      })),
    }),
  );

  try {
    const result = await forecastService.forecastForPlot(
      'plot_prev',
      'moisture',
      { horizonDays: 7 },
      reqAs(),
    );

    assert.equal(result.sufficient, false);
    assert.ok(result.reason.length > 10, 'le motif est renvoyé à l’appelant');
    assert.deepEqual(result.values, [], 'aucune valeur de substitution');
    assert.equal(fake._store.soilPrediction.length, 0, 'aucune ligne ne doit être créée');
    assert.equal(
      fake._store.auditLog.filter((item) => item.action === 'soilPrediction.create').length,
      0,
      'rien à auditer puisqu’il n’y a rien d’écrit',
    );
  } finally {
    restore();
    stop();
  }
});

test('Prévision : le backtest évalue sans écrire', async (t) => {
  const stop = await withEngine(t);
  if (!stop) return;

  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      sensorReading: trendingSeries(40).map((point, index) => ({
        id: `sr_${index}`,
        plotId: 'plot_prev',
        organizationId: ORG,
        deviceId: 'device_prev',
        metric: 'moisture',
        value: point.value,
        source: 'measured_sensor',
        at: new Date(point.at),
        mode: 'REAL',
      })),
    }),
  );

  try {
    const result = await forecastService.backtestForPlot(
      'plot_prev',
      'moisture',
      { horizonDays: 7 },
      reqAs(),
    );

    assert.equal(result.sufficient, true);
    assert.equal(result.promotable, true, 'une tendance nette bat la persistance');
    assert.equal(result.evaluation.split, 'chronological');
    assert.deepEqual(fake._store.soilPrediction, [], 'le backtest n’écrit rien');
  } finally {
    restore();
    stop();
  }
});
