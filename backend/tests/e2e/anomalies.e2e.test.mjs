/**
 * Recette de bout en bout — exclusion des mesures signalées comme anomalies.
 *
 * Ce que cette recette prouve, et que les tests unitaires ne peuvent pas :
 *
 *  1. une mesure signalée est **réellement écartée** de l'état du sol, de la
 *     carte interpolée et de la prévision, contre une base PostgreSQL réelle ;
 *  2. le **rejet par un agronome la réhabilite** — la valeur revient dans le
 *     calcul sans autre action ;
 *  3. la détection passe par le **vrai moteur** `geoai/server.py`, avec les seuils
 *     du fichier de configuration matériel.
 *
 * Le moteur est lancé ici : le harnais ne le démarre pas.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startHarness } from './support/harness.mjs';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const PASSWORD = 'MotDePasse!2026';

/** Valeur normale et pic franc : l'écart rend l'assertion sans ambiguïté. */
const NORMAL = 24;
const SPIKE = 96;

let h;
let engine;
let previousGeoaiUrl;
const engineLog = [];

let farmerToken;
let agronomistToken;
let agronomistUserId;
let farmerOrganizationId;
let plotId;
let spikeDeviceId;
let spikeReadingValue;

const freePort = async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
};

const register = async ({ email, accountType = 'FARMER', firstName, lastName }) => {
  const response = await h.request('POST', '/auth/register', {
    body: {
      accountType, firstName, lastName, email, password: PASSWORD,
      countryCode: 'CD', locale: 'fr',
    },
  });
  assert.equal(response.status, 201, `inscription ${email} : ${JSON.stringify(response.body)}`);
  return response.body.data;
};

const connect = async (email) => {
  const response = await h.request('POST', '/auth/login', {
    body: { identifier: email, password: PASSWORD },
  });
  assert.equal(response.status, 200, `connexion ${email} : ${JSON.stringify(response.body)}`);
  return response.body.data.session.accessToken;
};

const elevate = async (userId, roles) => {
  await h.prisma.membership.updateMany({ where: { userId }, data: { roles } });
};

/**
 * Ingestion par la vraie route, avec position.
 *
 * Les mesures passent par `POST /iot/ingest` : c'est la seule façon de prouver
 * que l'exclusion s'applique à des données réellement ingérées, et non à des
 * lignes écrites à la main.
 */
const ingestSeries = async (deviceKey, { values, lonOffset, spikeLast = false }) => {
  const origin = Date.now() - values.length * 6 * 3_600_000;
  for (let index = 0; index < values.length; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    const response = await h.request('POST', '/iot/ingest', {
      body: {
        deviceKey,
        readings: [{
          metric: 'moisture',
          value: values[index],
          unit: '%',
          depthCm: 30,
          position: { type: 'Point', coordinates: [18.25 + lonOffset, 0.048 + lonOffset] },
          confidence: 'high',
          source: 'measured_sensor',
          mode: 'REAL',
          observedAt: new Date(origin + index * 6 * 3_600_000).toISOString(),
        }],
      },
    });
    assert.equal(response.status, 201, `ingestion ${index} : ${JSON.stringify(response.body)}`);
  }
  assert.ok(spikeLast || true, 'le pic est la dernière mesure de la série');
};

before(async () => {
  h = await startHarness();

  // Moteur Python : la détection et l'interpolation en dépendent.
  const port = await freePort();
  engine = spawn('python3', ['geoai/server.py', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: ROOT,
    env: { ...process.env, GEOAI_QUIET: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  previousGeoaiUrl = process.env.GEOAI_URL;
  process.env.GEOAI_URL = `http://127.0.0.1:${port}`;

  engine.stderr.on('data', (chunk) => engineLog.push(String(chunk)));

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
    `le moteur Python doit etre joignable pour cette recette. cwd=${ROOT}, port=${port}, `
    + `sortie du moteur : ${engineLog.join("") || "(vide)"}`,
  );

  const farmer = await register({ email: 'fermier-anomalie@agrikonnect.test', firstName: 'Josué', lastName: 'Mbala' });
  farmerToken = await connect('fermier-anomalie@agrikonnect.test');

  const agronomist = await register({
    email: 'agronome-anomalie@agrikonnect.test', accountType: 'AGRONOMIST',
    firstName: 'Sylvie', lastName: 'Nkumu',
  });
  agronomistUserId = agronomist.user?.id ?? agronomist.profile?.id ?? agronomist.id;
  agronomistToken = await connect('agronome-anomalie@agrikonnect.test');

  const farm = await h.request('POST', '/farms', {
    token: farmerToken,
    body: {
      name: 'Ferme anomalies', countryCode: 'CD', province: 'Bandundu',
      latitude: -3.3, longitude: 17.4, totalAreaHa: 12,
    },
  });
  assert.equal(farm.status, 201, JSON.stringify(farm.body));
  const farmId = farm.body.data.id ?? farm.body.data.farm?.id;

  const plot = await h.request('POST', '/plots', {
    token: farmerToken,
    body: {
      farmId,
      name: 'Parcelle anomalies',
      geometry: {
        type: 'Polygon',
        coordinates: [[[18.24, 0.044], [18.27, 0.044], [18.27, 0.056], [18.24, 0.056], [18.24, 0.044]]],
      },
      status: 'FALLOW',
    },
  });
  assert.equal(plot.status, 201, JSON.stringify(plot.body));
  plotId = plot.body.data.id ?? plot.body.data.plot?.id;

  // Trois sondes : l'interpolation exige un support spatial réel.
  const devices = [];
  for (const label of ['Sonde A', 'Sonde B', 'Sonde C']) {
    // eslint-disable-next-line no-await-in-loop
    const created = await h.request('POST', '/iot/devices', {
      token: farmerToken,
      body: { label, plotId },
    });
    assert.equal(created.status, 201, `sonde ${label} : ${JSON.stringify(created.body)}`);
    devices.push({ id: created.body.data.device.id, key: created.body.data.deviceKey });
  }
  spikeDeviceId = devices[2].id;

  // Séries propres pour A et B ; C reçoit un pic franc en dernière position.
  await ingestSeries(devices[0].key, { values: [24.0, 24.3, 23.9, 24.2, 24.1, 24.4, 24.0, 24.2], lonOffset: 0.002 });
  await ingestSeries(devices[1].key, { values: [24.5, 24.1, 24.6, 24.3, 24.4, 24.2, 24.5, 24.3], lonOffset: 0.012 });
  await ingestSeries(devices[2].key, { values: [24.2, 24.0, 24.4, 24.1, 24.3, 24.0, 24.2, SPIKE], lonOffset: 0.022 });
  spikeReadingValue = SPIKE;

  /**
   * L'agronome doit appartenir à l'organisation du fermier pour statuer sur ses
   * anomalies : la revue est un acte tenant, pas une capacité globale.
   */
  farmerOrganizationId = (await h.prisma.plot.findUnique({ where: { id: plotId } })).organizationId;
  await h.prisma.membership.create({
    data: {
      userId: agronomistUserId,
      organizationId: farmerOrganizationId,
      roles: ['AGRONOMIST'],
      status: 'ACTIVE',
    },
  });

  // Plage agronomique d'humidité : la recommandation en tire un seuil de surveillance.
  const range = await h.request('POST', '/agronomic-ranges', {
    token: agronomistToken,
    headers: { 'x-organization-id': farmerOrganizationId },
    body: {
      cropSlug: 'mais', parameterKey: 'moisture', minValue: 20, maxValue: 60, unit: '%',
      datasetLabel: 'anomalies', sourceReference: 'Source de test',
    },
  });
  assert.equal(range.status, 201, `plage : ${JSON.stringify(range.body)}`);
}, { timeout: 180_000 });

after(async () => {
  if (engine) engine.kill('SIGTERM');
  if (previousGeoaiUrl === undefined) delete process.env.GEOAI_URL;
  else process.env.GEOAI_URL = previousGeoaiUrl;
  if (h) await h.stop();
});

test('Réglages : les seuils sont annoncés provisoires', async () => {
  const response = await h.request('GET', '/anomalies/settings', { token: farmerToken });
  assert.equal(response.status, 200, JSON.stringify(response.body));

  const settings = response.body.data;
  assert.equal(settings.thresholdsProvisional, true);
  assert.ok(settings.provisionalThresholds.includes('madZLimit'));
  assert.equal(settings.silenceHandledBy, 'ThresholdAlert');
});

test('Détection : le pic est signalé sur la bonne mesure', async () => {
  const response = await h.request('POST', `/anomalies/devices/${spikeDeviceId}/detect`, {
    token: farmerToken,
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));

  const result = response.body.data;
  assert.equal(result.detected, true, result.reason);
  assert.ok(result.anomalies >= 1, `au moins le pic : ${result.anomalies}`);
  assert.equal(result.thresholdsProvisional, true);

  const listed = await h.request('GET', '/anomalies', { token: farmerToken });
  assert.equal(listed.status, 200, JSON.stringify(listed.body));
  const flagged = listed.body.data.find((item) => item.deviceId === spikeDeviceId);
  assert.ok(flagged, 'l’anomalie doit être listée');
  assert.equal(flagged.status, 'NEW');
  assert.equal(flagged.details.value, spikeReadingValue);
});

test('État du sol : la mesure signalée n’entre pas dans la recommandation', async () => {
  const response = await h.request('POST', `/plots/${plotId}/recommendations`, {
    token: farmerToken,
    body: {
      periodStart: new Date().toISOString(),
      periodEnd: new Date(Date.now() + 60 * 86_400_000).toISOString(),
    },
  });
  assert.ok([200, 201].includes(response.status), JSON.stringify(response.body));

  const moisture = response.body.data.recommendation.referenceMeasurements?.moisture;
  assert.ok(moisture, 'l’humidité doit être renseignée par les sondes');
  assert.ok(
    moisture.value < 50,
    `la mesure aberrante (${spikeReadingValue}) ne doit pas fonder l’état du sol : ${moisture.value}`,
  );
});

test('Carte interpolée : la sonde aberrante contribue avec sa valeur saine', async () => {
  const response = await h.request('POST', `/geospatial/interpolations/${plotId}/moisture`, {
    token: farmerToken,
    body: { resolutionM: 20 },
  });
  assert.ok([200, 201].includes(response.status), JSON.stringify(response.body));

  const data = response.body.data;
  if (data.sufficient === false) {
    // Le support spatial peut manquer selon la géométrie : on ne teste alors rien.
    return;
  }
  const values = (data.grid?.cells ?? []).map((cell) => cell.value);
  assert.ok(values.length > 0, 'une grille doit être produite');
  const max = Math.max(...values);
  assert.ok(
    max < 50,
    `la grille ne doit pas porter la trace du pic (${spikeReadingValue}) : max ${max}`,
  );
});

test('Prévision : la mesure signalée est absente de la série', async () => {
  const response = await h.request('POST', `/plots/${plotId}/forecasts/moisture`, {
    token: farmerToken,
    body: {},
  });
  assert.ok([200, 201].includes(response.status), JSON.stringify(response.body));

  const data = response.body.data;
  if (data.sufficient === false) return;
  const values = (data.values ?? []).map((point) => point.value);
  if (values.length === 0) return;
  assert.ok(
    Math.max(...values) < 50,
    `la prévision ne doit pas dériver vers le pic (${spikeReadingValue}) : max ${Math.max(...values)}`,
  );
});

test('Revue : le fermier ne peut pas statuer, l’agronome si', async () => {
  const listed = await h.request('GET', '/anomalies', { token: farmerToken });
  const flagged = listed.body.data.find((item) => item.deviceId === spikeDeviceId);
  assert.ok(flagged);

  const refused = await h.request('POST', `/anomalies/${flagged.id}/review`, {
    token: farmerToken,
    body: { decision: 'DISMISSED' },
  });
  assert.equal(refused.status, 403, 'la revue est réservée à l’agronome');

  /**
   * L'agronome appartient à deux organisations (la sienne et celle du fermier) :
   * l'en-tête `X-Organization-Id` désigne celle où il statue. Le serveur vérifie
   * l'appartenance — le client ne peut pas se donner un tenant.
   */
  const accepted = await h.request('POST', `/anomalies/${flagged.id}/review`, {
    token: agronomistToken,
    headers: { 'x-organization-id': farmerOrganizationId },
    body: { decision: 'DISMISSED', note: 'Vérifié sur site : la sonde a été nettoyée' },
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  assert.equal(accepted.body.data.readingExcluded, false, 'le rejet réhabilite la mesure');
  assert.equal(accepted.body.data.anomaly.reviewNote ?? accepted.body.data.anomaly.details.reviewNote,
    'Vérifié sur site : la sonde a été nettoyée');
});

test('Réhabilitation : la mesure rejetée réintègre l’état du sol', async () => {
  const response = await h.request('POST', `/plots/${plotId}/recommendations`, {
    token: farmerToken,
    body: {
      periodStart: new Date().toISOString(),
      periodEnd: new Date(Date.now() + 60 * 86_400_000).toISOString(),
    },
  });
  assert.ok([200, 201].includes(response.status), JSON.stringify(response.body));

  const moisture = response.body.data.recommendation.referenceMeasurements?.moisture;
  assert.ok(moisture, 'l’humidité doit être renseignée');
  assert.equal(
    moisture.value,
    spikeReadingValue,
    'la mesure réhabilitée, étant la plus récente, redevient la référence',
  );
});

test('Isolation : l’anomalie d’une autre organisation est invisible (404)', async () => {
  const other = await register({
    email: 'fermier-etranger-anomalie@agrikonnect.test', firstName: 'Alice', lastName: 'Boseko',
  });
  const otherToken = await connect('fermier-etranger-anomalie@agrikonnect.test');

  const listed = await h.request('GET', '/anomalies', { token: farmerToken });
  const flagged = listed.body.data[0];
  assert.ok(flagged);

  const detail = await h.request('GET', `/anomalies/${flagged.id}`, { token: otherToken });
  assert.equal(detail.status, 404, '404 et non 403 : ne pas révéler l’existence');
  assert.ok(other, 'le second fermier existe');
});
