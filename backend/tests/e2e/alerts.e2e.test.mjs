import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Lot de référentiel dédié à cette suite.
 *
 * Posé **avant** `startHarness()` : la variable est lue à l'import de
 * l'application, donc trop tard ensuite. Un lot distinct garantit que ces
 * plages ne sont lisibles ni par la production ni par les autres suites.
 */
process.env.AGRONOMIC_DATASET = 'alerts';

const { startHarness } = await import('./support/harness.mjs');

/**
 * Recette de bout en bout — **base réelle** — surveillance des recommandations.
 *
 * Ce que cette suite prouve, et qu'aucun double en mémoire ne peut prouver :
 *   - un franchissement **réellement mesuré** crée une ligne dans
 *     `threshold_alerts`, avec sa contrainte d'unicité `(organisation, épisode)` ;
 *   - l'agriculteur reçoit un **SMS en français** et un email, capturés par le
 *     récepteur du harnais — pas simplement « une notification a été créée » ;
 *   - un second passage du job ne duplique ni l'alerte ni l'envoi : le délai de
 *     re-notification s'applique ;
 *   - une proposition de remplacement est calculée pour la période restante et
 *     reste `PENDING` ; l'ancienne recommandation ne passe en `SUPERSEDED`
 *     qu'après **acceptation explicite** ;
 *   - une prévision qui ne bat pas la persistance ne déclenche rien (CDC phase 7) ;
 *   - un capteur muet produit une alerte dans la même table ;
 *   - une alerte traitée ne re-notifie plus ;
 *   - l'isolation multi-tenant renvoie 404, pas 403.
 */

let h;
let farmerToken;
let agroToken;
let plotId;
let organizationId;
let recommendationId;

const PASSWORD = 'MotDePasse!2026';
const FARMER_EMAIL = 'fermier-alerte@agrikonnect.test';
const FARMER_PHONE = '+243810000111';
const AGRO_EMAIL = 'agro-alerte@agrikonnect.test';

const DAY = 86_400_000;
/**
 * Période de campagne **relative**, large de 215 jours (≈ 7 mois).
 *
 * La proposition de remplacement créée par le job couvre [jour de l'alerte ;
 * fin de période] et doit rester semable (fenêtres du maïs en Équateur :
 * mars–avril ou sept–octobre) quel que soit le jour d'exécution. Toute
 * fenêtre de ≥ 7 mois contient un mois de semis du maïs ; avec les dates
 * fixes « 20 octobre → 20 décembre » d'avant, la recette basculait en
 * INSUFFICIENT_DATA dès le 1er novembre. 215 jours < MAX_PERIOD_DAYS (365).
 */
const PERIOD_START = Date.now() - 15 * DAY;
const PERIOD_END = Date.now() + 200 * DAY;

const register = async ({ email, accountType = 'FARMER', firstName, lastName, phone }) => {
  const response = await h.request('POST', '/auth/register', {
    body: {
      accountType,
      firstName,
      lastName,
      email,
      password: PASSWORD,
      countryCode: 'CD',
      locale: 'fr',
      ...(phone ? { phone } : {}),
    },
  });
  assert.equal(response.status, 201, `inscription ${email} : ${JSON.stringify(response.body)}`);
};

const connect = async (email) => {
  const response = await h.request('POST', '/auth/login', { body: { identifier: email, password: PASSWORD } });
  assert.equal(response.status, 200, `connexion ${email} : ${JSON.stringify(response.body)}`);
  return response.body.data.session.accessToken;
};

/** Déclenche le job de surveillance par son nom, comme le ferait le planificateur. */
const runMonitoringJob = async () => {
  const { runJob } = await import('../../src/jobs/index.js');
  const outcome = await runJob('recommendations.monitor');
  assert.equal(outcome.ok, true, `job en échec : ${JSON.stringify(outcome)}`);
  return outcome.result;
};

before(async () => {
  h = await startHarness();

  await register({ email: FARMER_EMAIL, firstName: 'Josué', lastName: 'Bomoi', phone: FARMER_PHONE });

  // Les alertes SMS ne partent plus que vers un numéro confirmé par son
  // titulaire : la recette doit donc placer l'agriculteur dans l'état réel
  // d'un compte actif, sinon tous ses envois seraient retenus.
  await h.prisma.profile.updateMany({
    where: { phone: FARMER_PHONE },
    data: { phoneVerifiedAt: new Date() },
  });

  await register({ email: AGRO_EMAIL, accountType: 'AGRONOMIST', firstName: 'Alice', lastName: 'Muteba' });

  farmerToken = await connect(FARMER_EMAIL);
  agroToken = await connect(AGRO_EMAIL);

  const farm = await h.request('POST', '/farms', {
    token: farmerToken,
    body: {
      name: 'Ferme Mbandaka',
      countryCode: 'CD',
      province: 'Équateur',
      latitude: 0.0481,
      longitude: 18.2557,
      totalAreaHa: 8,
    },
  });
  assert.equal(farm.status, 201, JSON.stringify(farm.body));
  const farmId = farm.body.data.id ?? farm.body.data.farm?.id;

  const plot = await h.request('POST', '/plots', {
    token: farmerToken,
    body: {
      farmId,
      name: 'Parcelle surveillance',
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
   * Le fermier **consent** aux alertes SMS.
   *
   * Depuis que le job d'alertes passe par `sendAlertBatch()`, aucun SMS ne part
   * sans consentement — c'est la règle, pas un défaut de ce test. Le canal est
   * à sens unique en RDC, donc aucun « STOP » par SMS n'est possible et
   * l'accord doit être donné dans l'application.
   *
   * Sans cette ligne, les assertions sur le contenu du SMS (« en français, avec
   * la valeur et la plage ») ne prouveraient plus rien : elles porteraient sur
   * un message jamais envoyé.
   */
  const farmerProfile = await h.prisma.profile.findFirst({ where: { email: FARMER_EMAIL } });
  await h.prisma.smsConsent.create({
    data: {
      id: 'scon_alertes_e2e_0001',
      organizationId,
      userId: farmerProfile.id,
      purpose: 'ALERT',
      status: 'GRANTED',
      method: 'IN_APP',
      grantedAt: new Date(),
    },
  });

  // Référentiel agronomique : pH et température de l'air pour le maïs.
  // `datasetLabel` est explicite : `createRange` écrit dans `production` par
  // défaut, alors que le moteur lit le lot porté par `AGRONOMIC_DATASET`.
  for (const range of [
    { cropSlug: 'mais', parameterKey: 'ph', minValue: 5.5, maxValue: 7, unit: 'pH' },
    { cropSlug: 'mais', parameterKey: 'airTemperatureC', minValue: 21, maxValue: 30, unit: '°C' },
  ]) {
    // eslint-disable-next-line no-await-in-loop
    const created = await h.request('POST', '/agronomic-ranges', {
      token: agroToken,
      body: { ...range, datasetLabel: 'alerts', sourceReference: 'Source de test' },
    });
    assert.equal(created.status, 201, `plage ${range.parameterKey} : ${JSON.stringify(created.body)}`);
  }

  // Mesures conformes : pH 6.4 dans [5.5 ; 7].
  const assessment = await h.request('POST', `/plots/${plotId}/soil-assessments`, {
    token: farmerToken,
    body: {
      assessedAt: new Date('2026-10-01T00:00:00Z').toISOString(),
      parameters: [
        { key: 'ph', value: '6.4', numericValue: 6.4, unit: 'pH', source: 'measured_lab', confidence: 'high' },
        { key: 'ec', value: '1.2', numericValue: 1.2, unit: 'dS/m', source: 'measured_lab', confidence: 'high' },
      ],
    },
  });
  assert.equal(assessment.status, 201, JSON.stringify(assessment.body));

  // Station météo : la température de l'air vient de là, jamais d'une sonde de sol.
  await h.prisma.iotDevice.create({
    data: {
      id: 'device_alerte_station',
      organizationId,
      plotId,
      label: 'Station météo surveillance',
      keyHash: 'hash-e2e',
      lastSeenAt: new Date(),
    },
  });
  await h.prisma.sensorReading.create({
    data: {
      id: 'reading_alerte_temp',
      organizationId,
      plotId,
      deviceId: 'device_alerte_station',
      metric: 'airTemperatureC',
      value: 25,
      unit: '°C',
      source: 'measured_sensor',
      confidence: 'high',
      at: new Date('2026-10-02T00:00:00Z'),
      mode: 'REAL',
    },
  });

  // Recommandation initiale : deux critères évaluables, donc un classement réel.
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
    `statut inattendu — motif : ${recommendation.body.data.recommendation.insufficiencyReason} `
    + `| décomposition : ${JSON.stringify(recommendation.body.data.recommendation.decomposition?.insufficientData)}`,
  );
  recommendationId = recommendation.body.data.recommendation.id;

  // Les seuils surveillés dérivent des plages réelles, ils ne sont pas inventés.
  const stored = await h.prisma.cropRecommendation.findUnique({ where: { id: recommendationId } });
  assert.equal(stored.thresholds.ph.min, 5.5);
  assert.equal(stored.thresholds.ph.max, 7);
}, { timeout: 180_000 });

after(async () => {
  await h?.stop();
});

test('Surveillance : aucune alerte tant que les mesures restent dans les seuils', async () => {
  const result = await runMonitoringJob();
  assert.equal(result.recommendationsScanned >= 1, true, 'la recommandation active doit être balayée');
  assert.equal(result.alerts, 0, `aucun franchissement attendu : ${JSON.stringify(result)}`);

  const alerts = await h.prisma.thresholdAlert.findMany({ where: { organizationId } });
  assert.deepEqual(alerts, [], 'aucune alerte ne doit exister avant un franchissement');
});

test('Surveillance : un franchissement mesuré crée l’alerte, notifie et propose un remplacement', async () => {
  // Nouvelle analyse, plus récente, pH 8.5 : hors de [5.5 ; 7].
  const second = await h.request('POST', `/plots/${plotId}/soil-assessments`, {
    token: farmerToken,
    body: {
      assessedAt: new Date('2026-10-18T00:00:00Z').toISOString(),
      parameters: [
        { key: 'ph', value: '8.5', numericValue: 8.5, unit: 'pH', source: 'measured_lab', confidence: 'high' },
      ],
    },
  });
  assert.equal(second.status, 201, JSON.stringify(second.body));

  h.sink.reset();
  const result = await runMonitoringJob();
  assert.equal(result.alerts, 1, `une alerte attendue : ${JSON.stringify(result)}`);
  assert.equal(result.replacements, 1, 'une proposition de remplacement attendue');

  const alert = await h.prisma.thresholdAlert.findUnique({
    where: { organizationId_episodeKey: { organizationId, episodeKey: `ph:${recommendationId}` } },
  });
  assert.ok(alert, 'l’alerte doit porter la clé d’épisode paramètre:recommandation');
  assert.equal(alert.parameter, 'ph');
  assert.equal(alert.sourceType, 'MEASUREMENT');
  assert.equal(alert.observedValue, 8.5);
  assert.equal(alert.referenceValue, 7, 'la borne dépassée est la référence');
  assert.equal(alert.severity, 'WARNING', 'le pH n’est pas un critère éliminatoire');
  assert.equal(alert.plotId, plotId);
  assert.equal(alert.notificationCount, 1);
  assert.ok(alert.notifiedAt, 'l’alerte doit être horodatée comme notifiée');

  // Email obligatoire + SMS canal principal : les deux canaux ont servi.
  assert.ok(alert.channelsSent.includes('EMAIL'), `canaux : ${alert.channelsSent}`);
  assert.ok(alert.channelsSent.includes('SMS'), `canaux : ${alert.channelsSent}`);

  // Le SMS est réellement parti, en français, avec la valeur et la plage.
  const sms = h.sink.messages.sms.filter((m) => m.to === FARMER_PHONE);
  assert.equal(sms.length, 1, `un SMS attendu vers ${FARMER_PHONE}`);
  // Le **corps** du SMS est en minuscules après « AGRIKONNET : » ; c'est le
  // titre (in-app et email) qui garde la majuscule.
  assert.match(sms[0].message, /seuil dépassé/i);
  assert.match(sms[0].message, /pH du sol/);
  assert.match(sms[0].message, /8,5/);
  // Crochets retirés : `[` et `]` sont au jeu **étendu** GSM, comptés double.
  assert.match(sms[0].message, /5,5 à 7/);
  // Le nom est **tronqué** à 18 caractères pour tenir dans un segment :
  // « Parcelle surveillance » (21) devient « Parcelle surveill. ». C'est voulu —
  // la troncature se voit grâce au point final.
  assert.match(sms[0].message, /Parcelle surveill\./);
  assert.doesNotMatch(sms[0].message, /SIMULÉ/, 'une mesure réelle n’est pas étiquetée simulée');

  // L’email est parti à la même adresse que le compte.
  const email = h.sink.messages.email.find((m) => m.to === FARMER_EMAIL);
  assert.ok(email, 'l’email est obligatoire');
  assert.match(email.subject, /Seuil dépassé/);

  // La proposition de remplacement couvre la période restante et attend la décision.
  const replacement = await h.prisma.cropRecommendation.findUnique({
    where: { id: alert.replacementRecommendationId },
  });
  assert.ok(replacement, 'une proposition de remplacement doit exister');
  assert.equal(replacement.status, 'PENDING', 'elle attend l’agriculteur');
  assert.equal(replacement.plotId, plotId);
  assert.ok(replacement.periodEnd.getTime() === new Date(PERIOD_END).getTime());
  assert.ok(replacement.periodStart > new Date(PERIOD_START), 'elle part du jour de l’alerte');

  // L’ancienne recommandation reste active : rien n’est remplacé sans acceptation.
  const original = await h.prisma.cropRecommendation.findUnique({ where: { id: recommendationId } });
  assert.equal(original.status, 'ACTIVE');
});

test('Surveillance : un second passage ne duplique ni l’alerte ni l’envoi', async () => {
  h.sink.reset();
  const result = await runMonitoringJob();
  assert.equal(result.alerts, 1, 'l’alerte existante est mise à jour, pas recréée');
  assert.equal(result.replacements, 0, 'une seule proposition de remplacement');

  const alerts = await h.prisma.thresholdAlert.findMany({
    where: { organizationId, parameter: 'ph' },
  });
  assert.equal(alerts.length, 1, `une seule ligne attendue, reçu ${alerts.length}`);
  assert.equal(alerts[0].notificationCount, 1, 'le délai de re-notification bloque le rappel');

  assert.deepEqual(h.sink.messages.sms, [], 'aucun SMS supplémentaire avant le délai');
  assert.deepEqual(h.sink.messages.email, [], 'aucun email supplémentaire avant le délai');
});

test('Surveillance : une prévision non prouvée ne déclenche aucune alerte préventive', async () => {
  // Prévision annonçant un franchissement, mais **battue par la persistance**.
  await h.prisma.soilPrediction.create({
    data: {
      id: 'pred_alerte_battue',
      organizationId,
      plotId,
      parameter: 'ph',
      horizonDays: 14,
      values: [
        { at: new Date(Date.now() + 3 * 86_400_000).toISOString(), value: 9.1, low: 8.5, high: 9.7 },
      ],
      mae: 1.2,
      rmse: 1.4,
      baselineMae: 0.3,
      beatsBaseline: false,
      mode: 'REAL',
    },
  });

  h.sink.reset();
  const before = await h.prisma.thresholdAlert.count({ where: { organizationId } });
  await runMonitoringJob();
  const after = await h.prisma.thresholdAlert.count({ where: { organizationId } });

  assert.equal(after, before, 'une prévision battue par la persistance n’alerte pas');
  assert.deepEqual(h.sink.messages.sms, []);
});

test('Surveillance : une prévision meilleure que la persistance alerte à l’avance', async () => {
  // `beatsBaseline` passe à vrai : la même série devient exploitable.
  await h.prisma.soilPrediction.update({
    where: { id: 'pred_alerte_battue' },
    data: { beatsBaseline: true, mae: 0.2, baselineMae: 0.9 },
  });

  h.sink.reset();
  const result = await runMonitoringJob();
  assert.ok(result.alerts >= 1, `une alerte préventive attendue : ${JSON.stringify(result)}`);

  const forecast = await h.prisma.thresholdAlert.findFirst({
    where: { organizationId, sourceType: 'FORECAST' },
  });
  assert.ok(forecast, 'l’alerte préventive doit exister');
  assert.equal(forecast.parameter, 'ph');
  assert.equal(forecast.predictive, true);
  assert.ok(forecast.predictedBreachAt, 'la date estimée de franchissement est portée');
  assert.ok(forecast.predictedBreachAt > new Date(), 'le franchissement est à venir');
  assert.notEqual(
    forecast.episodeKey,
    `ph:${recommendationId}`,
    'l’alerte préventive ne doit pas écraser l’alerte de mesure',
  );
  assert.match(forecast.message, /[Pp]révision/);
});

test('Décision : un refus écarte la proposition et laisse l’ancienne active', async () => {
  const alert = await h.prisma.thresholdAlert.findFirst({
    where: { organizationId, sourceType: 'MEASUREMENT' },
  });
  const replacementId = alert.replacementRecommendationId;
  assert.ok(replacementId, 'l’alerte porte la proposition de remplacement');

  const rejected = await h.request('POST', `/recommendations/${replacementId}/decision`, {
    token: farmerToken,
    body: { decision: 'REJECTED', comment: 'Je préfère attendre une analyse complète.' },
  });
  assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
  assert.equal(rejected.body.data.status, 'REJECTED');

  const stillActive = await h.prisma.cropRecommendation.findUnique({ where: { id: recommendationId } });
  assert.equal(stillActive.status, 'ACTIVE', 'un refus ne remplace rien');

  // Une décision ne se rejoue pas : le statut est déjà tranché.
  const replay = await h.request('POST', `/recommendations/${replacementId}/decision`, {
    token: farmerToken,
    body: { decision: 'ACCEPTED' },
  });
  assert.equal(replay.status, 409, JSON.stringify(replay.body));
});

test('Décision : le job ne réempile pas de proposition tant qu’une existe', async () => {
  const before = await h.prisma.cropRecommendation.count({
    where: { plotId, organizationId, status: 'PENDING' },
  });

  await runMonitoringJob();
  await runMonitoringJob();

  const after = await h.prisma.cropRecommendation.count({
    where: { plotId, organizationId, status: 'PENDING' },
  });
  assert.equal(after, before, `aucune proposition supplémentaire attendue (${before} → ${after})`);
});

test('Décision : accepter une proposition active remplace réellement l’ancienne', async () => {
  // Nouvelle proposition calculée pour la période restante, acceptée aussitôt.
  const proposal = await h.request('POST', `/plots/${plotId}/recommendations`, {
    token: farmerToken,
    body: {
      periodStart: new Date().toISOString(),
      periodEnd: new Date(PERIOD_END).toISOString(),
    },
  });
  assert.equal(proposal.status, 201, JSON.stringify(proposal.body));
  const proposalId = proposal.body.data.recommendation.id;
  assert.equal(proposal.body.data.recommendation.status, 'ACTIVE');

  const decision = await h.request('POST', `/recommendations/${proposalId}/decision`, {
    token: farmerToken,
    body: { decision: 'ACCEPTED' },
  });
  assert.equal(decision.status, 200, JSON.stringify(decision.body));

  const superseded = await h.prisma.cropRecommendation.findUnique({ where: { id: recommendationId } });
  assert.equal(superseded.status, 'SUPERSEDED', 'l’ancienne passe en remplacée après acceptation');

  const kept = await h.prisma.cropRecommendation.findUnique({ where: { id: proposalId } });
  assert.equal(kept.status, 'ACTIVE');

  // Une seule recommandation active à la fois sur la parcelle.
  const activeCount = await h.prisma.cropRecommendation.count({
    where: { plotId, organizationId, status: 'ACTIVE' },
  });
  assert.equal(activeCount, 1, `une seule active attendue, reçu ${activeCount}`);
});

test('Capteur silencieux : une alerte dans la même table, avec le silence constaté', async () => {
  await h.prisma.iotDevice.create({
    data: {
      id: 'device_alerte_muet',
      organizationId,
      plotId,
      label: 'Sonde pH nord',
      keyHash: 'hash-e2e',
      // 48 h sans remontée, pour un seuil de 24 h.
      lastSeenAt: new Date(Date.now() - 48 * 3600 * 1000),
    },
  });

  h.sink.reset();
  const result = await runMonitoringJob();
  assert.equal(result.silentSensors.thresholdHours, 24);
  assert.ok(result.silentSensors.silent >= 1, `capteur muet attendu : ${JSON.stringify(result.silentSensors)}`);

  const alert = await h.prisma.thresholdAlert.findUnique({
    where: { organizationId_episodeKey: { organizationId, episodeKey: 'sensorSilence:device_alerte_muet' } },
  });
  assert.ok(alert, 'l’alerte de silence doit exister');
  assert.equal(alert.sourceType, 'SENSOR_SILENCE');
  assert.equal(alert.parameter, 'sensorSilence');
  assert.equal(alert.referenceValue, 24, 'la référence est le seuil de silence');
  assert.ok(alert.observedValue >= 47, `silence constaté : ${alert.observedValue}`);
  assert.equal(alert.deviceId, 'device_alerte_muet');

  const sms = h.sink.messages.sms.filter((m) => m.to === FARMER_PHONE);
  assert.ok(sms.some((m) => /capteur silencieux/i.test(m.message)), 'le SMS nomme le capteur muet');
  assert.ok(sms.some((m) => /Sonde pH nord/.test(m.message)));
});

test('Suivi : une alerte traitée ne re-notifie plus', async () => {
  const alert = await h.prisma.thresholdAlert.findFirst({
    where: { organizationId, sourceType: 'MEASUREMENT' },
  });

  const read = await h.request('POST', `/alerts/${alert.id}/read`, { token: farmerToken });
  assert.equal(read.status, 200, JSON.stringify(read.body));
  assert.equal(read.body.data.status, 'READ');

  const handled = await h.request('POST', `/alerts/${alert.id}/handled`, { token: farmerToken });
  assert.equal(handled.status, 200, JSON.stringify(handled.body));
  assert.equal(handled.body.data.status, 'HANDLED');

  // Forcer un rappel dû en reculant l’horodatage de dernière notification.
  await h.prisma.thresholdAlert.update({
    where: { id: alert.id },
    data: { lastNotifiedAt: new Date(Date.now() - 72 * 3600 * 1000) },
  });

  h.sink.reset();
  await runMonitoringJob();

  const after = await h.prisma.thresholdAlert.findUnique({ where: { id: alert.id } });
  assert.equal(after.status, 'HANDLED', 'le job ne rouvre pas une alerte traitée');

  const renotifySms = h.sink.messages.sms.filter((m) => /seuil dépassé/i.test(m.message ?? ''));
  assert.deepEqual(renotifySms, [], 'aucun rappel pour une alerte close');

  // La clôture est auditée.
  const audits = await h.prisma.auditLog.findMany({ where: { resourceId: alert.id } });
  assert.ok(audits.some((row) => row.action === 'alert.handle'), audits.map((r) => r.action).join(', '));
});

test('Lecture : la boîte d’alertes est filtrable et paginée', async () => {
  const all = await h.request('GET', '/alerts', { token: farmerToken });
  assert.equal(all.status, 200, JSON.stringify(all.body));
  assert.ok(all.body.data.length >= 2, 'mesure + silence');
  assert.ok(all.body.meta.openCount >= 1);

  const open = await h.request('GET', '/alerts?open=true', { token: farmerToken });
  assert.equal(open.status, 200);
  assert.ok(open.body.data.every((item) => item.status !== 'HANDLED'));

  const bySource = await h.request('GET', '/alerts?sourceType=SENSOR_SILENCE', { token: farmerToken });
  assert.equal(bySource.status, 200);
  assert.ok(bySource.body.data.every((item) => item.sourceType === 'SENSOR_SILENCE'));

  // `open` et `status` sont exclusifs : les accepter ensemble laisserait croire
  // que les deux filtres s’appliquent.
  const conflict = await h.request('GET', '/alerts?open=true&status=NEW', { token: farmerToken });
  assert.equal(conflict.status, 422, JSON.stringify(conflict.body));

  // Source inconnue refusée par l’énumération.
  const badSource = await h.request('GET', '/alerts?sourceType=DIVINATION', { token: farmerToken });
  assert.equal(badSource.status, 422, JSON.stringify(badSource.body));
});

test('Isolation : l’alerte d’une autre organisation est invisible (404, pas 403)', async () => {
  await register({ email: 'tiers-alerte@agrikonnect.test', firstName: 'Paulin', lastName: 'Ilunga' });
  const otherToken = await connect('tiers-alerte@agrikonnect.test');

  const alert = await h.prisma.thresholdAlert.findFirst({ where: { organizationId } });

  const detail = await h.request('GET', `/alerts/${alert.id}`, { token: otherToken });
  assert.equal(detail.status, 404, JSON.stringify(detail.body));

  const handle = await h.request('POST', `/alerts/${alert.id}/handled`, { token: otherToken });
  assert.equal(handle.status, 404, JSON.stringify(handle.body));

  // Sa propre boîte est vide : aucune alerte d’autrui ne fuit.
  const list = await h.request('GET', '/alerts', { token: otherToken });
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.data, []);
});

test('Aucune route ne permet de fabriquer une alerte sans mesure', async () => {
  const forbidden = await h.request('POST', '/alerts', {
    token: farmerToken,
    body: { parameter: 'ph', observedValue: 99, episodeKey: 'ph:fabrique' },
  });
  assert.equal(forbidden.status, 404, 'la création manuelle n’existe pas');

  const fabricated = await h.prisma.thresholdAlert.findFirst({
    where: { organizationId, episodeKey: 'ph:fabrique' },
  });
  assert.equal(fabricated, null);
});

/* ─────────────────── écran 3 : libellés portés par l'API ─────────────────── */

/**
 * L'écran 3 affiche source, gravité, statut, grandeur, valeur observée et
 * plage. L'API renvoyait auparavant les lignes Prisma brutes : les écrans
 * n'auraient eu que le choix entre afficher `MEASUREMENT` et **recopier** une
 * table de libellés — le défaut de l'écran 2, avec en plus le risque que les
 * deux clients divergent.
 *
 * Ces tests vérifient que les libellés arrivent de l'API **et** qu'ils
 * correspondent aux codes : un libellé décoratif qui dirait autre chose que le
 * code serait pire qu'un code brut.
 */
const {
  SEVERITY_LABELS,
  SOURCE_TYPE_LABELS,
  STATUS_LABELS,
  formatRange,
  parameterLabel,
} = await import('../../src/modules/alerts/alertLabels.js');

test('Écran 3 : la liste porte les libellés, cohérents avec les codes', async () => {
  const reponse = await h.request('GET', '/alerts', { token: farmerToken });
  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));
  assert.ok(reponse.body.data.length >= 2, 'attendu au moins une mesure et un silence');

  for (const alerte of reponse.body.data) {
    assert.equal(
      alerte.sourceTypeLabel,
      SOURCE_TYPE_LABELS[alerte.sourceType],
      `libellé de source incohérent pour ${alerte.sourceType}`,
    );
    assert.equal(alerte.severityLabel, SEVERITY_LABELS[alerte.severity]);
    assert.equal(alerte.statusLabel, STATUS_LABELS[alerte.status]);
    assert.equal(alerte.parameterLabel, parameterLabel(alerte.parameter));

    // Le seuil franchi doit être lisible, pas un nombre nu.
    assert.ok(
      typeof alerte.referenceLabel === 'string' && alerte.referenceLabel.length > 0,
      'referenceLabel absent',
    );
    assert.ok(
      alerte.referenceLabel.startsWith(String(alerte.referenceValue)),
      `referenceLabel « ${alerte.referenceLabel} » ne commence pas par ${alerte.referenceValue}`,
    );
  }

  // Le cas particulier : un capteur silencieux n'est pas une mauvaise mesure.
  const silences = reponse.body.data.filter((a) => a.sourceType === 'SENSOR_SILENCE');
  assert.ok(silences.length >= 1, 'aucune alerte de capteur silencieux dans le jeu');
  for (const silence of silences) {
    assert.equal(silence.sourceTypeLabel, 'Capteur silencieux');
    assert.equal(silence.parameterLabel, 'Délai depuis la dernière remontée');
    assert.equal(silence.unit, 'h');
  }
});

test('Écran 3 : le détail porte la plage de référence et son statut', async () => {
  const liste = await h.request('GET', '/alerts', { token: farmerToken });
  const mesure = liste.body.data.find((a) => a.sourceType === 'MEASUREMENT');
  assert.ok(mesure, 'aucune alerte de mesure pour tester la plage');

  const detail = await h.request('GET', `/alerts/${mesure.id}`, { token: farmerToken });
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  const alerte = detail.body.data;

  /*
   * La plage vient des `thresholds` de la recommandation liée — pas d'un
   * recalcul. Afficher ici une plage différente de celle qui a déclenché
   * l'alerte serait trompeur.
   */
  assert.ok(alerte.range, 'le détail doit porter la plage de référence');
  assert.equal(typeof alerte.range.min, 'number', 'plage sans borne minimale');
  assert.ok(alerte.range.label, 'plage sans libellé formaté');
  assert.equal(alerte.range.label, formatRange(alerte.range));

  /*
   * Aucune plage n'est validée dans ce jeu de données : une alerte fondée sur
   * une plage provisoire doit le dire. Si un jour une plage est validée, cette
   * assertion échouera — c'est le signal attendu, pas une régression.
   */
  assert.equal(
    alerte.range.status,
    'PROVISIONAL',
    `plage attendue PROVISIONAL, reçu ${alerte.range.status}`,
  );
});

test('Écran 3 : marquer lue puis traitée renvoie l’alerte enrichie', async () => {
  const liste = await h.request('GET', '/alerts?status=NEW', { token: farmerToken });
  const alerte = liste.body.data[0];
  assert.ok(alerte, 'aucune alerte NEW à faire évoluer');

  const lue = await h.request('POST', `/alerts/${alerte.id}/read`, { token: farmerToken });
  assert.equal(lue.status, 200, JSON.stringify(lue.body));
  assert.equal(lue.body.data.status, 'READ');
  assert.equal(lue.body.data.statusLabel, 'Lue', 'le statut renvoyé doit porter son libellé');

  /*
   * Avec `farmerToken`, pas `agroToken` : l'agronome est dans une **autre
   * organisation** et `findOwned` renvoie 404 — c'est l'isolation tenant qui
   * fonctionne, pas un défaut. Un premier essai avec le jeton agronome a échoué
   * en 404 pour cette raison exacte.
   */
  const traitee = await h.request('POST', `/alerts/${alerte.id}/handled`, { token: farmerToken });
  assert.equal(traitee.status, 200, JSON.stringify(traitee.body));
  assert.equal(traitee.body.data.status, 'HANDLED');
  assert.equal(traitee.body.data.statusLabel, 'Traitée');
});

test('Écran 3 : /alerts/meta expose les valeurs de filtre avec leurs libellés', async () => {
  /*
   * Déclarée APRÈS `/alerts/:id` dans le fichier de routes, cette route serait
   * avalée par `/:id` avec `id = 'meta'` et renverrait 404. Ce test est le
   * garde-fou de cet ordre de déclaration.
   */
  const reponse = await h.request('GET', '/alerts/meta', { token: farmerToken });
  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));

  const { sourceTypes, severities, statuses } = reponse.body.data;
  assert.deepEqual(
    sourceTypes.map((s) => s.value),
    ['MEASUREMENT', 'FORECAST', 'SENSOR_SILENCE'],
  );
  assert.deepEqual(
    sourceTypes.map((s) => s.label),
    ['Mesure', 'Prévision', 'Capteur silencieux'],
  );
  assert.deepEqual(severities.map((s) => s.value), ['INFO', 'WARNING', 'CRITICAL']);
  assert.deepEqual(statuses.map((s) => s.value), ['NEW', 'READ', 'HANDLED']);

  // Aucune valeur sans libellé : c'est ce qui rendrait le filtre muet.
  for (const liste of [sourceTypes, severities, statuses]) {
    for (const option of liste) {
      assert.ok(typeof option.label === 'string' && option.label.length > 0, `libellé vide pour ${option.value}`);
      assert.notEqual(option.label, option.value, `« ${option.value} » n'est pas un libellé`);
    }
  }
});
