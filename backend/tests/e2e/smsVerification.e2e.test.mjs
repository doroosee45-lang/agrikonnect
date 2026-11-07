import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Recette de bout en bout — base réelle — pour la **vérification du numéro**
 * avant tout envoi d'alerte, et pour le passage du **code OTP** par le même
 * chemin gardé que les alertes.
 *
 * ## Ce que cette suite prouve
 *
 *  - une alerte **part** vers un numéro confirmé par son titulaire ;
 *  - une alerte est **retenue** vers un numéro non confirmé, avec la raison
 *    `PHONE_UNVERIFIED` et **sans** qu'aucune requête ne parte vers le
 *    fournisseur ;
 *  - la raison apparaît **comptée dans le journal de lot**, pas seulement
 *    renvoyée à l'appelant ;
 *  - un numéro confirmé **ne sert pas** à envoyer vers un autre numéro ;
 *  - le code de vérification du numéro laisse une ligne dans `sms_messages`,
 *    au plafond et au suivi de remise, comme n'importe quel autre envoi.
 *
 * ## Ce que cette suite ne prouve pas
 *
 * **Aucun SMS réel n'est livré.** Le fournisseur est celui de la recette : il
 * enregistre sans contacter aucun opérateur.
 */

const { startHarness } = await import('./support/harness.mjs');

let h;
/** Importé après `startHarness()` : `env` doit être déjà initialisé. */
let sendAlertBatch;
const PASSWORD = 'MotDePasse!2026';

const FERMIER = 'fermier-verif@agrikonnect.test';
const SON_NUMERO = '+243810000111';
const UN_AUTRE_NUMERO = '+243810000222';
const CORPS = 'AGRIKONNECT : alerte pH. Verifier la parcelle avant semis.';

let organizationId;
let fermierId;
let fermierToken;
let adminToken;

const register = async ({ email, accountType = 'FARMER', firstName = 'Awa', lastName = 'Kabila', phone }) => {
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

const confirmerNumero = async (phone) => {
  await h.prisma.profile.updateMany({
    where: { phone },
    data: { phoneVerifiedAt: new Date() },
  });
};

const envoyerUneAlerte = async (phone) =>
  sendAlertBatch({
    organizationId,
    body: CORPS,
    recipients: [{ userId: fermierId, phone }],
  });

before(async () => {
  h = await startHarness();
  ({ sendAlertBatch } = await import('../../src/modules/smsDelivery/smsDelivery.service.js'));

  await register({ email: FERMIER, firstName: 'Josué', lastName: 'Bomoi', phone: SON_NUMERO });
  fermierToken = await connect(FERMIER);

  const profil = await h.prisma.profile.findFirst({ where: { email: FERMIER } });
  fermierId = profil.id;
  const adhesion = await h.prisma.membership.findFirst({ where: { userId: fermierId } });
  organizationId = adhesion.organizationId;

  /*
   * Le consentement est donné **avant** toute assertion : sans lui l'envoi
   * serait retenu pour `NO_CONSENT` et le test croirait prouver la
   * vérification du numéro alors qu'il mesurerait autre chose.
   */
  const consentement = await h.request('POST', '/sms/consent', {
    token: fermierToken,
    body: { purpose: 'ALERT', noticeVersion: 'v1-2026-10' },
  });
  assert.equal(consentement.status, 201, JSON.stringify(consentement.body));

  // Le journal de lot se lit en administration.
  await register({ email: 'admin-verif@agrikonnect.test', firstName: 'Paul', lastName: 'Ilunga' });
  const admin = await h.prisma.profile.findFirst({ where: { email: 'admin-verif@agrikonnect.test' } });
  /*
   * L'administrateur est placé dans **l'organisation du fermier** : le journal
   * de lot se lit par locataire, un administrateur d'une autre organisation ne
   * verrait rien.
   */
  await h.prisma.membership.updateMany({
    where: { userId: admin.id },
    data: { organizationId, roles: ['SUPER_ADMIN'] },
  });
  adminToken = await connect('admin-verif@agrikonnect.test');
}, { timeout: 180_000 });

after(async () => {
  await h?.stop();
});

/* ─────────────── 1. Numéro non confirmé : rien ne part ─────────────── */

test('E2E SMS : un numéro non vérifié retient l’alerte, avec la bonne raison', async () => {
  const avant = h.sink.messages.sms.length;

  const lot = await envoyerUneAlerte(SON_NUMERO);

  assert.equal(lot.counts.sent, 0, 'aucune alerte ne doit partir');
  assert.equal(lot.counts.skipped, 1);
  assert.equal(lot.results[0].sent, false);
  assert.equal(
    lot.results[0].skipReason,
    'PHONE_UNVERIFIED',
    'la raison doit nommer la vérification, pas le consentement ni le plafond',
  );
  assert.equal(h.sink.messages.sms.length, avant, 'aucune requête ne doit atteindre le fournisseur');
});

test('E2E SMS : la raison PHONE_UNVERIFIED est comptée dans le journal de lot', async () => {
  const journaux = await h.request('GET', '/sms/batches', { token: adminToken });
  assert.equal(journaux.status, 200, JSON.stringify(journaux.body));

  const ligne = journaux.body.data.items.find((l) => l.candidates === 1 && l.sent === 0);
  assert.ok(ligne, 'le lot doit apparaître dans le journal');
  assert.equal(ligne.skippedByReason.PHONE_UNVERIFIED, 1, 'la raison doit être comptée, pas seulement totale');
});

/* ─────────────── 2. Numéro confirmé : l’alerte part ─────────────── */

test('E2E SMS : un numéro vérifié reçoit l’alerte', async () => {
  await confirmerNumero(SON_NUMERO);

  const avant = h.sink.messages.sms.length;
  const lot = await envoyerUneAlerte(SON_NUMERO);

  assert.equal(lot.counts.sent, 1, JSON.stringify(lot.results));
  assert.equal(lot.results[0].sent, true);
  assert.equal(h.sink.messages.sms.length, avant + 1, 'une requête doit partir vers le fournisseur');
  assert.equal(h.sink.messages.sms.at(-1).to, SON_NUMERO);
});

test('E2E SMS : un numéro vérifié ne sert pas à envoyer vers un autre numéro', async () => {
  const avant = h.sink.messages.sms.length;

  const lot = await envoyerUneAlerte(UN_AUTRE_NUMERO);

  assert.equal(lot.results[0].sent, false);
  assert.equal(
    lot.results[0].skipReason,
    'PHONE_UNVERIFIED',
    'sans ce contrôle, un compte au numéro vérifié pourrait viser n’importe quel numéro',
  );
  assert.equal(h.sink.messages.sms.length, avant);
});

/* ─────────────── 3. Le code OTP passe par le même chemin ─────────────── */

test('E2E SMS : le code de vérification laisse une trace dans sms_messages', async () => {
  const avant = await h.prisma.smsMessage.count({ where: { purpose: 'OTP' } });

  const reponse = await h.request('POST', '/auth/send-otp', {
    token: fermierToken,
    body: { phone: SON_NUMERO },
  });
  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));
  assert.equal(reponse.body.data.sent, true);

  const apres = await h.prisma.smsMessage.findMany({
    where: { purpose: 'OTP' },
    orderBy: { createdAt: 'desc' },
  });
  assert.equal(apres.length, avant + 1, 'l’OTP doit être enregistré, pas envoyé en dehors du journal');
  assert.equal(apres[0].phone, SON_NUMERO);
  assert.equal(apres[0].organizationId, organizationId);
  /*
   * Le suivi de remise s'applique aussi à l'OTP : la ligne est passée par
   * l'envoi et porte une date. L'identifiant fournisseur, lui, dépend du
   * fournisseur — celui de la recette n'en donne pas, et l'affirmer ici
   * serait faux.
   */
  assert.ok(apres[0].sentAt, 'la date d’envoi doit être posée');
  assert.notEqual(apres[0].status, 'QUEUED_LOCALLY', 'le statut doit avoir été mis à jour après l’envoi');
});

test('E2E SMS : l’OTP reste soumis au plafond horaire d’origine', async () => {
  // Le plafond horaire ne doit pas avoir bougé avec le changement de chemin :
  // c'est la garantie demandée. On l'épuise, puis on vérifie le refus.
  const avant = await h.prisma.smsMessage.count({ where: { purpose: 'OTP' } });
  const dejaEnvoyes = await h.prisma.otpCode.count({
    where: {
      identifier: SON_NUMERO,
      purpose: 'PHONE_VERIFICATION',
      createdAt: { gte: new Date(Date.now() - 3_600_000) },
    },
  });
  const restants = Math.max(0, 5 - dejaEnvoyes);

  for (let i = 0; i < restants; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await h.request('POST', '/auth/send-otp', { token: fermierToken, body: { phone: SON_NUMERO } });
  }

  const refuse = await h.request('POST', '/auth/send-otp', {
    token: fermierToken,
    body: { phone: SON_NUMERO },
  });
  assert.equal(refuse.status, 429, 'le plafond horaire doit toujours refuser, comme avant');

  const apres = await h.prisma.smsMessage.count({ where: { purpose: 'OTP' } });
  assert.equal(apres, avant + restants, 'seuls les envois réellement partis sont journalisés');
});
