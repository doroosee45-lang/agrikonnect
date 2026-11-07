import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Lot de référentiel dédié, posé **avant** `startHarness()` : la variable est
 * lue à l'import de l'application.
 */
process.env.AGRONOMIC_DATASET = 'forecast';

const { startHarness } = await import('./support/harness.mjs');

// Ce fichier vit dans tests/e2e/ : trois remontées pour atteindre la racine du backend.
const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const DAY = 86_400_000;

/**
 * Toutes les dates sont **relatives à l'instant d'exécution**.
 *
 * C'est indispensable : le job écarte un franchissement déjà passé
 * (`breach.at <= now`), qui relève du volet mesure et non du volet préventif.
 * Une recette à dates fixes deviendrait silencieusement obsolète — elle
 * passerait au vert sans plus rien prouver.
 */
const SERIES_END = Date.now() - DAY; // dernière mesure : hier
const SERIES_START = SERIES_END - 39 * DAY; // 40 mesures quotidiennes
const FORECAST_NOW = SERIES_END; // la projection part de la dernière mesure
/**
 * Période de classement relative, large de 182 jours (≈ 6 mois).
 *
 * Elle remplit deux rôles : ses **mois** sélectionnent les cultures semables
 * (fenêtres du maïs en Équateur : mars–avril ou sept–octobre) et elle doit
 * **contenir les points de la prévision** (≈ [maintenant−1 j ; maintenant+21 j]).
 * Une fenêtre de six mois partant d'aujourd'hui contient toujours un mois de
 * semis du maïs ; la fenêtre [now ; now+61 j] utilisée avant, elle, ne
 * couvrait plus septembre–octobre dès le 1er novembre et le classement
 * basculait en INSUFFICIENT_DATA. Les dates restent relatives — un scénario à
 * dates fixes deviendrait silencieusement obsolète.
 */
const PERIOD_START = Date.now() - 60 * DAY;
const PERIOD_END = Date.now() + 122 * DAY;

/**
 * Recette de bout en bout — **base réelle + moteur Python réel** — de la chaîne
 * complète de prévision.
 *
 * Ce que cette suite prouve, et qu'aucune autre ne prouve :
 *   - des mesures réelles de sonde suffisent à produire une prévision, qui est
 *     **réellement écrite** dans `soil_predictions` avec sa preuve de qualité ;
 *   - la prévision est évaluée sur un découpage chronologique et bat la
 *     persistance, sinon elle ne serait pas exploitable ;
 *   - le job d'alertes consomme cette prévision et émet une **alerte
 *     préventive** datée, avec un SMS en français annonçant l'échéance ;
 *   - une prévision qui ne bat pas la persistance ne déclenche rien.
 *
 * C'est la fermeture de la boucle ouverte par le job d'alertes : tant que
 * `soil_predictions` est vide, le volet préventif ne peut rien déclencher.
 */

let h;
let engine;
/** Sortie du moteur : sans elle, un échec de démarrage est indiagnostiquable. */
const engineLog = [];
let previousGeoaiUrl;
let farmerToken;
let plotId;
let organizationId;
let recommendationId;

const PASSWORD = 'MotDePasse!2026';
const FARMER_EMAIL = 'fermier-prevision@agrikonnect.test';
const FARMER_PHONE = '+243810000333';
const AGRO_EMAIL = 'agro-prevision@agrikonnect.test';

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

const runMonitoringJob = async () => {
  const { runJob } = await import('../../src/jobs/index.js');
  const outcome = await runJob('recommendations.monitor');
  assert.equal(outcome.ok, true, `job en échec : ${JSON.stringify(outcome)}`);
  return outcome.result;
};

before(async () => {
  h = await startHarness();

  // Moteur Python réel : sans lui, il n'y a pas de prévision du tout.
  const port = await freePort();
  engine = spawn('python3', ['geoai/server.py', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: ROOT,
    env: { ...process.env, GEOAI_QUIET: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
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
    `le moteur Python doit être joignable pour cette recette. cwd=${ROOT}, port=${port}, `
    + `sortie du moteur : ${engineLog.join('') || '(vide)'}`,
  );

  await register({ email: FARMER_EMAIL, firstName: 'Esther', lastName: 'Lokwa', phone: FARMER_PHONE });

  // Les alertes SMS ne partent plus que vers un numéro confirmé par son
  // titulaire : la recette doit donc placer l'agriculteur dans l'état réel
  // d'un compte actif, sinon tous ses envois seraient retenus.
  await h.prisma.profile.updateMany({
    where: { phone: FARMER_PHONE },
    data: { phoneVerifiedAt: new Date() },
  });

  await register({ email: AGRO_EMAIL, accountType: 'AGRONOMIST', firstName: 'Alice', lastName: 'Muteba' });
  farmerToken = await connect(FARMER_EMAIL);
  const agroToken = await connect(AGRO_EMAIL);

  const farm = await h.request('POST', '/farms', {
    token: farmerToken,
    body: {
      name: 'Ferme prévision', countryCode: 'CD', province: 'Équateur',
      latitude: 0.0481, longitude: 18.2557, totalAreaHa: 8,
    },
  });
  assert.equal(farm.status, 201, JSON.stringify(farm.body));
  const farmId = farm.body.data.id ?? farm.body.data.farm?.id;

  const plot = await h.request('POST', '/plots', {
    token: farmerToken,
    body: {
      farmId,
      name: 'Parcelle prévision',
      geometry: {
        type: 'Polygon',
        coordinates: [[[18.25, 0.048], [18.26, 0.048], [18.26, 0.052], [18.25, 0.052], [18.25, 0.048]]],
      },
      status: 'PLANTED',
    },
  });
  assert.equal(plot.status, 201, JSON.stringify(plot.body));
  plotId = plot.body.data.id ?? plot.body.data.plot?.id;

  const plotRecord = await h.prisma.plot.findUnique({ where: { id: plotId } });
  organizationId = plotRecord.organizationId;

  /**
   * Consentement aux alertes SMS.
   *
   * Depuis que le job d'alertes passe par `sendAlertBatch()`, aucun SMS ne part
   * sans consentement — c'est la règle. Sans cette ligne, les assertions sur le
   * contenu du SMS préventif porteraient sur un message jamais envoyé.
   */
  const farmerProfile = await h.prisma.profile.findFirst({ where: { email: FARMER_EMAIL } });
  await h.prisma.smsConsent.create({
    data: {
      id: 'scon_prevision_e2e_001',
      organizationId,
      userId: farmerProfile.id,
      purpose: 'ALERT',
      status: 'GRANTED',
      method: 'IN_APP',
      grantedAt: new Date(),
    },
  });

  // Référentiel : pH, humidité et température de l'air pour le maïs.
  for (const range of [
    { cropSlug: 'mais', parameterKey: 'ph', minValue: 5.5, maxValue: 7, unit: 'pH' },
    { cropSlug: 'mais', parameterKey: 'moisture', minValue: 20, maxValue: 60, unit: '%' },
    { cropSlug: 'mais', parameterKey: 'airTemperatureC', minValue: 21, maxValue: 30, unit: '°C' },
  ]) {
    // eslint-disable-next-line no-await-in-loop
    const created = await h.request('POST', '/agronomic-ranges', {
      token: agroToken,
      body: { ...range, datasetLabel: 'forecast', sourceReference: 'Source de test' },
    });
    assert.equal(created.status, 201, `plage ${range.parameterKey} : ${JSON.stringify(created.body)}`);
  }

  // Sonde d'humidité : 40 jours de mesures réelles, en baisse régulière de 45 à 25,5 %.
  await h.prisma.iotDevice.create({
    data: {
      id: 'device_prev_humidite', organizationId, plotId,
      label: 'Sonde humidité sud', keyHash: 'hash-e2e', lastSeenAt: new Date(),
    },
  });
  // 45 % il y a 40 jours, 25,5 % hier : baisse régulière, dernière valeur
  // encore conforme à la plage [20 ; 60] — c'est la prévision qui franchit.
  const readings = Array.from({ length: 40 }, (_, i) => ({
    id: `sr_prev_${i}`,
    organizationId,
    plotId,
    deviceId: 'device_prev_humidite',
    metric: 'moisture',
    value: Number((45 - 0.5 * i).toFixed(2)),
    unit: '%',
    source: 'measured_sensor',
    confidence: 'high',
    at: new Date(SERIES_START + i * DAY),
    depthCm: 30,
    mode: 'REAL',
  }));
  await h.prisma.sensorReading.createMany({ data: readings });

  // pH conforme en laboratoire, et température de l'air par la station météo.
  const assessment = await h.request('POST', `/plots/${plotId}/soil-assessments`, {
    token: farmerToken,
    body: {
      assessedAt: new Date(SERIES_END).toISOString(),
      parameters: [
        { key: 'ph', value: '6.4', numericValue: 6.4, unit: 'pH', source: 'measured_lab', confidence: 'high' },
      ],
    },
  });
  assert.equal(assessment.status, 201, JSON.stringify(assessment.body));

  await h.prisma.iotDevice.create({
    data: {
      id: 'device_prev_station', organizationId, plotId,
      label: 'Station météo prévision', keyHash: 'hash-e2e', lastSeenAt: new Date(),
    },
  });
  await h.prisma.sensorReading.create({
    data: {
      id: 'sr_prev_temp', organizationId, plotId, deviceId: 'device_prev_station',
      metric: 'airTemperatureC', value: 25, unit: '°C', source: 'measured_sensor',
      confidence: 'high', at: new Date(SERIES_END), mode: 'REAL',
    },
  });

  // Recommandation : trois critères évaluables, tous conformes à ce stade.
  const recommendation = await h.request('POST', `/plots/${plotId}/recommendations`, {
    token: farmerToken,
    body: {
      periodStart: new Date(PERIOD_START).toISOString(),
      periodEnd: new Date(PERIOD_END).toISOString(),
    },
  });
  assert.equal(recommendation.status, 201, JSON.stringify(recommendation.body));
  assert.equal(
    recommendation.body.data.recommendation.status,
    'ACTIVE',
    `motif : ${recommendation.body.data.recommendation.insufficiencyReason}`,
  );
  recommendationId = recommendation.body.data.recommendation.id;

  const stored = await h.prisma.cropRecommendation.findUnique({ where: { id: recommendationId } });
  assert.equal(stored.thresholds.moisture.min, 20, 'le seuil d’humidité doit exister pour être surveillé');
}, { timeout: 240_000 });

after(async () => {
  if (engine) engine.kill('SIGTERM');
  if (previousGeoaiUrl === undefined) delete process.env.GEOAI_URL;
  else process.env.GEOAI_URL = previousGeoaiUrl;
  await h?.stop();
});

test('Chaîne complète : les mesures réelles produisent une prévision persistée', async () => {
  const response = await h.request('POST', `/plots/${plotId}/forecasts/moisture`, {
    token: farmerToken,
    body: { horizonDays: 21, stepDays: 1, now: new Date(FORECAST_NOW).toISOString() },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));

  const data = response.body.data;
  assert.equal(data.sufficient, true, `motif : ${data.reason}`);
  assert.equal(data.observationCount, 40);
  assert.equal(data.beatsBaseline, true, 'la méthode doit battre la persistance');
  assert.equal(data.evaluation.split, 'chronological');
  assert.ok(data.evaluation.model.mae < data.evaluation.baseline.mae);
  assert.deepEqual(data.sources, ['measured_sensor']);

  // La ligne est réellement en base, avec sa preuve de qualité.
  const rows = await h.prisma.soilPrediction.findMany({ where: { plotId, parameter: 'moisture' } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].beatsBaseline, true);
  assert.equal(rows[0].mode, 'REAL');
  assert.equal(rows[0].horizonDays, 21);
  assert.ok(rows[0].mae < rows[0].baselineMae);
  assert.equal(rows[0].values.length, 21);

  // La projection franchit bien le seuil bas de 20 % dans l'horizon demandé.
  const breach = rows[0].values.find((point) => point.value < 20);
  assert.ok(breach, `aucun franchissement dans la série : ${JSON.stringify(rows[0].values.at(-1))}`);

  // L'écriture est tracée.
  const audits = await h.prisma.auditLog.findMany({ where: { resourceId: rows[0].id } });
  assert.ok(audits.some((row) => row.action === 'soilPrediction.create'));
});

test('Chaîne complète : le job émet une alerte préventive datée', async () => {
  h.sink.reset();
  const result = await runMonitoringJob();
  assert.ok(result.alerts >= 1, `une alerte préventive attendue : ${JSON.stringify(result)}`);

  const alert = await h.prisma.thresholdAlert.findFirst({
    where: { organizationId, sourceType: 'FORECAST' },
  });
  assert.ok(alert, 'l’alerte préventive doit exister');
  assert.equal(alert.parameter, 'moisture');
  assert.equal(alert.predictive, true);
  assert.equal(alert.recommendationId, recommendationId);
  assert.equal(alert.referenceValue, 20, 'la borne franchie est le minimum de la plage');
  assert.ok(alert.observedValue < 20, `valeur prévue : ${alert.observedValue}`);
  assert.ok(alert.predictedBreachAt, 'la date estimée de franchissement est portée');
  assert.ok(alert.predictedBreachAt > new Date(), 'le franchissement est à venir');

  // L'alerte préventive ne remplace pas la recommandation : elle avertit.
  const original = await h.prisma.cropRecommendation.findUnique({ where: { id: recommendationId } });
  assert.equal(original.status, 'ACTIVE', 'une prévision seule ne remplace rien');
  assert.equal(alert.replacementRecommendationId, null);

  // Le SMS annonce l'échéance, en français.
  const sms = h.sink.messages.sms.filter((m) => m.to === FARMER_PHONE);
  assert.ok(sms.length >= 1, 'un SMS est attendu');
  const message = sms.map((m) => m.message).join(' ');
  // Le **corps** du SMS est en minuscules après « AGRIKONNECT : » ; la
  // majuscule est réservée au titre (in-app et email).
  assert.match(message, /prévision défavorable/i);
  assert.match(message, /humidité volumique du sol/);
  // Raccourci pour tenir dans un segment GSM-7 : la formulation longue faisait
  // déborder le message sur quatre segments en UCS-2.
  assert.match(message, /Batt la persistance/, 'la preuve de qualité est rappelée');
  assert.doesNotMatch(message, /SIMULÉ/);
});

test('Chaîne complète : une prévision qui ne bat pas la persistance n’alerte pas', async () => {
  // On retire la preuve de qualité : la même prévision devient inexploitable.
  await h.prisma.soilPrediction.updateMany({
    where: { plotId, parameter: 'moisture' },
    data: { beatsBaseline: false },
  });
  await h.prisma.thresholdAlert.deleteMany({ where: { organizationId, sourceType: 'FORECAST' } });

  h.sink.reset();
  const result = await runMonitoringJob();

  const forecastAlerts = await h.prisma.thresholdAlert.findMany({
    where: { organizationId, sourceType: 'FORECAST' },
  });
  assert.deepEqual(forecastAlerts, [], 'sans preuve, aucune alerte préventive');
  assert.deepEqual(
    h.sink.messages.sms.filter((m) => /Prévision/.test(m.message ?? '')),
    [],
    'aucun SMS préventif',
  );
  assert.equal(result.replacements, 0);
});

test('Chaîne complète : données insuffisantes → refus explicite, rien en base', async () => {
  // Nouvelle parcelle, presque aucune mesure.
  const plot = await h.request('POST', '/plots', {
    token: farmerToken,
    body: {
      farmId: (await h.prisma.plot.findUnique({ where: { id: plotId } })).farmId,
      name: 'Parcelle sans historique',
      geometry: { type: 'Point', coordinates: [18.3, 0.06] },
      status: 'FALLOW',
    },
  });
  assert.equal(plot.status, 201, JSON.stringify(plot.body));
  const sparsePlotId = plot.body.data.id ?? plot.body.data.plot?.id;

  const response = await h.request('POST', `/plots/${sparsePlotId}/forecasts/moisture`, {
    token: farmerToken,
    body: { horizonDays: 14 },
  });

  // 200 et non 201 : « pas assez de données » est une réponse, pas une erreur.
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.data.sufficient, false);
  assert.deepEqual(response.body.data.values, []);
  assert.ok(response.body.data.reason.length > 10);

  const rows = await h.prisma.soilPrediction.findMany({ where: { plotId: sparsePlotId } });
  assert.deepEqual(rows, [], 'aucune prévision ne doit être inventée');
});

test('Chaîne complète : un paramètre non prévivable est refusé (422)', async () => {
  const response = await h.request('POST', `/plots/${plotId}/forecasts/texture`, {
    token: farmerToken,
    body: { horizonDays: 7 },
  });
  assert.equal(response.status, 422, JSON.stringify(response.body));
});

test('Chaîne complète : le backtest évalue sans écrire', async () => {
  const before = await h.prisma.soilPrediction.count({ where: { plotId } });
  const response = await h.request('POST', `/plots/${plotId}/forecasts/moisture/backtest`, {
    token: farmerToken,
    body: { horizonDays: 14 },
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.data.sufficient, true);
  assert.equal(response.body.data.promotable, true);
  assert.equal(response.body.data.evaluation.split, 'chronological');

  const after = await h.prisma.soilPrediction.count({ where: { plotId } });
  assert.equal(after, before, 'le backtest n’écrit rien');
});

test('Chaîne complète : la parcelle d’une autre organisation est invisible (404)', async () => {
  await register({ email: 'tiers-prevision@agrikonnect.test', firstName: 'Paulin', lastName: 'Ilunga' });
  const otherToken = await connect('tiers-prevision@agrikonnect.test');

  const forecast = await h.request('POST', `/plots/${plotId}/forecasts/moisture`, {
    token: otherToken,
    body: { horizonDays: 7 },
  });
  assert.equal(forecast.status, 404, JSON.stringify(forecast.body));

  const list = await h.request('GET', `/plots/${plotId}/forecasts`, { token: otherToken });
  assert.equal(list.status, 404, JSON.stringify(list.body));
});

/* ───── la prévision entre dans le choix de la culture ───── */

/**
 * Ces deux tests forment une paire : le même sol, la même période, la même
 * prévision — seul change le fait que cette prévision soit prouvée ou non. Si
 * le classement ne diffère pas, c'est que l'ajustement ne sert à rien.
 */

const createRecommendation = async (label) => {
  const response = await h.request('POST', `/plots/${plotId}/recommendations`, {
    token: farmerToken,
    body: {
      // Calculées à l'appel : `periodDays` du moteur compte les jours à venir
      // (max(now, periodStart) → periodEnd) et doit rester exactement 122.
      periodStart: new Date(Date.now() - 60 * DAY).toISOString(),
      periodEnd: new Date(Date.now() + 122 * DAY).toISOString(),
      idempotencyKey: `rec-${label}-${Date.now()}`,
    },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body.data.recommendation;
};

test('Choix de culture : sans prévision prouvée, le classement le dit', async () => {
  // État laissé par le test précédent : la prévision existe mais n'est pas prouvée.
  const rows = await h.prisma.soilPrediction.findMany({ where: { plotId, parameter: 'moisture' } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].beatsBaseline, false, 'pré-condition : prévision non prouvée');

  const recommendation = await createRecommendation('sans-preuve');
  const forecast = recommendation.explanation.forecast;

  assert.equal(forecast.applied, false);
  assert.deepEqual(forecast.parameters, []);
  assert.equal(forecast.skipped[0].reason, 'FORECAST_NOT_PROVEN');
  assert.match(forecast.notice, /Aucune prévision prouvée/);
  assert.match(forecast.notice, /seules mesures du jour/);

  const stored = await h.prisma.cropRecommendation.findUnique({ where: { id: recommendation.id } });
  assert.equal(stored.decomposition.forecast.applied, false, 'l’ajustement est tracé en base');
  // Le score reste celui de la mesure du jour : l'humidité est conforme.
  const top = stored.scores[0];
  const moisture = top.criteria.find((criterion) => criterion.key === 'moisture');
  assert.equal(moisture.met, true);
  assert.equal(moisture.forecastAdjusted, false);
});

test('Choix de culture : une prévision prouvée change le classement', async () => {
  await h.prisma.soilPrediction.updateMany({
    where: { plotId, parameter: 'moisture' },
    data: { beatsBaseline: true },
  });

  const recommendation = await createRecommendation('avec-preuve');
  const stored = await h.prisma.cropRecommendation.findUnique({ where: { id: recommendation.id } });
  const forecast = stored.explanation.forecast;

  assert.equal(forecast.applied, true);
  assert.equal(forecast.parameters.length, 1);

  const parameter = forecast.parameters[0];
  assert.equal(parameter.parameter, 'moisture');
  assert.equal(parameter.periodDays, 122);
  // La prévision couvre 21 jours sur les 122 jours à venir de la période :
  // la proportion est dite.
  assert.ok(parameter.coverageRatio < 1, `couverture partielle attendue, reçu ${parameter.coverageRatio}`);
  assert.equal(parameter.mae, stored.decomposition.forecast.parameters[0].mae);
  assert.ok(parameter.predictedMin < 20, `franchissement attendu, reçu ${parameter.predictedMin}`);

  const top = stored.scores[0];
  const moisture = top.criteria.find((criterion) => criterion.key === 'moisture');
  assert.equal(moisture.forecastAdjusted, true);
  assert.equal(moisture.downgradedByForecast, true, 'le critère est durci par la prévision');
  assert.equal(moisture.met, false);
  // La mesure d'origine reste lisible : le durcissement ne l'efface pas.
  assert.equal(moisture.observed, 25.5);
  assert.match(moisture.explanation, /Prévu hors plage/);

  // Le pH, non prévu, reste noté sur sa mesure.
  const ph = top.criteria.find((criterion) => criterion.key === 'ph');
  assert.equal(ph.forecastAdjusted, false);

  // La prévision figure parmi les sources du résultat.
  assert.ok(stored.sources.includes('forecast'), `sources : ${JSON.stringify(stored.sources)}`);

  // Le seuil de surveillance reste la plage agronomique, pas la projection :
  // le job d'alertes compare des mesures à la plage, la prévision à part.
  assert.equal(stored.thresholds.moisture.min, 20);
  assert.equal(stored.thresholds.moisture.max, 60);
});

test('Choix de culture : le classement prouvé est moins bon que le classement non prouvé', async () => {
  // Comparaison directe sur le même sol et la même période.
  await h.prisma.soilPrediction.updateMany({ where: { plotId, parameter: 'moisture' }, data: { beatsBaseline: false } });
  const unproven = await createRecommendation('comparaison-sans');
  await h.prisma.soilPrediction.updateMany({ where: { plotId, parameter: 'moisture' }, data: { beatsBaseline: true } });
  const proven = await createRecommendation('comparaison-avec');

  const scoreOf = (rec) => rec.scores.find((entry) => entry.cropSlug === 'mais')?.score ?? null;
  const before = scoreOf(unproven);
  const after = scoreOf(proven);

  assert.equal(before, 1, 'sans prévision, tous les critères mesurés sont conformes');
  assert.ok(after < before, `le score doit baisser : ${after} contre ${before}`);
});
