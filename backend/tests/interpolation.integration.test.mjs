/**
 * Contrat Node ⇄ Python pour l'interpolation, et persistance des cartes.
 *
 * Trois niveaux :
 *  1. **contrat réel** — le vrai moteur `geoai/server.py` est lancé, et l'on
 *     vérifie que sa réponse a exactement la forme que le service consomme ;
 *  2. **service Node** sur Prisma simulé — sélection des mesures, persistance,
 *     refus d'écrire quand les sondes sont insuffisantes ;
 *  3. **règles de sélection** — une mesure par sonde, un horizon par carte.
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
import * as service from '../src/modules/geospatial/interpolation.service.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ORG = 'org_1';
const BASE_LON = 18.25;
const BASE_LAT = 0.048;
const NOW = Date.parse('2026-09-01T00:00:00Z');
const DAY = 86_400_000;

const point = (lon, lat) => ({ type: 'Point', coordinates: [lon, lat] });

/** Neuf sondes géolocalisées sur une grille d'environ 110 m. */
const probes = () => {
  const rows = [];
  let k = 0;
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      rows.push({
        id: `sr_${k}`,
        organizationId: ORG,
        plotId: 'plot_carte',
        deviceId: `device_${k}`,
        metric: 'ph',
        value: Number((6.0 + 0.0111 * c).toFixed(4)),
        unit: 'pH',
        source: 'measured_sensor',
        confidence: 'high',
        at: new Date(NOW),
        depthCm: 30,
        mode: 'REAL',
        position: point(BASE_LON + c * 0.001, BASE_LAT + r * 0.001),
      });
      k += 1;
    }
  }
  return rows;
};

const store = (overrides = {}) => ({
  plot: [{ id: 'plot_carte', organizationId: ORG, farmId: 'farm_1', name: 'Parcelle carte', deletedAt: null }],
  sensorReading: [],
  sensorAnomaly: [],
  iotDevice: [],
  interpolatedMap: [],
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

/** Lance le moteur Python pour la durée d'un test. */
const withEngine = async (t) => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));

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
    ready = (await client.engineHealth()).available === true;
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

/* ─────────────────── contrat réel avec le moteur ─────────────────── */

test('Contrat Node⇄Python : la carte rend exactement la forme attendue', async (t) => {
  const stop = await withEngine(t);
  if (!stop) return;

  try {
    const result = await client.interpolateGrid({
      parameter: 'ph',
      points: probes().map((reading) => ({
        id: reading.deviceId,
        coordinates: reading.position.coordinates,
        value: reading.value,
        source: reading.source,
      })),
      resolutionM: 25,
    });

    // Champs que le service lit réellement : leur absence casserait la persistance.
    assert.equal(result.sufficient, true);
    assert.equal(result.method, 'ordinary-kriging');
    assert.equal(result.uncertainty, 'kriging-standard-deviation');
    assert.ok(Array.isArray(result.outliers));
    assert.ok(Array.isArray(result.sources));

    const grid = result.grid;
    for (const field of ['bbox', 'columns', 'rows', 'resolutionM', 'cellCount', 'cells']) {
      assert.ok(field in grid, `champ grid.${field} manquant`);
    }
    for (const cell of grid.cells) {
      assert.equal(typeof cell.lon, 'number');
      assert.equal(typeof cell.lat, 'number');
      assert.equal(typeof cell.value, 'number');
      assert.equal(typeof cell.sd, 'number', 'l’incertitude accompagne chaque cellule');
      assert.ok(cell.sd >= 0);
    }
    assert.equal(grid.cellCount, grid.cells.length);

    // L'incertitude doit être informative : nulle sur les sondes, positive entre elles.
    assert.equal(grid.sdMin, 0);
    assert.ok(grid.sdMax > 0, 'l’incertitude doit distinguer les zones couvertes des autres');

    const cross = result.crossValidation;
    assert.equal(cross.method, 'leave-one-probe-out');
    assert.equal(cross.n, 9);
    assert.equal(typeof cross.mae, 'number');
    assert.ok(Math.abs(cross.meanError) < 1e-6, 'le krigeage ordinaire est non biaisé');

    assert.equal(result.diagnostics.locationCount, 9);
    assert.deepEqual(result.diagnostics.rejectedPoints, []);
    assert.ok(result.diagnostics.variogram.rangeM > 0);

    // La grille reste à l'intérieur des valeurs mesurées : elle interpole.
    for (const cell of grid.cells) {
      assert.ok(cell.value >= result.observed.min - 1e-9);
      assert.ok(cell.value <= result.observed.max + 1e-9);
    }
  } finally {
    stop();
  }
});

test('Contrat Node⇄Python : deux sondes → sufficient:false, aucune grille', async (t) => {
  const stop = await withEngine(t);
  if (!stop) return;

  try {
    const result = await client.interpolateGrid({
      parameter: 'ph',
      points: probes().slice(0, 2).map((reading) => ({
        id: reading.deviceId,
        coordinates: reading.position.coordinates,
        value: reading.value,
      })),
    });

    assert.equal(result.sufficient, false);
    assert.equal(result.grid, null, 'aucune grille de substitution');
    assert.equal(typeof result.reason, 'string');
    assert.match(result.reason, /3/);
    assert.deepEqual(result.outliers, []);
    assert.equal(result.crossValidation, null);
  } finally {
    stop();
  }
});

test('Contrat Node⇄Python : une sonde aberrante est signalée avec son motif', async (t) => {
  const stop = await withEngine(t);
  if (!stop) return;

  try {
    const points = probes().map((reading, index) => ({
      id: reading.deviceId,
      coordinates: reading.position.coordinates,
      value: index === 4 ? 9.9 : reading.value,
      source: 'measured_sensor',
    }));
    const result = await client.interpolateGrid({ parameter: 'ph', points });

    assert.equal(result.outliers.length, 1);
    const outlier = result.outliers[0];
    assert.equal(outlier.id, 'device_4');
    assert.equal(outlier.observed, 9.9);
    assert.ok(outlier.standardizedError >= outlier.threshold);

    // Chaque nombre du motif doit exister dans les données rendues.
    const numbers = outlier.reason
      .replace(/[(),]/g, ' ')
      .split(/\s+/)
      .filter((token) => /^-?\d+(\.\d+)?$/.test(token))
      .map(Number);
    assert.ok(numbers.length >= 4, `motif trop pauvre : ${outlier.reason}`);
    const allowed = ['observed', 'predicted', 'error', 'stdDev', 'standardizedError', 'threshold']
      .map((field) => outlier[field]);
    for (const number of numbers) {
      assert.ok(
        allowed.some((value) => Math.abs(value - number) < 1e-6),
        `le nombre ${number} du motif ne correspond à aucune donnée rendue`,
      );
    }
  } finally {
    stop();
  }
});

test('Contrat Node⇄Python : les seuils publiés sont ceux appliqués', async (t) => {
  const stop = await withEngine(t);
  if (!stop) return;

  try {
    const meta = await client.engineMeta();
    const thresholds = meta.thresholds?.interpolation;
    assert.ok(thresholds, 'le moteur doit publier ses seuils d’interpolation');
    assert.equal(thresholds.minPoints, 3);
    assert.equal(typeof thresholds.minSpreadM, 'number');
    assert.equal(typeof thresholds.outlierZ, 'number');

    // Le seuil publié explique réellement le refus.
    const justBelow = await client.interpolateGrid({
      parameter: 'ph',
      points: probes().slice(0, thresholds.minPoints - 1).map((r) => ({
        id: r.deviceId, coordinates: r.position.coordinates, value: r.value,
      })),
    });
    assert.equal(justBelow.sufficient, false);

    const atThreshold = await client.interpolateGrid({
      parameter: 'ph',
      points: probes().slice(0, thresholds.minPoints).map((r) => ({
        id: r.deviceId, coordinates: r.position.coordinates, value: r.value,
      })),
    });
    assert.equal(atThreshold.sufficient, true, 'trois sondes suffisent, comme annoncé');

    assert.equal(meta.endpoints['/v1/interpolation/grid'], 'POST');
    assert.equal(meta.endpoints['/v1/interpolation/loo'], 'POST');
  } finally {
    stop();
  }
});

/* ─────────────────── service Node : sélection des mesures ─────────────────── */

test('Sélection : une seule mesure par sonde, la plus récente', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      sensorReading: [
        // Trois remontées de la même sonde : seule la dernière compte.
        { ...probes()[0], id: 'sr_old', at: new Date(NOW - 10 * DAY), value: 4.0 },
        { ...probes()[0], id: 'sr_mid', at: new Date(NOW - 5 * DAY), value: 5.0 },
        { ...probes()[0], id: 'sr_new', at: new Date(NOW), value: 6.0 },
        ...probes().slice(1),
      ],
    }),
  );
  try {
    const selection = await service.buildInterpolationPoints('plot_carte', 'ph');
    assert.equal(selection.points.length, 9, 'neuf sondes, pas onze mesures');
    const first = selection.points.find((item) => item.id === 'device_0');
    assert.equal(first.value, 6.0, 'la mesure la plus récente prime');
    assert.equal(selection.seriesReadingsDropped, 2, 'les mesures plus anciennes sont déclarées');
  } finally {
    restore();
  }
});

test('Sélection : les mesures simulées et non géolocalisées sont exclues', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      sensorReading: [
        ...probes(),
        { ...probes()[0], id: 'sr_sim', deviceId: 'device_sim', mode: 'SIMULATED' },
        { ...probes()[1], id: 'sr_sansgps', deviceId: 'device_nogps', position: null },
      ],
    }),
  );
  try {
    const selection = await service.buildInterpolationPoints('plot_carte', 'ph');
    assert.equal(selection.points.length, 9);
    assert.ok(!selection.points.some((item) => item.id === 'device_sim'));
    assert.ok(!selection.points.some((item) => item.id === 'device_nogps'));
  } finally {
    restore();
  }
});

test('Sélection : un horizon par carte, et ce qui est écarté est déclaré', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      sensorReading: [
        ...probes(),
        // Deux sondes supplémentaires à 60 cm : un autre horizon.
        { ...probes()[0], id: 'sr_deep1', deviceId: 'device_deep1', depthCm: 60, value: 5.1 },
        { ...probes()[1], id: 'sr_deep2', deviceId: 'device_deep2', depthCm: 60, value: 5.2 },
      ],
    }),
  );
  try {
    const selection = await service.buildInterpolationPoints('plot_carte', 'ph');
    assert.equal(selection.depthCm, 30, 'la profondeur dominante est retenue');
    assert.equal(selection.excludedForDepth, 2, 'l’autre horizon est écarté et compté');
    assert.equal(selection.points.length, 9);
    assert.deepEqual(selection.depthsSeen.sort(), [30, 60]);
  } finally {
    restore();
  }
});

test('Sélection : une profondeur demandée filtre exactement', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      sensorReading: [
        ...probes(),
        { ...probes()[0], id: 'sr_deep1', deviceId: 'device_deep1', depthCm: 60, value: 5.1 },
        { ...probes()[1], id: 'sr_deep2', deviceId: 'device_deep2', depthCm: 60, value: 5.2 },
        { ...probes()[2], id: 'sr_deep3', deviceId: 'device_deep3', depthCm: 60, value: 5.3 },
      ],
    }),
  );
  try {
    const selection = await service.buildInterpolationPoints('plot_carte', 'ph', { depthCm: 60 });
    assert.equal(selection.depthCm, 60);
    assert.equal(selection.points.length, 3);
    assert.ok(selection.points.every((item) => item.value > 5 && item.value < 6));
  } finally {
    restore();
  }
});

test('Sélection : un paramètre non interpolable est refusé avant tout appel', async () => {
  const { restore } = await withFakePrisma(prisma, store());
  try {
    await assert.rejects(
      service.interpolateForPlot('plot_carte', 'texture', {}, reqAs()),
      (error) => {
        assert.equal(error.status, 422);
        assert.match(error.message, /non interpolable/);
        return true;
      },
    );
    assert.ok(!service.INTERPOLABLE_PARAMETERS.includes('texture'));
  } finally {
    restore();
  }
});

test('Sélection : la parcelle d’une autre organisation est invisible (404)', async () => {
  const { restore } = await withFakePrisma(prisma, store({ sensorReading: probes() }));
  try {
    await assert.rejects(
      service.interpolateForPlot('plot_carte', 'ph', {}, reqAs(['FARMER'], 'u2', 'org_autre')),
      (error) => {
        assert.equal(error.status, 404);
        return true;
      },
    );
    await assert.rejects(
      service.listMaps('plot_carte', {}, reqAs(['FARMER'], 'u2', 'org_autre')),
      (error) => error.status === 404,
    );
  } finally {
    restore();
  }
});

/* ─────────────────── persistance avec moteur réel ─────────────────── */

test('Carte : les sondes réelles produisent une carte persistée, avec son diagnostic', async (t) => {
  const stop = await withEngine(t);
  if (!stop) return;

  const { fake, restore } = await withFakePrisma(prisma, store({ sensorReading: probes() }));
  try {
    const result = await service.interpolateForPlot('plot_carte', 'ph', { resolutionM: 25 }, reqAs());

    assert.equal(result.sufficient, true, `carte attendue : ${result.reason}`);
    assert.equal(result.sondesUsed, 9);
    assert.deepEqual(result.sources, ['measured_sensor']);

    assert.equal(fake._store.interpolatedMap.length, 1, 'la carte doit être écrite');
    const row = fake._store.interpolatedMap[0];
    assert.equal(row.parameter, 'ph');
    assert.equal(row.plotId, 'plot_carte');
    assert.equal(row.organizationId, ORG);
    assert.equal(row.depthCm, 30);
    assert.equal(row.method, 'ordinary-kriging');
    assert.equal(row.mode, 'REAL');
    assert.ok(row.gridSize > 0);
    assert.equal(row.values.cells.length, row.gridSize);
    assert.equal(row.uncertainty.method, 'kriging-standard-deviation');
    assert.ok(row.uncertainty.sdMax > 0);
    assert.equal(row.uncertainty.crossValidation.method, 'leave-one-probe-out');
    assert.equal(typeof row.leaveOneOutMae, 'number');

    // Le diagnostic permet de vérifier chaque nombre d'une explication future.
    assert.equal(row.diagnostics.locationCount, 9);
    assert.equal(row.diagnostics.pairCount, 36);
    assert.ok(row.diagnostics.variogram.rangeM > 0);
    assert.equal(row.diagnostics.ingestion.readingsScanned, 9);

    assert.deepEqual(row.outliers, [], 'aucune aberration sur un champ régulier');

    const auditRow = fake._store.auditLog.find((item) => item.action === 'interpolatedMap.create');
    assert.ok(auditRow, 'la création doit être auditée');
    assert.equal(auditRow.newValue.sondesUsed, 9);
  } finally {
    restore();
    stop();
  }
});

test('Carte : une sonde aberrante est persistée avec son motif', async (t) => {
  const stop = await withEngine(t);
  if (!stop) return;

  const readings = probes();
  readings[4].value = 9.9;

  const { fake, restore } = await withFakePrisma(prisma, store({ sensorReading: readings }));
  try {
    const result = await service.interpolateForPlot('plot_carte', 'ph', { resolutionM: 25 }, reqAs());

    assert.equal(result.outliers.length, 1);
    assert.equal(fake._store.interpolatedMap[0].outliers.length, 1);
    assert.equal(fake._store.interpolatedMap[0].outliers[0].id, 'device_4');
    // L'aberration n'invalide pas la carte : elle la qualifie.
    assert.ok(fake._store.interpolatedMap[0].gridSize > 0);
    assert.ok(
      fake._store.interpolatedMap[0].leaveOneOutMae > 0.5,
      'la validation croisée révèle l’aberration dans l’erreur globale',
    );
  } finally {
    restore();
    stop();
  }
});

test('Carte : deux sondes → rien n’est persisté', async (t) => {
  const stop = await withEngine(t);
  if (!stop) return;

  const { fake, restore } = await withFakePrisma(prisma, store({ sensorReading: probes().slice(0, 2) }));
  try {
    const result = await service.interpolateForPlot('plot_carte', 'ph', {}, reqAs());

    assert.equal(result.sufficient, false);
    assert.ok(result.reason.length > 10, 'le motif est renvoyé à l’appelant');
    assert.equal(result.grid, null, 'aucune grille de substitution');
    assert.equal(fake._store.interpolatedMap.length, 0, 'aucune carte ne doit être créée');
    assert.equal(
      fake._store.auditLog.filter((item) => item.action === 'interpolatedMap.create').length,
      0,
      'rien à auditer puisqu’il n’y a rien d’écrit',
    );
  } finally {
    restore();
    stop();
  }
});

test('Évaluation : la validation croisée seule n’écrit rien', async (t) => {
  const stop = await withEngine(t);
  if (!stop) return;

  const { fake, restore } = await withFakePrisma(prisma, store({ sensorReading: probes() }));
  try {
    const result = await service.evaluateForPlot('plot_carte', 'ph', {}, reqAs());

    assert.equal(result.sufficient, true);
    assert.equal(result.crossValidation.method, 'leave-one-probe-out');
    assert.equal(result.crossValidation.n, 9);
    assert.equal(result.sondesUsed, 9);
    assert.equal(result.grid, undefined, 'aucune carte produite');
    assert.deepEqual(fake._store.interpolatedMap, []);
  } finally {
    restore();
    stop();
  }
});

/**
 * La restriction de colonnes en liste (`select`) ne peut pas être prouvée ici :
 * `fakePrisma` ignore `select` et renvoie la ligne complète. L'assertion vit
 * dans la recette de bout en bout, contre le vrai Prisma — c'est le seul endroit
 * où elle signifie quelque chose.
 */
test('Liste : les cartes sont rendues par parcelle, les aberrations visibles', async (t) => {
  const stop = await withEngine(t);
  if (!stop) return;

  const { restore } = await withFakePrisma(prisma, store({ sensorReading: probes() }));
  try {
    const created = await service.interpolateForPlot('plot_carte', 'ph', { resolutionM: 25 }, reqAs());

    const list = await service.listMaps('plot_carte', {}, reqAs());
    assert.equal(list.count, 1);
    assert.equal(list.plotId, 'plot_carte');

    const full = await service.getMap(created.map.id, reqAs());
    assert.ok(full.values.cells.length > 0, 'la carte complète porte sa grille');

    await assert.rejects(
      service.getMap(created.map.id, reqAs(['FARMER'], 'u2', 'org_autre')),
      (error) => error.status === 404,
      'une carte d’un autre tenant n’existe pas',
    );
  } finally {
    restore();
    stop();
  }
});
