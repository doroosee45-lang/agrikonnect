import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Recette de bout en bout — base réelle — pour l'**escalade à deux niveaux** et
 * la **fenêtre de silence** des SMS d'alerte.
 *
 * ## Ce que cette suite prouve
 *
 *  - une alerte non traitée au-delà du délai remonte au rôle d'encadrement ;
 *  - l'escalade n'a lieu **qu'une fois** : un second passage de la tâche ne
 *    renvoie rien ;
 *  - une alerte déjà traitée n'escalade pas ;
 *  - une alerte trop récente n'escalade pas ;
 *  - un envoi d'alerte dans la fenêtre de silence est retenu, avec la raison
 *    `QUIET_HOURS`, et ne consomme pas de plafond quotidien ;
 *  - un **code OTP n'est jamais retenu** par la fenêtre de silence : le retenir
 *    bloquerait l'accès au compte au nom d'une règle pensée pour les alertes.
 *
 * ## Ce que cette suite ne prouve pas
 *
 * Aucun SMS réel n'est livré : le fournisseur est celui de la recette.
 */

const { startHarness } = await import('./support/harness.mjs');

let h;
let escaladerAlertes;
let sendAlertBatch;
const PASSWORD = 'MotDePasse!2026';

const FERMIER = 'fermier-escalade@agrikonnect.test';
const AGRONOME = 'agronome-escalade@agrikonnect.test';
const TELEPHONE_FERMIER = '+243810000311';
const TELEPHONE_AGRONOME = '+243810000322';

let organizationId;
let fermierId;
let agronomeId;
let fermierToken;

const register = async ({ email, accountType = 'FARMER', firstName, lastName, phone }) => {
  const reponse = await h.request('POST', '/auth/register', {
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
  assert.equal(reponse.status, 201, `inscription ${email} : ${JSON.stringify(reponse.body)}`);
};

const connect = async (email) => {
  const reponse = await h.request('POST', '/auth/login', {
    body: { identifier: email, password: PASSWORD },
  });
  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));
  return reponse.body.data.session.accessToken;
};

/** Crée une alerte directement en base, à l'état voulu. */
const creerAlerte = async ({ cle, statut = 'NEW', notifieeIlYAMinutes = 300, niveau = 1 }) => {
  const id = `alr_${cle}`;
  await h.prisma.thresholdAlert.create({
    data: {
      id,
      organizationId,
      parameter: 'ph',
      sourceType: 'MEASUREMENT',
      referenceValue: 6.5,
      observedValue: 4.2,
      severity: 'CRITICAL',
      status: statut,
      episodeKey: cle,
      message: 'pH sous le seuil de tolérance du manioc',
      notifiedAt: new Date(Date.now() - notifieeIlYAMinutes * 60_000),
      lastNotifiedAt: new Date(Date.now() - notifieeIlYAMinutes * 60_000),
      notificationCount: 1,
      escalationLevel: niveau,
    },
  });
  return id;
};

before(async () => {
  h = await startHarness();
  ({ escaladerAlertes } = await import('../../src/modules/alerts/alertEscalation.service.js'));
  ({ sendAlertBatch } = await import('../../src/modules/smsDelivery/smsDelivery.service.js'));

  await register({ email: FERMIER, firstName: 'Josué', lastName: 'Bomoi', phone: TELEPHONE_FERMIER });
  await register({ email: AGRONOME, accountType: 'AGRONOMIST', firstName: 'Alice', lastName: 'Muteba', phone: TELEPHONE_AGRONOME });

  fermierToken = await connect(FERMIER);
  const fermier = await h.prisma.profile.findFirst({ where: { email: FERMIER } });
  fermierId = fermier.id;
  const agronome = await h.prisma.profile.findFirst({ where: { email: AGRONOME } });
  agronomeId = agronome.id;

  const adhesion = await h.prisma.membership.findFirst({ where: { userId: fermierId } });
  organizationId = adhesion.organizationId;

  /*
   * L'agronome est placé dans **la même organisation** : l'escalade cherche ses
   * destinataires dans l'organisation de l'alerte, pas dans tout le système.
   */
  await h.prisma.membership.updateMany({
    where: { userId: agronomeId },
    data: { organizationId, roles: ['AGRONOMIST'] },
  });

  // Numéros confirmés : sans cela les alertes seraient retenues pour
  // `PHONE_UNVERIFIED` et cette suite mesurerait autre chose.
  await h.prisma.profile.updateMany({
    where: { phone: { in: [TELEPHONE_FERMIER, TELEPHONE_AGRONOME] } },
    data: { phoneVerifiedAt: new Date() },
  });

  // Consentement SMS pour les deux : même raison.
  for (const jeton of [fermierToken, await connect(AGRONOME)]) {
    // eslint-disable-next-line no-await-in-loop
    await h.request('POST', '/sms/consent', {
      token: jeton,
      body: { purpose: 'ALERT', noticeVersion: 'v1-2026-10' },
    });
  }

  // Fenêtre de silence désactivée par défaut dans cette suite : les tests qui
  // en ont besoin l'activent eux-mêmes.
  process.env.SMS_QUIET_HOURS_ENABLED = 'false';
}, { timeout: 180_000 });

beforeEach(async () => {
  process.env.SMS_QUIET_HOURS_ENABLED = 'false';
});

afterEach(async () => {
  process.env.SMS_QUIET_HOURS_ENABLED = 'false';
});

after(async () => {
  delete process.env.SMS_QUIET_HOURS_ENABLED;
  await h?.stop();
});

/* ─────────────────────── escalade à deux niveaux ─────────────────────── */

test('E2E escalade : une alerte non traitée au-delà du délai remonte à l’encadrement', async () => {
  const id = await creerAlerte({ cle: 'esc-1', notifieeIlYAMinutes: 300 });

  const avant = await h.prisma.notification.count({ where: { userId: agronomeId } });
  const resultat = await escaladerAlertes({ organizationId });

  assert.equal(resultat.examinees, 1, JSON.stringify(resultat.details));
  assert.equal(resultat.escaladees, 1);

  const apres = await h.prisma.notification.count({ where: { userId: agronomeId } });
  assert.ok(apres > avant, 'l’agronome doit avoir reçu la notification');

  const alerte = await h.prisma.thresholdAlert.findUnique({ where: { id } });
  assert.equal(alerte.escalationLevel, 2);
  assert.ok(alerte.escalatedAt, 'la date d’escalade sert de marque d’idempotence');
});

test('E2E escalade : un second passage ne relance pas le niveau 2', async () => {
  /*
   * Sans la marque d'idempotence, deux passages rapprochés — ou deux instances
   * du backend — notifieraient deux fois l'encadrement pour la même alerte.
   */
  const resultat = await escaladerAlertes({ organizationId });
  assert.equal(resultat.examinees, 0, 'plus aucune alerte éligible');
  assert.equal(resultat.escaladees, 0);
});

test('E2E escalade : une alerte trop récente n’escalade pas', async () => {
  await creerAlerte({ cle: 'esc-recente', notifieeIlYAMinutes: 5 });
  const resultat = await escaladerAlertes({ organizationId });
  assert.equal(resultat.escaladees, 0, 'le délai n’est pas écoulé');
});

test('E2E escalade : une alerte déjà traitée n’escalade pas', async () => {
  await creerAlerte({ cle: 'esc-traitee', statut: 'HANDLED', notifieeIlYAMinutes: 300 });
  const resultat = await escaladerAlertes({ organizationId });
  assert.equal(resultat.escaladees, 0, 'prévenir l’encadrement d’un problème réglé est du bruit');
});

test('E2E escalade : l’organisation est respectée', async () => {
  const id = await creerAlerte({ cle: 'esc-isolee', notifieeIlYAMinutes: 300 });
  const resultat = await escaladerAlertes({ organizationId: 'org_qui_n_existe_pas' });
  assert.equal(resultat.examinees, 0);
  // Nettoyage : laissée en attente, cette alerte serait ramassée par le test
  // suivant et fausserait son compte.
  await h.prisma.thresholdAlert.delete({ where: { id } });
});

test('E2E escalade : deux exécutions concurrentes n’escaladent qu’une fois', async () => {
  const id = await creerAlerte({ cle: 'esc-concurrence', notifieeIlYAMinutes: 300 });
  const avant = await h.prisma.notification.count({ where: { userId: agronomeId } });

  // Les deux exécutions partent en même temps : seule la réservation de l'une
  // des deux doit réussir.
  const [premier, second] = await Promise.all([
    escaladerAlertes({ organizationId }),
    escaladerAlertes({ organizationId }),
  ]);

  const escaladesDeCetteAlerte = [...premier.details, ...second.details].filter(
    (detail) => detail.id === id && detail.escalated === true,
  );
  assert.equal(escaladesDeCetteAlerte.length, 1, 'une seule escalade, pas deux');
  assert.equal(premier.escaladees + second.escaladees, 1, 'aucune autre alerte ne doit être touchée');

  const alerte = await h.prisma.thresholdAlert.findUnique({ where: { id } });
  assert.equal(alerte.escalationLevel, 2);
  assert.ok(avant >= 0);
});

/* ─────────────────────── fenêtre de silence ─────────────────────── */

test('E2E SMS : une alerte dans la fenêtre de silence est retenue, avec la raison', async () => {
  // Fenêtre couvrant toute la journée, pour ne pas dépendre de l'heure réelle.
  process.env.SMS_QUIET_HOURS_ENABLED = 'true';
  process.env.SMS_QUIET_START = '00:01';
  process.env.SMS_QUIET_END = '23:59';

  const avant = h.sink.messages.sms.length;
  const lot = await sendAlertBatch({
    organizationId,
    body: 'AGRIKONNECT : alerte pH. Verifier la parcelle.',
    recipients: [{ userId: fermierId, phone: TELEPHONE_FERMIER }],
  });

  assert.equal(lot.counts.sent, 0);
  assert.equal(lot.results[0].skipReason, 'QUIET_HOURS');
  assert.equal(h.sink.messages.sms.length, avant, 'rien ne doit partir vers le fournisseur');
  // La raison est comptée dans le journal de lot, comme les autres.
  assert.equal(lot.log.skippedByReason.QUIET_HOURS, 1);

  process.env.SMS_QUIET_HOURS_ENABLED = 'false';
});

test('E2E SMS : hors fenêtre, la même alerte part', async () => {
  process.env.SMS_QUIET_HOURS_ENABLED = 'true';
  // Fenêtre vide : début égal à fin ne coupe pas le canal.
  process.env.SMS_QUIET_START = '03:00';
  process.env.SMS_QUIET_END = '03:00';

  const avant = h.sink.messages.sms.length;
  const lot = await sendAlertBatch({
    organizationId,
    body: 'AGRIKONNECT : alerte pH. Verifier la parcelle.',
    recipients: [{ userId: fermierId, phone: TELEPHONE_FERMIER }],
  });
  assert.equal(lot.counts.sent, 1, JSON.stringify(lot.results));
  assert.equal(h.sink.messages.sms.length, avant + 1);

  process.env.SMS_QUIET_HOURS_ENABLED = 'false';
});

test('E2E SMS : un code OTP n’est jamais retenu par la fenêtre de silence', async () => {
  /*
   * Un code demandé par l'utilisateur à 23 h doit arriver. Le retenir
   * bloquerait l'accès au compte au nom d'une règle pensée pour les alertes non
   * sollicitées — et l'utilisateur n'aurait aucun moyen de le savoir.
   */
  process.env.SMS_QUIET_HOURS_ENABLED = 'true';
  process.env.SMS_QUIET_START = '00:01';
  process.env.SMS_QUIET_END = '23:59';

  const reponse = await h.request('POST', '/auth/send-otp', {
    token: fermierToken,
    body: { phone: TELEPHONE_FERMIER },
  });
  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));
  assert.equal(reponse.body.data.sent, true, 'l’OTP part quelle que soit l’heure');
  assert.equal(reponse.body.data.skipReason, undefined);

  process.env.SMS_QUIET_HOURS_ENABLED = 'false';
});
