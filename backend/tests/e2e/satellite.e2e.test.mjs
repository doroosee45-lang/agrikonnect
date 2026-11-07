/**
 * Recette de bout en bout — acquisition satellite.
 *
 * Ce que cette recette couvre, que les tests unitaires ne peuvent pas :
 *
 *  1. **le trajet HTTP complet** — auth, tenant, permissions, validation,
 *     persistance réelle en base ;
 *  2. **un fournisseur réel appelé pour de vrai** : un serveur webhook local joue
 *     le rôle du fournisseur, ce qui prouve que le passage du mode simulé au mode
 *     réel ne demande aucun changement de code ;
 *  3. **le refus d'une scène optique nuageuse** sur le chemin réel, avec le motif
 *     renvoyé au client ;
 *  4. **l'absence de fuite de secret** dans la réponse de configuration.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startHarness } from './support/harness.mjs';

const PASSWORD = 'MotDePasse!2026';

/**
 * Faux fournisseur satellite.
 *
 * Il joue le rôle de Sentinel Hub ou d'une passerelle locale : le backend ne doit
 * pas savoir lequel. Sa réponse change selon l'index demandé, ce qui permet de
 * provoquer le refus d'une scène nuageuse.
 */
const startFakeProvider = () => {
  let responder = () => ({ value: 25.5, observedAt: new Date().toISOString(), index: 'S1_SOIL_MOISTURE' });
  const received = [];

  const server = http.createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const payload = JSON.parse(body || '{}');
      received.push(payload);
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(responder(payload)));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        received,
        respond: (next) => { responder = next; },
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
};

let h;
let provider;
let farmerToken;
let investorToken;
let verifierToken;
let agronomistToken;

let plotId;
let probedPlotId;
let otherPlotId;
let organizationId;

/** Remet l'environnement fournisseur à son état d'avant. */
const useProvider = (name) => {
  const previous = {
    SATELLITE_PROVIDER: process.env.SATELLITE_PROVIDER,
    SATELLITE_API_URL: process.env.SATELLITE_API_URL,
    SATELLITE_API_KEY: process.env.SATELLITE_API_KEY,
    SATELLITE_ACQUISITION_ENABLED: process.env.SATELLITE_ACQUISITION_ENABLED,
  };
  if (name === null) delete process.env.SATELLITE_PROVIDER;
  else process.env.SATELLITE_PROVIDER = name;
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
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

/**
 * Rôle non disponible en libre-service : élévation directe de l'adhésion.
 *
 * C'est le même procédé que les recettes `channels` et `intelligence` — il ne
 * teste pas l'inscription, il prépare un acteur doté du rôle à vérifier.
 */
const elevate = async (userId, roles) => {
  await h.prisma.membership.updateMany({ where: { userId }, data: { roles } });
};

const createPlot = async (name, lonOffset = 0) => {
  const farm = await h.request('POST', '/farms', {
    token: farmerToken,
    body: {
      name: `Ferme ${name}`, countryCode: 'CD', province: 'Bandundu',
      latitude: -3.3, longitude: 17.4, totalAreaHa: 12,
    },
  });
  assert.equal(farm.status, 201, JSON.stringify(farm.body));

  const plot = await h.request('POST', '/plots', {
    token: farmerToken,
    body: {
      farmId: farm.body.data.id ?? farm.body.data.farm?.id,
      name,
      geometry: {
        type: 'Polygon',
        coordinates: [[[18.25 + lonOffset, 0.048], [18.26 + lonOffset, 0.048],
          [18.26 + lonOffset, 0.052], [18.25 + lonOffset, 0.052], [18.25 + lonOffset, 0.048]]],
      },
      status: 'FALLOW',
    },
  });
  assert.equal(plot.status, 201, JSON.stringify(plot.body));
  return plot.body.data.id ?? plot.body.data.plot?.id;
};

before(async () => {
  h = await startHarness();
  provider = await startFakeProvider();

  const farmer = await register({ email: 'fermier-satellite@agrikonnect.test', firstName: 'Josué', lastName: 'Mbala' });
  farmerToken = await connect('fermier-satellite@agrikonnect.test');

  const investor = await register({
    email: 'investisseur-satellite@agrikonnect.test', accountType: 'SUPPORT_AGENT',
    firstName: 'Nadia', lastName: 'Kamba',
  });
  await elevate(investor.user?.id ?? investor.profile?.id ?? investor.id, ['INVESTOR']);
  investorToken = await connect('investisseur-satellite@agrikonnect.test');

  const verifier = await register({
    email: 'verificateur-satellite@agrikonnect.test', accountType: 'SUPPORT_AGENT',
    firstName: 'Paul', lastName: 'Iyeli',
  });
  await elevate(verifier.user?.id ?? verifier.profile?.id ?? verifier.id, ['VERIFIER']);
  verifierToken = await connect('verificateur-satellite@agrikonnect.test');

  const agronomist = await register({
    email: 'agronome-satellite@agrikonnect.test', accountType: 'SUPPORT_AGENT',
    firstName: 'Sylvie', lastName: 'Nkumu',
  });
  await elevate(agronomist.user?.id ?? agronomist.profile?.id ?? agronomist.id, ['AGRONOMIST']);
  agronomistToken = await connect('agronome-satellite@agrikonnect.test');

  plotId = await createPlot('Parcelle sans sonde');
  organizationId = (await h.prisma.plot.findUnique({ where: { id: plotId } })).organizationId;
  probedPlotId = await createPlot('Parcelle équipée', 0.1);

  // Une sonde réelle sur la seconde parcelle : le satellite ne doit pas la doubler.
  const device = await h.request('POST', '/iot/devices', {
    token: farmerToken,
    body: { label: 'Sonde humidité', plotId: probedPlotId },
  });
  assert.equal(device.status, 201, `sonde : ${JSON.stringify(device.body)}`);
  const ingested = await h.request('POST', '/iot/ingest', {
    body: {
      deviceKey: device.body.data.deviceKey,
      readings: [{
        metric: 'moisture',
        value: 28,
        unit: '%',
        depthCm: 30,
        position: { type: 'Point', coordinates: [18.305, 0.05] },
        confidence: 'high',
        source: 'measured_sensor',
        mode: 'REAL',
      }],
    },
  });
  assert.equal(ingested.status, 201, `ingestion : ${JSON.stringify(ingested.body)}`);

  // Une parcelle d'une autre organisation, pour l'isolation.
  const other = await register({
    email: 'fermier-etranger@agrikonnect.test', firstName: 'Alice', lastName: 'Boseko',
  });
  const otherToken = await connect('fermier-etranger@agrikonnect.test');
  const previousFarmer = farmerToken;
  farmerToken = otherToken;
  otherPlotId = await createPlot('Parcelle étrangère');
  farmerToken = previousFarmer;
  assert.ok(other, 'le second fermier doit exister');
}, { timeout: 180_000 });

after(async () => {
  if (provider) await provider.close();
  if (h) await h.stop();
});

test('Configurations : le fournisseur actif est lisible, sans secret', async () => {
  const response = await h.request('GET', '/satellite/settings', { token: farmerToken });
  assert.equal(response.status, 200, JSON.stringify(response.body));

  const settings = response.body.data;
  assert.ok(!('apiKey' in settings), 'la clé ne doit jamais être renvoyée');
  assert.ok(!('apiUrl' in settings), 'l’URL non plus');
  assert.equal(typeof settings.apiKeyConfigured, 'boolean');
  assert.equal(settings.primaryMoistureSource, 'sentinel-1', 'le radar est la source principale');
  assert.ok(
    settings.sources.every((source) => source.measuresSubsurface === false),
    'aucune source satellite ne mesure le sous-sol',
  );
  assert.equal(settings.providerEnvVar, 'SATELLITE_PROVIDER');
});

test('Acquisition simulée : 201, mode SIMULATED, confiance faible', async () => {
  const restore = useProvider('simulated');
  try {
    const response = await h.request('POST', `/satellite/plots/${plotId}/acquire`, { token: farmerToken });
    assert.equal(response.status, 201, JSON.stringify(response.body));

    const result = response.body.data;
    assert.equal(result.acquired, true, result.reason);
    assert.equal(result.sourceId, 'sentinel-1');
    assert.equal(result.measuresSubsurface, false);
    assert.equal(result.observation.mode, 'SIMULATED', 'le mode simulé est conservé');
    assert.equal(result.observation.confidence, 'low');
    assert.equal(result.observation.index, 'S1_SOIL_MOISTURE');
  } finally {
    restore();
  }
});

test('Acquisition réelle : un fournisseur webhook est appelé avec l’emprise de la parcelle', async () => {
  const restore = useProvider('webhook');
  process.env.SATELLITE_API_URL = provider.url;
  process.env.SATELLITE_API_KEY = 'cle-de-test';
  provider.received.length = 0;
  provider.respond(() => ({
    value: 31.4,
    observedAt: new Date().toISOString(),
    index: 'S1_SOIL_MOISTURE',
    cloudCoverPct: null,
  }));

  try {
    const response = await h.request('POST', `/satellite/plots/${plotId}/acquire`, { token: farmerToken });
    assert.equal(response.status, 201, JSON.stringify(response.body));

    assert.equal(provider.received.length, 1, 'le fournisseur doit avoir été appelé');
    const sent = provider.received[0];
    assert.deepEqual(sent.bbox, [18.25, 0.048, 18.26, 0.052], 'l’emprise vient de la géométrie');
    assert.equal(sent.index, 'S1_SOIL_MOISTURE');

    assert.equal(response.body.data.acquired, true);
    assert.equal(response.body.data.observation.mode, 'REAL', 'une vraie scène n’est pas marquée simulée');
    assert.equal(response.body.data.observation.value, 31.4);
  } finally {
    restore();
  }
});

test('Scène optique nuageuse : refusée, avec le motif, et rien n’est écrit', async () => {
  const restore = useProvider('webhook');
  process.env.SATELLITE_API_URL = provider.url;
  process.env.SATELLITE_API_KEY = 'cle-de-test';
  provider.respond(() => ({
    value: 0.72,
    observedAt: new Date().toISOString(),
    index: 'NDVI',
    sourceId: 'sentinel-2',
    cloudCoverPct: 85,
  }));

  try {
    const before = await h.request('GET', `/satellite/plots/${plotId}/observations`, { token: farmerToken });
    const countBefore = before.body.data.count;

    const response = await h.request('POST', `/satellite/plots/${plotId}/acquire`, {
      token: farmerToken,
      body: { sourceId: 'sentinel-2', index: 'NDVI' },
    });

    /**
     * 200 et non une erreur : « pas de scène exploitable » est une réponse
     * informative. Aucune valeur de substitution n'est renvoyée.
     */
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.acquired, false);
    assert.equal(response.body.data.rejected, true);
    // Le motif réel parle de « couverture nuageuse » ; `/nuage/i` couvre aussi le
    // pluriel si la formulation change.
    assert.match(response.body.data.reason, /nuage/i);
    assert.match(response.body.data.reason, /sentinel-1/, 'le motif doit indiquer la bascule vers le radar');

    const after = await h.request('GET', `/satellite/plots/${plotId}/observations`, { token: farmerToken });
    assert.equal(after.body.data.count, countBefore, 'la scène refusée ne doit pas être conservée');
  } finally {
    restore();
  }
});

test('Fournisseur réel non configuré : l’échec est visible, aucune scène écrite', async () => {
  const restore = useProvider('sentinelhub');
  delete process.env.SATELLITE_API_URL;
  try {
    const response = await h.request('POST', `/satellite/plots/${plotId}/acquire`, { token: farmerToken });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.acquired, false);
    assert.match(response.body.data.reason, /SATELLITE_API_URL manquant/);
  } finally {
    restore();
  }
});

test('Job : la parcelle équipée d’une sonde est écartée', async () => {
  const restore = useProvider('simulated');
  process.env.SATELLITE_ACQUISITION_ENABLED = 'true';
  try {
    const { runAcquisition } = await import('../../src/modules/satellite/acquisition.service.js');
    const result = await runAcquisition({ organizationId });

    assert.equal(result.enabled, true);
    const skipped = result.details.skipped.find((entry) => entry.plotId === probedPlotId);
    assert.ok(skipped, 'la parcelle équipée doit figurer parmi les écartées');
    assert.equal(skipped.reason, 'PROBE_COVERED');

    const acquired = result.details.acquired.find((entry) => entry.plotId === probedPlotId);
    assert.equal(acquired, undefined, 'le satellite ne double pas une mesure existante');
  } finally {
    restore();
  }
});

test('Permissions : un investisseur ne peut ni lire ni déclencher', async () => {
  const read = await h.request('GET', '/satellite/settings', { token: investorToken });
  assert.equal(read.status, 403, JSON.stringify(read.body));

  const write = await h.request('POST', `/satellite/plots/${plotId}/acquire`, { token: investorToken });
  assert.equal(write.status, 403, JSON.stringify(write.body));
});

test('Permissions : l’agronome lit, le vérificateur ne déclenche pas', async () => {
  const read = await h.request('GET', '/satellite/settings', { token: agronomistToken });
  assert.equal(read.status, 200, JSON.stringify(read.body));

  const write = await h.request('POST', `/satellite/plots/${plotId}/acquire`, { token: verifierToken });
  assert.equal(write.status, 403, 'déclencher une acquisition consomme du quota fournisseur');
});

test('Isolation : la parcelle d’une autre organisation est invisible (404)', async () => {
  const acquire = await h.request('POST', `/satellite/plots/${otherPlotId}/acquire`, { token: farmerToken });
  assert.equal(acquire.status, 404, JSON.stringify(acquire.body));

  const list = await h.request('GET', `/satellite/plots/${otherPlotId}/observations`, { token: farmerToken });
  assert.equal(list.status, 404, JSON.stringify(list.body));
});

test('Validation : un index inconnu est refusé', async () => {
  const response = await h.request('POST', `/satellite/plots/${plotId}/acquire`, {
    token: farmerToken,
    body: { index: 'HUMIDITE_SUBSURFACE' },
  });
  assert.equal(response.status, 422, 'un NDVI n’est pas une humidité : la liste est explicite');
});

test('Lecture : les scènes sont restituées, marquées surface, modes distingués', async () => {
  const response = await h.request('GET', `/satellite/plots/${plotId}/observations`, { token: farmerToken });
  assert.equal(response.status, 200, JSON.stringify(response.body));

  const data = response.body.data;
  assert.ok(data.count >= 2, `au moins les scènes simulée et réelle : ${data.count}`);
  assert.equal(data.measuresSubsurface, false);
  assert.ok(
    data.items.every((item) => item.confidence === 'low'),
    'une source de surface ne peut pas prétendre à la fiabilité d’une sonde',
  );
  assert.ok(
    data.items.some((item) => item.mode === 'REAL') && data.items.some((item) => item.mode === 'SIMULATED'),
    'les deux modes coexistent et restent distinguables',
  );
});

test('Job d’alertes : une scène SIMULATED ne déclenche aucune alerte, la même valeur en REAL si', async () => {
  const alertPlotId = await createPlot('Parcelle seuil humidité', 0.2);

  /**
   * La recommandation est un **échafaudage**, pas l'objet du test : ce qui est
   * vérifié, c'est la lecture des observations par `buildSoilState`. Elle est
   * créée directement en base parce que `recommendationId` est une clé étrangère
   * de `threshold_alerts`, et parce qu'une recommandation produite par l'API
   * n'aurait aucun seuil d'humidité — les seuils ne sont dérivés que de critères
   * réellement évalués, ce qui rendrait le test trivialement vrai.
   */
  const { scanRecommendation } = await import('../../src/modules/alerts/alerts.service.js');

  // ── Cas 1 : la seule donnée d'humidité est une scène SIMULATED ──
  const restoreSim = useProvider('simulated');
  const acquired = await h.request('POST', `/satellite/plots/${alertPlotId}/acquire`, {
    token: farmerToken,
  });
  restoreSim();
  assert.equal(acquired.status, 201, JSON.stringify(acquired.body));
  assert.equal(acquired.body.data.observation.mode, 'SIMULATED');

  const simulatedValue = acquired.body.data.observation.value;
  assert.ok(Number.isFinite(simulatedValue), 'la scène doit produire une valeur');

  /**
   * Le seuil est **dérivé de la valeur observée**, pas fixé à l'avance.
   *
   * Le fournisseur simulé produit `12 + fraction * 30`, où `fraction` vient du
   * hachage de l'identifiant de parcelle — identifiant **généré à l'exécution**.
   * Un seuil écrit en dur à 40 % rendait donc ce test **aléatoire** : environ
   * 7 % des exécutions tiraient une scène entre 40 et 42 et échouaient sur
   * l'assertion de franchissement, sans qu'aucun code ait changé.
   *
   * Dériver le seuil garantit le franchissement à chaque exécution, et le test
   * prouve exactement la même chose : à valeur égale, `SIMULATED` n'alerte pas
   * et `REAL` alerte.
   */
  const thresholdMin = simulatedValue + 5;
  const periodStart = new Date();
  const periodEnd = new Date(periodStart.getTime() + 60 * 86_400_000);
  const recommendation = await h.prisma.cropRecommendation.create({
    data: {
      id: '01SIMULATEDALERTTEST00000001',
      organizationId,
      plotId: alertPlotId,
      periodStart,
      periodEnd,
      requestedDays: 60,
      status: 'ACTIVE',
      mode: 'REAL',
      scores: [],
      referenceMeasurements: {},
      thresholds: { moisture: { min: thresholdMin, max: thresholdMin + 30, unit: '%', derivedFrom: 'mais' } },
    },
  });

  // Le franchissement est garanti par construction, et vérifié quand même.
  assert.ok(
    simulatedValue < thresholdMin,
    `la scène doit franchir le seuil par le bas : ${simulatedValue} vs ${thresholdMin}`,
  );

  const first = await scanRecommendation(recommendation);
  assert.equal(first.checked, 1, 'le seuil d’humidité est bien examiné');
  assert.equal(first.alerts.length, 0, 'une scène simulée ne doit jamais déclencher d’alerte');
  assert.equal(
    await h.prisma.thresholdAlert.count({ where: { plotId: alertPlotId } }),
    0,
    'aucune alerte ne doit être persistée',
  );

  // ── Cas 2 : la même valeur, en mode REAL, déclenche bien l’alerte ──
  const restoreReal = useProvider('webhook');
  process.env.SATELLITE_API_URL = provider.url;
  process.env.SATELLITE_API_KEY = 'cle-de-test';
  provider.respond(() => ({
    value: simulatedValue,
    observedAt: new Date().toISOString(),
    index: 'S1_SOIL_MOISTURE',
    cloudCoverPct: null,
  }));
  try {
    const real = await h.request('POST', `/satellite/plots/${alertPlotId}/acquire`, {
      token: farmerToken,
    });
    assert.equal(real.status, 201, JSON.stringify(real.body));
    assert.equal(real.body.data.observation.mode, 'REAL');
    assert.equal(real.body.data.observation.value, simulatedValue, 'valeur identique, seul le mode change');

    const second = await scanRecommendation(recommendation);
    assert.equal(second.alerts.length, 1, 'la même valeur en mode REAL doit alerter');
    assert.equal(second.alerts[0].parameter, 'moisture');

    const rows = await h.prisma.thresholdAlert.findMany({ where: { plotId: alertPlotId } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].observedValue, simulatedValue);
  } finally {
    restoreReal();
  }
});
