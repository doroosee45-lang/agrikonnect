/**
 * Exigences CDC couvertes : SOIL-10, SOIL-11, SOIL-12, SOIL-13, SOIL-14, GEO-01, GEO-02.
 *
 * Trois niveaux de preuve :
 *  1. contrat du client HTTP (succès, 422, 500 retenté, moteur injoignable) ;
 *  2. service Node sur Prisma simulé (mapping des analyses, persistance, audit) ;
 *  3. **bout en bout avec le vrai moteur Python** (`geoai/server.py`), pour
 *     prouver que le calcul scientifique est réellement exécuté, pas simulé.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';
import * as client from '../src/integrations/geospatial.js';
import * as service from '../src/modules/geospatial/geospatial.service.js';

const ORG = 'org_1';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const reqAs = (roles = ['FARMER'], userId = 'user_1', organizationId = ORG) => ({
  tenant: { organizationId, effectiveRoles: roles },
  user: { id: userId, roles },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
  query: {},
  requestId: 'req_test',
});

const store = (overrides = {}) => ({
  plot: [],
  soilAssessment: [],
  soilParameter: [],
  iotDevice: [],
  sensorReading: [],
  sensorAnomaly: [],
  satelliteObservation: [],
  soilDiagnostic: [],
  auditLog: [],
  organization: [],
  ...overrides,
});

/** Écrit/efface une variable d'environnement en gardant la possibilité de restaurer l'absence. */
const setEnv = (key, value) => {
  if (value === undefined || value === null) delete process.env[key];
  else process.env[key] = value;
};

const expectRejection = async (promise, status, pattern) => {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, status, `statut attendu ${status}, reçu ${error.status} (${error.message})`);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
};

/* ─────────────────── serveur factice (contrat du client) ─────────────────── */

const startStub = async (handler) => {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      // `engineHealth()` interroge GET /health : pas de corps JSON à parser.
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'agrikonnect-geoai', version: '1.0.0' }));
        return;
      }
      handler(req, res, body);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
};

const freePort = async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
};

test('SOIL-10 : le client transmet le jeton interne et renvoie la réponse du moteur', async () => {
  let received = null;
  const stub = await startStub((req, res, body) => {
    received = { url: req.url, token: req.headers['x-geoai-token'], body: JSON.parse(body) };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, echo: JSON.parse(body).probe }));
  });

  const previousUrl = process.env.GEOAI_URL;
  const previousToken = process.env.GEOAI_TOKEN;
  process.env.GEOAI_URL = stub.url;
  process.env.GEOAI_TOKEN = 'jeton-de-test';
  try {
    const result = await client.classifyTexture({ sand: 40, silt: 40, clay: 20, probe: 'texture' });
    assert.equal(result.ok, true);
    assert.equal(result.echo, 'texture');
    assert.equal(received.url, '/v1/soil/texture');
    assert.equal(received.token, 'jeton-de-test', 'le jeton partagé est transmis');
  } finally {
    setEnv('GEOAI_URL', previousUrl);
    setEnv('GEOAI_TOKEN', previousToken);
    await stub.close();
  }
});

test('SOIL-11 : un rejet 422 du moteur devient une erreur métier explicite, sans retentative', async () => {
  let calls = 0;
  const stub = await startStub((req, res) => {
    calls += 1;
    res.writeHead(422, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'invalid_payload', message: 'Bandes manquantes pour le NDVI : B4' } }));
  });

  const previousUrl = process.env.GEOAI_URL;
  process.env.GEOAI_URL = stub.url;
  try {
    await expectRejection(client.analyzeSoil({}), 422, /Bandes manquantes/);
    assert.equal(calls, 1, 'un payload invalide n’est pas retenté');
  } finally {
    setEnv('GEOAI_URL', previousUrl);
    await stub.close();
  }
});

test('SOIL-12 : une panne du moteur est retentée puis remontée (jamais un faux diagnostic)', async () => {
  let calls = 0;
  const stub = await startStub((req, res) => {
    calls += 1;
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'internal_error', message: 'boom' } }));
  });

  const previousUrl = process.env.GEOAI_URL;
  const previousRetries = process.env.GEOAI_RETRIES;
  process.env.GEOAI_URL = stub.url;
  process.env.GEOAI_RETRIES = '1';
  try {
    await expectRejection(client.analyzeSoil({}), 502, /Moteur géospatial en erreur/);
    assert.equal(calls, 2, 'une seule reprise est tentée');
  } finally {
    setEnv('GEOAI_URL', previousUrl);
    setEnv('GEOAI_RETRIES', previousRetries);
    await stub.close();
  }
});

test('SOIL-13 / NFR-10 : moteur injoignable → 503 avec la marche à suivre', async () => {
  const port = await freePort();
  const previousUrl = process.env.GEOAI_URL;
  const previousRetries = process.env.GEOAI_RETRIES;
  process.env.GEOAI_URL = `http://127.0.0.1:${port}`;
  process.env.GEOAI_RETRIES = '0';
  try {
    await expectRejection(client.analyzeSoil({}), 503, /injoignable|python3 geoai\/server\.py/);
    const health = await client.engineHealth();
    assert.equal(health.available, false);
  } finally {
    setEnv('GEOAI_URL', previousUrl);
    setEnv('GEOAI_RETRIES', previousRetries);
  }
});

/* ─────────────────── service Node (Prisma simulé) ─────────────────── */

test('SOIL-14 : les analyses de sol sont converties en prélèvements exploitables', () => {
  const samples = service.buildSamples([
    {
      id: 'sa_1',
      assessedAt: new Date('2026-08-01T00:00:00Z'),
      parameters: [
        { key: 'sand', numericValue: 48, value: '48', source: 'measured_lab' },
        { key: 'silt', numericValue: 30, value: '30', source: 'measured_lab' },
        { key: 'clay', numericValue: 22, value: '22', source: 'measured_lab' },
        { key: 'ph', numericValue: 6.2, value: '6.2', source: 'measured_lab' },
        { key: 'depthCm', numericValue: 20, value: '20', source: 'measured_lab' },
      ],
    },
    {
      id: 'sa_2',
      assessedAt: new Date('2026-08-01T00:00:00Z'),
      parameters: [{ key: 'texture', value: 'limono-argileux', source: 'declared' }],
    },
  ]);

  assert.equal(samples.length, 2);
  assert.equal(samples[0].clay, 22);
  assert.equal(samples[0].source, 'lab');
  assert.equal(samples[0].depthCm, 20);
  // La classe de texture déclarée est convertie en granulométrie représentative,
  // et marquée comme déclarée : ce n'est pas une mesure de laboratoire.
  assert.equal(samples[1].clay, 34);
  assert.equal(samples[1].source, 'declared');
});

test('GEO-01 : un diagnostic est calculé depuis les données réelles et conservé', async () => {
  const stub = await startStub((req, res, body) => {
    const payload = JSON.parse(body);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      plotId: payload.plot.id,
      engine: { name: 'agrikonnect-geoai', version: '1.0.0' },
      soil: { available: true, texture: { class: 'limon' } },
      subsoil: { available: true, horizons: [{ label: 'A' }] },
      satellite: { scenesAnalyzed: 0, latest: null, phenology: { available: true } },
      sensors: { moisture: { available: true, mean: 24.2 } },
      fusion: { sourcesUsed: ['lab', 'sensor'] },
      confidence: { score: 0.81, level: 'élevée' },
      caveats: [],
      recommendations: [],
      disclaimer: 'Diagnostic indicatif — ne constitue pas une certification.',
    }));
  });

  const previousUrl = process.env.GEOAI_URL;
  process.env.GEOAI_URL = stub.url;

  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      plot: [{ id: 'plot_1', organizationId: ORG, countryCode: 'CD', name: 'Parcelle 1', areaHa: 2.4, deletedAt: null }],
      soilAssessment: [{ id: 'sa_1', plotId: 'plot_1', assessedAt: new Date('2026-08-01T00:00:00Z'), deletedAt: null }],
      // Le double Prisma résout `include: { parameters: true }` via cette table.
      soilParameter: [
        { id: 'sp_1', assessmentId: 'sa_1', key: 'clay', numericValue: 30, value: '30', source: 'measured_lab' },
        { id: 'sp_2', assessmentId: 'sa_1', key: 'ph', numericValue: 6.2, value: '6.2', source: 'measured_lab' },
      ],
      iotDevice: [{ id: 'dev_1', organizationId: ORG, plotId: 'plot_1', label: 'Sonde 1', deletedAt: null }],
      sensorReading: [{ id: 'sr_1', deviceId: 'dev_1', metric: 'soil_moisture', value: 24.2, at: new Date('2026-09-01T00:00:00Z') }],
    }),
  );

  try {
    const result = await service.diagnose('plot_1', { declared: { ph: 6.3 } }, reqAs());
    assert.equal(result.diagnosis.plotId, 'plot_1');
    assert.equal(result.diagnosis.engineVersion, '1.0.0');
    assert.equal(result.diagnosis.methodVersion, service.METHOD_VERSION);
    assert.equal(result.diagnosis.confidence, 0.81);
    assert.equal(result.diagnosis.confidenceLevel, 'élevée');
    assert.deepEqual(result.diagnosis.sourcesUsed, ['lab', 'sensor']);
    assert.equal(result.plot.name, 'Parcelle 1');

    const saved = fake._store.soilDiagnostic[0];
    assert.equal(saved.result.soil.texture.class, 'limon');
    assert.equal(saved.inputs.samples, 1, 'les entrées sont résumées, jamais les matrices de pixels');
    assert.equal(saved.inputs.sensorReadings, 1);
    assert.deepEqual(saved.inputs.declared, ['ph']);

    const auditEntry = fake._store.auditLog.at(-1);
    assert.equal(auditEntry.action, 'soil.diagnostic.compute');
    assert.equal(auditEntry.resourceId, saved.id);
  } finally {
    restore();
    setEnv('GEOAI_URL', previousUrl);
    await stub.close();
  }
});

test('GEO-02 : sans aucune donnée, aucun diagnostic n’est inventé (422)', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({ plot: [{ id: 'plot_1', organizationId: ORG, countryCode: 'CD', deletedAt: null }] }),
  );
  try {
    await expectRejection(service.diagnose('plot_1', {}, reqAs()), 422, /Aucune donnée exploitable/);
  } finally {
    restore();
  }
});

test('GEO-03 : la parcelle reste isolée par tenant (404, jamais de fuite)', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({ plot: [{ id: 'plot_1', organizationId: 'org_autre', countryCode: 'CD', deletedAt: null }] }),
  );
  try {
    await expectRejection(service.diagnose('plot_1', { declared: { ph: 6 } }, reqAs()), 404, /introuvable/);
  } finally {
    restore();
  }
});

/* ─────────────────── bout en bout avec le VRAI moteur Python ─────────────────── */

test('SOIL-10 → SOIL-14 (bout en bout) : le moteur Python calcule réellement le diagnostic', async (t) => {
  const port = await freePort();
  const engine = spawn('python3', ['geoai/server.py', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: ROOT,
    env: { ...process.env, GEOAI_QUIET: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let ready = false;
  const previousUrl = process.env.GEOAI_URL;
  process.env.GEOAI_URL = `http://127.0.0.1:${port}`;

  try {
    for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 100));
      // eslint-disable-next-line no-await-in-loop
      const health = await client.engineHealth();
      ready = health.available === true;
    }
    if (!ready) {
      t.skip('moteur Python indisponible dans cet environnement');
      return;
    }

    const size = 6;
    const matrix = (value) => Array.from({ length: size }, () => Array.from({ length: size }, () => value));

    const result = await client.analyzeSoil({
      plot: { id: 'plot_e2e', areaHa: 3.1 },
      samples: [
        { depthCm: 0, thicknessCm: 20, sand: 48, silt: 30, clay: 22, ph: 6.1, organicMatter: 3.2, source: 'lab' },
        { depthCm: 20, thicknessCm: 30, sand: 44, silt: 28, clay: 28, ph: 6.4, organicMatter: 2.1, source: 'lab' },
        { depthCm: 50, thicknessCm: 40, sand: 30, silt: 26, clay: 44, ph: 6.9, organicMatter: 0.9, source: 'lab' },
      ],
      sensors: {
        moisture: [
          { at: '2026-09-01T06:00:00Z', value: 24.1 },
          { at: '2026-09-02T06:00:00Z', value: 24.4 },
          { at: '2026-09-03T06:00:00Z', value: 23.9 },
          { at: '2026-09-04T06:00:00Z', value: 24.6 },
        ],
      },
      scenes: [
        {
          scene: { id: 'S2-E2E', capturedAt: '2026-09-01T10:00:00Z', resolutionM: 10 },
          bands: { B2: matrix(0.05), B3: matrix(0.09), B4: matrix(0.12), B8: matrix(0.48), B11: matrix(0.22) },
        },
      ],
      declared: { ph: 5.8 },
    });

    // Le vrai moteur a bien tourné : texture USDA, horizons, indices spectraux.
    assert.equal(result.engine.name, 'agrikonnect-geoai');
    assert.ok(result.soil.available);
    assert.ok(['limon', 'limon argileux', 'limon sableux', 'limon fin'].includes(result.soil.texture.class));
    assert.ok(result.subsoil.horizons.length >= 2, 'les horizons de sous-sol sont segmentés');
    assert.ok(result.satellite.latest.indices.ndvi.available);
    assert.ok(result.satellite.latest.indices.ndvi.mean >= 0.59 && result.satellite.latest.indices.ndvi.mean <= 0.61,
      `NDVI attendu ≈ 0,60, obtenu ${result.satellite.latest.indices.ndvi.mean}`);
    assert.ok(result.sensors.moisture.available);
    assert.equal(result.recommendations.length, 0, 'aucune prescription sans jeu de règles validé');
    assert.match(result.disclaimer, /certification/);
  } finally {
    setEnv('GEOAI_URL', previousUrl);
    engine.kill('SIGTERM');
  }
});
