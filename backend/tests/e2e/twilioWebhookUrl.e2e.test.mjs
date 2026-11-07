import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

/**
 * Recette de bout en bout — base réelle — de la **validation de signature du
 * webhook de remise** quand une URL publique est configurée.
 *
 * ## La question que cette suite tranche
 *
 * Twilio signe **l'URL exacte** qu'il appelle, préfixe et nom d'hôte compris.
 * Derrière un tunnel (ngrok, cloudflared) ou un mandataire qui termine le TLS,
 * l'URL que voit l'application n'est pas celle que Twilio a signée : reconstruire
 * depuis `req.headers.host` produit `http://127.0.0.1:4000/…` alors que la
 * signature porte `https://mon-tunnel.ngrok.app/…`. **Toutes** les signatures
 * échouent alors, et aucun accusé de remise n'est jamais enregistré.
 *
 * `TWILIO_WEBHOOK_BASE_URL` existe pour lever cette ambiguïté. Cette suite prouve
 * qu'il est réellement utilisé :
 *
 *  - une signature calculée sur l'URL **publique configurée** est **acceptée**,
 *    alors que la requête arrive sur l'hôte local de la recette ;
 *  - une signature calculée sur l'URL **locale** est **refusée** — c'est la
 *    contre-épreuve : si le code reconstruisait depuis l'hôte de la requête, ce
 *    serait l'inverse.
 *
 * La suite existante `smsTwilio.e2e.test.mjs` couvre le repli (aucune URL
 * configurée, reconstruction depuis les en-têtes). Les deux chemins sont donc
 * couverts, et ils ne se confondent pas.
 */

const { startHarness } = await import('./support/harness.mjs');

const AUTH_TOKEN = 'faux_jeton_auth_twilio_pas_un_secret';
const ACCOUNT_SID = 'ACfauxcomptedetest0001';

/**
 * URL publique **fictive** : ce n'est pas un tunnel réel, et rien ici ne sort de
 * la machine. Elle sert uniquement de matériel de signature.
 */
const URL_PUBLIQUE = 'https://mon-tunnel.public.test';
const CHEMIN = '/webhooks/twilio/status';

let h;

/** Signature calculée exactement comme Twilio la calcule (HMAC-SHA1, base64). */
const signer = (url, params = {}) => {
  const payload = url
    + Object.keys(params)
      .sort()
      .map((cle) => `${cle}${params[cle]}`)
      .join('');
  return createHmac('sha1', AUTH_TOKEN).update(payload, 'utf8').digest('base64');
};

before(async () => {
  /*
   * Posé **avant** `startHarness()` : `config/env.js` est évalué à l'import,
   * donc une variable posée après n'aurait aucun effet. Le harnais ne touche pas
   * à cette clé, elle survit donc au démarrage.
   */
  process.env.SMS_PROVIDER = 'twilio';
  process.env.TWILIO_ACCOUNT_SID = ACCOUNT_SID;
  process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
  process.env.TWILIO_SENDER_ID = 'AGRIKONNECT';
  process.env.TWILIO_WEBHOOK_BASE_URL = URL_PUBLIQUE;
  // Aucun fournisseur réel n'est appelé : la suite ne teste que la signature.
  process.env.TWILIO_API_BASE_URL = 'http://127.0.0.1:1';
  process.env.E2E_SMS_PROVIDER = 'twilio';

  h = await startHarness();
}, { timeout: 180_000 });

after(async () => {
  await h?.stop();
});

test('Webhook Twilio : une signature calculée sur l’URL publique configurée est acceptée', async () => {
  const params = { MessageSid: 'SMurlpublique0001', MessageStatus: 'delivered' };

  /*
   * La signature porte l'URL **publique**, alors que la requête part vers
   * `http://127.0.0.1:<port>` de la recette. Si la validation reconstruisait
   * l'URL depuis l'hôte de la requête, ce test échouerait en 403.
   */
  const reponse = await h.request('POST', CHEMIN, {
    body: params,
    form: true,
    headers: { 'x-twilio-signature': signer(`${URL_PUBLIQUE}/api/v1${CHEMIN}`, params) },
  });

  /*
   * **403 = signature refusée.** Tout autre statut prouve que la vérification a
   * abouti, et le 404 attendu vient du `MessageSid` inconnu — la requête est
   * donc allée jusqu'au traitement métier.
   *
   * Attendre un 200 ici serait faux : le gestionnaire répond 404 pour un
   * identifiant de message absent de la base, ce qui est le comportement
   * correct. Le test 4 vérifie le 200 sur un message qui existe vraiment.
   */
  assert.notEqual(
    reponse.status,
    403,
    `La signature calculée sur ${URL_PUBLIQUE} a été refusée : `
    + 'TWILIO_WEBHOOK_BASE_URL n’est donc pas utilisé pour la vérification. '
    + `Réponse : ${JSON.stringify(reponse.body)}`,
  );
  assert.equal(reponse.status, 404, `statut inattendu : ${JSON.stringify(reponse.body)}`);
  assert.match(
    JSON.stringify(reponse.body),
    /aucun message connu/i,
    'Le 404 doit nommer le message inconnu, pas masquer un refus de signature.',
  );
});

test('Webhook Twilio : une signature calculée sur l’URL locale est refusée', async () => {
  /*
   * Contre-épreuve. Même charge, mais signée sur l'URL de la recette
   * (`http://127.0.0.1:<port>/api/v1/...`). Comme l'URL configurée fait
   * autorité, cette signature ne correspond plus : elle doit être refusée.
   *
   * Sans cette assertion, le test précédent pourrait passer pour une mauvaise
   * raison — par exemple si la vérification était tout simplement désactivée.
   */
  const params = { MessageSid: 'SMurllocale00002', MessageStatus: 'delivered' };
  const reponse = await h.request('POST', CHEMIN, {
    body: params,
    form: true,
    headers: { 'x-twilio-signature': signer(`${h.urls.baseUrl}${CHEMIN}`, params) },
  });

  assert.equal(
    reponse.status,
    403,
    'Une signature calculée sur l’URL locale a été acceptée alors que '
    + `l'URL configurée est ${URL_PUBLIQUE} : la vérification ne fait pas autorité. `
    + `Réponse : ${JSON.stringify(reponse.body)}`,
  );
});

test('Webhook Twilio : une requête sans signature reste refusée', async () => {
  const reponse = await h.request('POST', CHEMIN, {
    body: { MessageSid: 'SMsanssignature3', MessageStatus: 'delivered' },
  });
  assert.equal(reponse.status, 403, JSON.stringify(reponse.body));
});

test('Webhook Twilio : l’accusé de remise d’un message existant est bien enregistré', async () => {
  /*
   * Accepter la signature ne suffit pas : il faut que l'état arrive en base.
   * Sinon la suite prouverait seulement qu'un 200 est renvoyé.
   *
   * Le message est créé directement en base, avec un `providerMessageId` :
   * c'est l'état réel d'un message soumis à Twilio dont on attend l'accusé.
   * Passer par la route d'envoi n'est pas possible ici, aucun fournisseur réel
   * n'étant joignable depuis la recette.
   */
  /*
   * Cette suite n'inscrit aucun utilisateur — elle ne teste que la signature —
   * donc aucune organisation n'existe. On en crée une : `sms_messages` exige une
   * organisation, et le webhook rapproche l'accusé de remise par identifiant de
   * message, pas par locataire.
   */
  const ID_ORG = 'org_recette_webhook_url';
  await h.prisma.smsMessage.deleteMany({ where: { organizationId: ID_ORG } });
  await h.prisma.organization.deleteMany({ where: { id: ID_ORG } });
  const organisation = await h.prisma.organization.create({
    data: { id: ID_ORG, name: 'Recette webhook URL', countryCode: 'CD' },
  });

  const idMessage = 'sms_recu_webhook_url';
  await h.prisma.smsMessage.deleteMany({ where: { id: idMessage } });
  await h.prisma.smsMessage.create({
    data: {
      id: idMessage,
      organizationId: organisation.id,
      phone: '+243810000411',
      body: 'AGRIKONNECT : alerte de test.',
      senderId: 'AGRIKONNECT',
      purpose: 'ALERT',
      provider: 'twilio',
      providerMessageId: 'SMenregistre0004',
      status: 'SENT',
      rawStatus: 'sent',
      segments: 1,
      encoding: 'GSM7',
      characterCount: 29,
      mode: 'SIMULATED',
      version: 1,
      sentAt: new Date(),
      lastStatusAt: new Date(),
      statusHistory: [{ status: 'SENT', rawStatus: 'sent', at: new Date().toISOString(), source: 'provider' }],
    },
  });

  const params = { MessageSid: 'SMenregistre0004', MessageStatus: 'delivered' };
  const reponse = await h.request('POST', CHEMIN, {
    body: params,
    form: true,
    headers: { 'x-twilio-signature': signer(`${URL_PUBLIQUE}/api/v1${CHEMIN}`, params) },
  });
  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));

  const apres = await h.prisma.smsMessage.findUnique({ where: { id: idMessage } });
  assert.equal(apres.status, 'DELIVERED', `statut en base : ${apres.status}`);
  assert.equal(apres.rawStatus, 'delivered');
  assert.ok(apres.statusHistory.length >= 2, 'l’historique doit porter l’accusé de remise');
});
