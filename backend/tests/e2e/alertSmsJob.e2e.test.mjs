import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

/**
 * Recette de bout en bout — **base réelle + faux serveur Twilio** — le job
 * d'alertes passe par `sendAlertBatch()`.
 *
 * ## Ce que cette suite prouve
 *
 * Une alerte **réellement déclenchée par le job de surveillance** (pas un appel
 * direct au service) produit un SMS vers l'API Twilio, **et seulement pour les
 * destinataires qui ont consenti**. Elle prouve aussi que :
 *
 *  - le destinataire sans consentement est **retenu**, avec la raison
 *    enregistrée dans le journal de lot ;
 *  - un seul passage du job écrit **un seul lot**, avec ses compteurs ;
 *  - l'email et la notification in-app partent **dans tous les cas** : le
 *    consentement SMS ne coupe que le SMS, pas l'alerte.
 *
 * ## Ce que cette suite ne prouve pas
 *
 * **Aucun SMS réel n'est livré.** Le serveur est faux : il répond `queued` sans
 * contacter aucun opérateur.
 */

process.env.AGRONOMIC_DATASET = 'alertsms';

const AUTH_TOKEN = 'faux_jeton_auth_twilio_job_alertes';
const ACCOUNT_SID = 'ACfauxcomptedetest0002';

let fake;
let received = [];

const startFakeTwilio = () =>
  new Promise((resolve) => {
    fake = createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => {
        raw += chunk;
      });
      req.on('end', () => {
        received.push({ url: req.url, form: Object.fromEntries(new URLSearchParams(raw)) });
        res.setHeader('content-type', 'application/json');
        res.statusCode = 201;
        res.end(
          JSON.stringify({
            sid: `SM${received.length.toString().padStart(32, '0')}`,
            status: 'queued',
            numSegments: '1',
          }),
        );
      });
    });
    fake.listen(0, '127.0.0.1', () => {
      process.env.TWILIO_ACCOUNT_SID = ACCOUNT_SID;
      process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
      process.env.TWILIO_API_BASE_URL = `http://127.0.0.1:${fake.address().port}`;
      process.env.TWILIO_SENDER_ID = 'AGRIKONNECT';
      process.env.E2E_SMS_PROVIDER = 'twilio';
      // Plafond haut : cette suite teste le consentement, pas le plafond
      // (couvert par `smsTwilio.e2e.test.mjs`).
      process.env.SMS_DAILY_LIMIT_PER_FARMER = '50';
      process.env.SMS_DAILY_LIMIT_PER_ORGANIZATION = '500';
      resolve();
    });
  });

await startFakeTwilio();

const { startHarness } = await import('./support/harness.mjs');

let h;
let farmerToken;
let agroToken;
let plotId;
let organizationId;
/** Le second membre, **sans** consentement : c'est lui que le lot doit retenir. */
const NO_CONSENT_PHONE = '+243810000222';
const WITH_CONSENT_PHONE = '+243810000333';

const PASSWORD = 'MotDePasse!2026';

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
  const response = await h.request('POST', '/auth/login', {
    body: { identifier: email, password: PASSWORD },
  });
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

  await register({
    email: 'fermier-consent@agrikonnect.test',
    firstName: 'Josué',
    lastName: 'Bomoi',
    phone: WITH_CONSENT_PHONE,
  });
  await register({
    email: 'agro-smsjob@agrikonnect.test',
    accountType: 'AGRONOMIST',
    firstName: 'Alice',
    lastName: 'Muteba',
  });
  // Second destinataire : il sera rattaché à la même organisation, **sans**
  // consentement SMS.
  await register({
    email: 'fermier-sansconsent@agrikonnect.test',
    firstName: 'Marie',
    lastName: 'Boseko',
    phone: NO_CONSENT_PHONE,
  });

  /*
   * Les deux numéros sont confirmés. Sans cela tous les envois seraient
   * retenus pour `PHONE_UNVERIFIED` et cette suite mesurerait autre chose que
   * le consentement, qui est son objet.
   */
  await h.prisma.profile.updateMany({
    where: { phone: { in: [WITH_CONSENT_PHONE, NO_CONSENT_PHONE] } },
    data: { phoneVerifiedAt: new Date() },
  });

  farmerToken = await connect('fermier-consent@agrikonnect.test');
  agroToken = await connect('agro-smsjob@agrikonnect.test');

  const farm = await h.request('POST', '/farms', {
    token: farmerToken,
    body: {
      name: 'Ferme SMS',
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
      name: 'Parcelle SMS',
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
   * Le second membre rejoint l'organisation du premier.
   *
   * Une inscription crée une organisation individuelle : sans ce rattachement,
   * les deux fermiers ne seraient pas destinataires de la même alerte et le
   * test ne comparerait rien.
   */
  const second = await h.prisma.profile.findFirst({
    where: { email: 'fermier-sansconsent@agrikonnect.test' },
  });
  await h.prisma.membership.create({
    data: { userId: second.id, organizationId, roles: ['COOPERATIVE_MEMBER'], status: 'ACTIVE' },
  });

  // **Un seul** des deux a consenti aux alertes SMS.
  const first = await h.prisma.profile.findFirst({
    where: { email: 'fermier-consent@agrikonnect.test' },
  });
  await h.prisma.smsConsent.create({
    data: {
      id: 'scon_smsjob_e2e_0001',
      organizationId,
      userId: first.id,
      purpose: 'ALERT',
      status: 'GRANTED',
      method: 'IN_APP',
      grantedAt: new Date(),
    },
  });

  // Référentiel : pH et température de l'air pour le maïs.
  for (const range of [
    { cropSlug: 'mais', parameterKey: 'ph', minValue: 5.5, maxValue: 7, unit: 'pH' },
    { cropSlug: 'mais', parameterKey: 'airTemperatureC', minValue: 21, maxValue: 30, unit: '°C' },
  ]) {
    // eslint-disable-next-line no-await-in-loop
    const created = await h.request('POST', '/agronomic-ranges', {
      token: agroToken,
      body: { ...range, datasetLabel: 'alertsms', sourceReference: 'Source de test' },
    });
    assert.equal(created.status, 201, `plage ${range.parameterKey} : ${JSON.stringify(created.body)}`);
  }

  // Mesure **hors plage** : pH 8.5, au-dessus de 7. C'est elle qui déclenche.
  const assessment = await h.request('POST', `/plots/${plotId}/soil-assessments`, {
    token: farmerToken,
    body: {
      assessedAt: new Date().toISOString(),
      parameters: [
        { key: 'ph', value: '8.5', numericValue: 8.5, unit: 'pH', source: 'measured_lab', confidence: 'high' },
        { key: 'ec', value: '1.2', numericValue: 1.2, unit: 'dS/m', source: 'measured_lab', confidence: 'high' },
      ],
    },
  });
  assert.equal(assessment.status, 201, JSON.stringify(assessment.body));

  await h.prisma.iotDevice.create({
    data: {
      id: 'device_smsjob_station',
      organizationId,
      plotId,
      label: 'Station météo SMS',
      keyHash: 'hash-e2e-smsjob',
      lastSeenAt: new Date(),
    },
  });
  await h.prisma.sensorReading.create({
    data: {
      id: 'reading_smsjob_temp',
      organizationId,
      plotId,
      deviceId: 'device_smsjob_station',
      metric: 'airTemperatureC',
      value: 25,
      unit: '°C',
      source: 'measured_sensor',
      confidence: 'high',
      at: new Date(),
      mode: 'REAL',
    },
  });

  const recommendation = await h.request('POST', `/plots/${plotId}/recommendations`, {
    token: farmerToken,
    body: {
      periodStart: new Date('2026-10-20T00:00:00Z').toISOString(),
      periodEnd: new Date('2026-12-20T00:00:00Z').toISOString(),
    },
  });
  assert.equal(recommendation.status, 201, JSON.stringify(recommendation.body));
  assert.equal(
    recommendation.body.data.recommendation.status,
    'ACTIVE',
    `motif : ${recommendation.body.data.recommendation.insufficiencyReason}`,
  );
}, { timeout: 180_000 });

after(async () => {
  await h?.stop();
  await new Promise((resolve) => fake?.close(resolve));
});

/* ─────────────────── Le job déclenche le SMS ─────────────────── */

test('Job d’alertes : un franchissement envoie un SMS à Twilio, au destinataire qui a consenti', async () => {
  const before = received.length;
  const result = await runMonitoringJob();
  assert.ok(result.alerts >= 1, `une alerte est attendue : ${JSON.stringify(result)}`);

  // ── Le SMS est réellement parti vers l'API Twilio ──
  const sent = received.slice(before);
  assert.equal(sent.length, 1, `un seul SMS attendu — ${sent.length} reçu(s)`);
  assert.match(sent[0].url, new RegExp(`/2010-04-01/Accounts/${ACCOUNT_SID}/Messages\\.json$`));
  assert.equal(sent[0].form.From, 'AGRIKONNECT', 'identifiant alphanumérique');
  assert.equal(
    sent[0].form.To,
    WITH_CONSENT_PHONE,
    'le SMS doit partir vers le destinataire qui a consenti',
  );
  assert.match(sent[0].form.Body, /AGRIKONNECT/, 'le message est signé');
  assert.match(sent[0].form.Body, /8,5/, 'la valeur observée est citée');

  // ── Le destinataire sans consentement n'a rien reçu ──
  assert.ok(
    !sent.some((call) => call.form.To === NO_CONSENT_PHONE),
    'aucun SMS ne doit partir vers un destinataire sans consentement',
  );

  // ── L'envoi est enregistré, avec son identifiant fournisseur ──
  const messages = await h.prisma.smsMessage.findMany({ where: { organizationId } });
  assert.equal(messages.length, 1, 'un seul message enregistré');
  assert.equal(messages[0].phone, WITH_CONSENT_PHONE);
  assert.equal(messages[0].purpose, 'ALERT');
  assert.ok(messages[0].providerMessageId, 'l’identifiant fournisseur permet le suivi de remise');
  assert.ok(messages[0].alertId, 'le message est rattaché à l’alerte qui l’a provoqué');
  assert.ok(messages[0].batchId, 'le message appartient à un lot');
  // Le consentement sur lequel l'envoi s'est appuyé est recopié.
  assert.equal(messages[0].consentSnapshot?.status, 'GRANTED');
  // **Accepté n'est pas remis.**
  assert.notEqual(messages[0].status, 'DELIVERED');
});

test('Job d’alertes : le journal de lot compte l’envoyé et le retenu, par raison', async () => {
  const logs = await h.prisma.smsBatchLog.findMany({
    where: { organizationId },
    orderBy: { startedAt: 'desc' },
  });
  assert.ok(logs.length >= 1, 'un journal de lot doit exister');
  const log = logs[0];

  assert.equal(log.candidates, 2, 'les deux membres étaient candidats');
  assert.equal(log.sent, 1, 'un seul a consenti');
  assert.equal(log.skipped, 1);
  assert.deepEqual(
    log.skippedByReason,
    { NO_CONSENT: 1 },
    `la raison compte autant que le nombre : ${JSON.stringify(log.skippedByReason)}`,
  );
  assert.equal(log.failed, 0);
  assert.ok(log.totalSegments >= 1);
  assert.ok(log.finishedAt, 'le lot est clos');
});

test('Job d’alertes : le consentement SMS ne coupe ni l’email ni l’in-app', async () => {
  /**
   * Un refus de SMS ne doit pas faire disparaître l'alerte. Le destinataire
   * sans consentement la voit dans l'application et la reçoit par email.
   */
  const alerts = await h.prisma.thresholdAlert.findMany({ where: { organizationId } });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].notificationCount, 1, 'l’alerte a bien été notifiée');
  assert.ok(alerts[0].channelsSent.includes('IN_APP'), `canaux : ${alerts[0].channelsSent}`);
  assert.ok(alerts[0].channelsSent.includes('EMAIL'), `canaux : ${alerts[0].channelsSent}`);
  assert.ok(alerts[0].channelsSent.includes('SMS'), 'le canal SMS a servi pour celui qui a consenti');
});

test('Job d’alertes : le retrait du consentement coupe les envois suivants', async () => {
  // Retrait du consentement du seul destinataire qui l'avait donné.
  await h.prisma.smsConsent.update({
    where: { id: 'scon_smsjob_e2e_0001' },
    data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
  });

  // Une nouvelle alerte, sur un autre paramètre, pour forcer un nouvel envoi.
  await h.prisma.sensorReading.create({
    data: {
      id: 'reading_smsjob_temp2',
      organizationId,
      plotId,
      deviceId: 'device_smsjob_station',
      metric: 'airTemperatureC',
      value: 45,
      unit: '°C',
      source: 'measured_sensor',
      confidence: 'high',
      at: new Date(),
      mode: 'REAL',
    },
  });

  const before = received.length;
  const result = await runMonitoringJob();
  assert.ok(result.alerts >= 1, `une alerte est attendue : ${JSON.stringify(result)}`);

  const sent = received.slice(before);
  assert.equal(
    sent.length,
    0,
    `aucun SMS ne doit partir après retrait — ${sent.length} envoyé(s)`,
  );

  const logs = await h.prisma.smsBatchLog.findMany({
    where: { organizationId },
    orderBy: { startedAt: 'desc' },
  });
  assert.equal(logs[0].sent, 0);
  /**
   * Les deux destinataires sont retenus, mais **pour deux raisons distinctes** —
   * et c'est précisément ce que le détail par raison existe pour montrer :
   *
   *  - celui qui avait consenti puis s'est désinscrit → `CONSENT_WITHDRAWN` ;
   *  - celui qui n'a jamais consenti → `NO_CONSENT`.
   *
   * Les confondre en un seul compteur ferait perdre la seule information utile :
   * relancer une campagne de consentement ne concerne que les seconds.
   */
  assert.deepEqual(
    logs[0].skippedByReason,
    { CONSENT_WITHDRAWN: 1, NO_CONSENT: 1 },
    `raisons attendues distinctes : ${JSON.stringify(logs[0].skippedByReason)}`,
  );
});
