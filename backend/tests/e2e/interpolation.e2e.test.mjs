import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Recette de bout en bout — **base réelle + moteur Python réel** — de la chaîne
 * d'interpolation, phase 6 du cahier des charges.
 *
 * Ce que cette suite prouve, et qu'aucune autre ne prouve :
 *   - des mesures géolocalisées ingérées par l'API IoT réelle suffisent à
 *     produire une carte, **réellement écrite** dans `interpolated_maps` avec sa
 *     grille, son incertitude, son erreur « laisser une sonde dehors » et son
 *     diagnostic ;
 *   - une sonde aberrante est signalée **avec son motif chiffré**, et le motif
 *     ne cite aucun nombre absent des données rendues ;
 *   - moins de trois sondes → refus explicite et **rien en base** ;
 *   - la liste ne transporte pas la grille, la carte complète si.
 *
 * Les mesures passent par `POST /iot/ingest` et non par une écriture directe en
 * base : c'est la seule façon de prouver que le champ `position` traverse
 * réellement le pipeline d'ingestion jusqu'à la carte.
 */

const { startHarness } = await import('./support/harness.mjs');

// Ce fichier vit dans tests/e2e/ : trois remontées pour atteindre la racine.
const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const BASE_LON = 18.25;
const BASE_LAT = 0.048;

let h;
let engine;
let previousGeoaiUrl;
let engineLog = [];
let farmerToken;
let plotId;
let organizationId;
/** Clés d'appareil, dans l'ordre de création : l'index 4 recevra l'aberration. */
const deviceKeys = [];

const PASSWORD = 'MotDePasse!2026';
const FARMER_EMAIL = 'fermier-carte@agrikonnect.test';

const freePort = async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
};

const register = async ({ email, accountType = 'FARMER', firstName, lastName, phone }) => {
  const response = await h.request('POST', '/auth/register', {
    body: {
      accountType, firstName, lastName, email, password: PASSWORD,
      countryCode: 'CD', locale: 'fr', ...(phone ? { phone } : {}),
    },
  });
  assert.equal(response.status, 201, `inscription ${email} : ${JSON.stringify(response.body)}`);
};

const connect = async (email) => {
  const response = await h.request('POST', '/auth/login', { body: { identifier: email, password: PASSWORD } });
  assert.equal(response.status, 200, `connexion ${email} : ${JSON.stringify(response.body)}`);
  return response.body.data.session.accessToken;
};

/** Enregistre une sonde et renvoie sa clé d'ingestion. */
const createProbe = async (label) => {
  const response = await h.request('POST', '/iot/devices', {
    token: farmerToken,
    body: { label, plotId },
  });
  assert.equal(response.status, 201, `sonde ${label} : ${JSON.stringify(response.body)}`);
  return { id: response.body.data.device.id, key: response.body.data.deviceKey };
};

/** Ingère une mesure de pH géolocalisée, par l'API réelle. */
const ingestPh = async (key, value, coordinates) => {
  const response = await h.request('POST', '/iot/ingest', {
    body: {
      deviceKey: key,
      readings: [{
        metric: 'ph',
        value,
        unit: 'pH',
        depthCm: 30,
        position: { type: 'Point', coordinates },
        confidence: 'high',
        source: 'measured_sensor',
        mode: 'REAL',
      }],
    },
  });
  assert.equal(response.status, 201, `ingestion : ${JSON.stringify(response.body)}`);
};

before(async () => {
  h = await startHarness();

  const port = await freePort();
  engine = spawn('python3', ['geoai/server.py', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: ROOT,
    env: { ...process.env, GEOAI_QUIET: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  engineLog = [];
  engine.stderr.on('data', (chunk) => engineLog.push(String(chunk)));
  previousGeoaiUrl = process.env.GEOAI_URL;
  process.env.GEOAI_URL = `http://127.0.0.1:${port}`;

  const { engineHealth } = await import('../../src/integrations/geospatial.js');
  let ready = false;
  for (let attempt = 0; attempt < 80 && !ready; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 100));
    // eslint-disable-next-line no-await-in-loop
    ready = (await engineHealth()).available === true;
  }
  assert.equal(
    ready,
    true,
    `le moteur Python doit être joignable. cwd=${ROOT}, port=${port}, sortie : ${engineLog.join('') || '(vide)'}`,
  );

  await register({
    email: FARMER_EMAIL, firstName: 'Esther', lastName: 'Lokwa', phone: '+243810000444',
  });
  farmerToken = await connect(FARMER_EMAIL);

  const farm = await h.request('POST', '/farms', {
    token: farmerToken,
    body: {
      name: 'Ferme kartographie', countryCode: 'CD', province: 'Bandundu',
      latitude: -3.3, longitude: 17.4, totalAreaHa: 12,
    },
  });
  assert.equal(farm.status, 201, JSON.stringify(farm.body));
  const farmId = farm.body.data.id ?? farm.body.data.farm?.id;

  const plot = await h.request('POST', '/plots', {
    token: farmerToken,
    body: {
      farmId,
      name: 'Parcelle kartographie',
      geometry: {
        type: 'Polygon',
        coordinates: [[[18.249, 0.047], [18.253, 0.047], [18.253, 0.051], [18.249, 0.051], [18.249, 0.047]]],
      },
      status: 'FALLOW',
    },
  });
  assert.equal(plot.status, 201, JSON.stringify(plot.body));
  plotId = plot.body.data.id ?? plot.body.data.plot?.id;
  organizationId = (await h.prisma.plot.findUnique({ where: { id: plotId } })).organizationId;

  // Neuf sondes sur une grille d'environ 110 m, ingérées par l'API réelle.
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      // eslint-disable-next-line no-await-in-loop
      const probe = await createProbe(`Sonde pH ${row}${col}`);
      deviceKeys.push(probe);
      // eslint-disable-next-line no-await-in-loop
      await ingestPh(
        probe.key,
        Number((6.0 + 0.0111 * col).toFixed(4)),
        [Number((BASE_LON + col * 0.001).toFixed(6)), Number((BASE_LAT + row * 0.001).toFixed(6))],
      );
    }
  }

  const readings = await h.prisma.sensorReading.findMany({ where: { plotId, metric: 'ph' } });
  assert.equal(readings.length, 9, 'les neuf mesures doivent être ingérées');
  assert.ok(
    readings.every((reading) => reading.position?.type === 'Point'),
    'le champ position doit traverser l’ingestion',
  );
}, { timeout: 240_000 });

after(async () => {
  if (engine) engine.kill('SIGTERM');
  if (previousGeoaiUrl === undefined) delete process.env.GEOAI_URL;
  else process.env.GEOAI_URL = previousGeoaiUrl;
  await h?.stop();
});

test('Carte : neuf sondes réelles produisent une carte persistée avec incertitude', async () => {
  const response = await h.request('POST', `/geospatial/interpolations/${plotId}/ph`, {
    token: farmerToken,
    body: { resolutionM: 25 },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));

  const data = response.body.data;
  assert.equal(data.sufficient, true, `carte attendue : ${data.reason}`);
  assert.equal(data.sondesUsed, 9);
  assert.deepEqual(data.sources, ['measured_sensor']);

  const rows = await h.prisma.interpolatedMap.findMany({ where: { plotId, parameter: 'ph' } });
  assert.equal(rows.length, 1, 'la carte doit être écrite en base');
  const row = rows[0];

  assert.equal(row.method, 'ordinary-kriging');
  assert.equal(row.organizationId, organizationId);
  assert.equal(row.depthCm, 30);
  assert.equal(row.mode, 'REAL');
  assert.ok(row.gridSize > 0);
  assert.equal(row.values.cells.length, row.gridSize);

  // Chaque cellule porte son incertitude : c'est l'exigence centrale de la phase 6.
  for (const cell of row.values.cells) {
    assert.equal(typeof cell.sd, 'number');
    assert.ok(cell.sd >= 0);
  }
  assert.equal(row.uncertainty.sdMin, 0, 'nulle sur les sondes');
  assert.ok(row.uncertainty.sdMax > 0, 'positive entre les sondes');

  assert.equal(row.uncertainty.crossValidation.method, 'leave-one-probe-out');
  assert.equal(row.uncertainty.crossValidation.n, 9);
  assert.ok(row.leaveOneOutMae < 0.02, `champ régulier, erreur attendue faible : ${row.leaveOneOutMae}`);
  assert.ok(Math.abs(row.uncertainty.crossValidation.meanError) < 1e-6, 'krigeage non biaisé');

  // Le diagnostic rend chaque nombre vérifiable.
  assert.equal(row.diagnostics.locationCount, 9);
  assert.equal(row.diagnostics.pairCount, 36);
  assert.ok(row.diagnostics.variogram.rangeM > 0);
  assert.equal(row.diagnostics.ingestion.readingsScanned, 9);

  assert.deepEqual(row.outliers, [], 'aucune aberration sur un champ régulier');

  const audits = await h.prisma.auditLog.findMany({ where: { resourceId: row.id } });
  assert.ok(audits.some((item) => item.action === 'interpolatedMap.create'));
});

test('Carte : la liste ne transporte pas la grille, la carte complète si', async () => {
  const list = await h.request('GET', `/geospatial/interpolations/${plotId}`, { token: farmerToken });
  assert.equal(list.status, 200, JSON.stringify(list.body));
  assert.equal(list.body.data.count, 1);

  const summary = list.body.data.items[0];
  assert.equal(summary.values, undefined, 'la grille ne part pas en liste : elle compte des milliers de cellules');
  assert.ok('outliers' in summary, 'mais les aberrations restent visibles');
  assert.ok('leaveOneOutMae' in summary);

  const full = await h.request('GET', `/geospatial/interpolations/map/${summary.id}`, { token: farmerToken });
  assert.equal(full.status, 200, JSON.stringify(full.body));
  assert.ok(full.body.data.values.cells.length > 0, 'la carte complète porte sa grille');
});

test('Carte : une sonde aberrante est signalée avec son motif', async () => {
  /**
   * Une dixième sonde, manifestement fausse, à un emplacement **distinct**.
   *
   * Placée exactement sur une sonde existante, elle serait moyennée avec elle
   * (points confondus à moins d'un mètre) et l'identifiant rendu serait la
   * concaténation des deux appareils. Ce comportement est correct et testé côté
   * Python ; ici on teste l'aberration d'une sonde isolée.
   */
  const probe = await createProbe('Sonde pH suspecte');
  await ingestPh(probe.key, 9.9, [Number((BASE_LON + 0.0005).toFixed(6)), Number((BASE_LAT + 0.0015).toFixed(6))]);

  const response = await h.request('POST', `/geospatial/interpolations/${plotId}/ph`, {
    token: farmerToken,
    body: { resolutionM: 25 },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));

  const rows = await h.prisma.interpolatedMap.findMany({
    where: { plotId, parameter: 'ph' }, orderBy: { computedAt: 'desc' },
  });
  const latest = rows[0];

  assert.equal(latest.outliers.length, 1, `une aberration attendue : ${JSON.stringify(latest.outliers)}`);
  const outlier = latest.outliers[0];
  assert.equal(outlier.id, probe.id);
  assert.equal(outlier.observed, 9.9);
  assert.ok(outlier.standardizedError >= outlier.threshold);

  // Chaque nombre du motif doit exister dans les données rendues — sinon le
  // moteur invente, et l'explication n'est plus vérifiable.
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

  // L'aberration qualifie la carte, elle ne l'invalide pas.
  assert.ok(latest.gridSize > 0);
  assert.ok(latest.leaveOneOutMae > 0.5, 'la validation croisée révèle l’aberration');
});

test('Carte : deux sondes → refus explicite et rien en base', async () => {
  // Nouvelle parcelle, deux sondes seulement.
  const plotRecord = await h.prisma.plot.findUnique({ where: { id: plotId } });
  const sparse = await h.request('POST', '/plots', {
    token: farmerToken,
    body: {
      farmId: plotRecord.farmId,
      name: 'Parcelle peu équipée',
      geometry: { type: 'Point', coordinates: [18.3, 0.06] },
      status: 'FALLOW',
    },
  });
  assert.equal(sparse.status, 201, JSON.stringify(sparse.body));
  const sparsePlotId = sparse.body.data.id ?? sparse.body.data.plot?.id;

  for (let index = 0; index < 2; index += 1) {
    const probe = await h.request('POST', '/iot/devices', {
      token: farmerToken,
      body: { label: `Sonde isolée ${index}`, plotId: sparsePlotId },
    });
    // eslint-disable-next-line no-await-in-loop
    await h.request('POST', '/iot/ingest', {
      body: {
        deviceKey: probe.body.data.deviceKey,
        readings: [{
          metric: 'ph', value: 6.2 + index * 0.1, unit: 'pH', depthCm: 30,
          position: { type: 'Point', coordinates: [18.3 + index * 0.001, 0.06] },
          source: 'measured_sensor', mode: 'REAL',
        }],
      },
    });
  }

  const before = await h.prisma.interpolatedMap.count({ where: { plotId: sparsePlotId } });
  const response = await h.request('POST', `/geospatial/interpolations/${sparsePlotId}/ph`, {
    token: farmerToken,
    body: {},
  });

  // 200 et non 201 : « pas assez de sondes » est une réponse, pas une erreur.
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.data.sufficient, false);
  assert.equal(response.body.data.grid, null);
  assert.match(response.body.data.reason, /3/);

  const after = await h.prisma.interpolatedMap.count({ where: { plotId: sparsePlotId } });
  assert.equal(after, before, 'aucune carte ne doit être inventée');
});

test('Carte : un paramètre non interpolable est refusé (422)', async () => {
  const response = await h.request('POST', `/geospatial/interpolations/${plotId}/texture`, {
    token: farmerToken,
    body: {},
  });
  assert.equal(response.status, 422, JSON.stringify(response.body));
});

test('Carte : l’évaluation seule ne produit pas de carte', async () => {
  const before = await h.prisma.interpolatedMap.count({ where: { plotId } });
  const response = await h.request('POST', `/geospatial/interpolations/${plotId}/ph/evaluate`, {
    token: farmerToken,
    body: {},
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.data.sufficient, true);
  assert.equal(response.body.data.crossValidation.method, 'leave-one-probe-out');
  assert.equal(response.body.data.grid, undefined, 'aucune carte produite');

  const after = await h.prisma.interpolatedMap.count({ where: { plotId } });
  assert.equal(after, before, 'l’évaluation n’écrit rien');
});

test('Carte : la parcelle d’une autre organisation est invisible (404)', async () => {
  await register({ email: 'tiers-carte@agrikonnect.test', firstName: 'Paulin', lastName: 'Ilunga' });
  const otherToken = await connect('tiers-carte@agrikonnect.test');

  const compute = await h.request('POST', `/geospatial/interpolations/${plotId}/ph`, {
    token: otherToken,
    body: {},
  });
  assert.equal(compute.status, 404, JSON.stringify(compute.body));

  const list = await h.request('GET', `/geospatial/interpolations/${plotId}`, { token: otherToken });
  assert.equal(list.status, 404, JSON.stringify(list.body));
});
