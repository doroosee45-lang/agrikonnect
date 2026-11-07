import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

/**
 * Recette de bout en bout — base réelle — de la **correspondance des erreurs
 * Twilio**.
 *
 * ## Ce que cette suite prouve
 *
 * Un faux serveur Twilio renvoie un code d'erreur choisi. La suite vérifie que ce
 * code :
 *
 *  - arrive **tel quel** dans `sms_messages.errorCode` ;
 *  - est traduit en français exploitable dans `sms_messages.errorMessage`, avec
 *    la cause probable et l'action à mener ;
 *  - est renvoyé dans la réponse de `POST /sms/test-send`, donc lisible par
 *    l'appelant sans consulter la base ;
 *  - n'entraîne **aucune nouvelle tentative** quand il est définitif.
 *
 * Ce dernier point est le plus important économiquement : rejouer trois fois un
 * 20003 (identifiants refusés) ou un 21614 (ligne fixe) donne le même résultat,
 * en ajoutant du délai avant que l'exploitant voie le vrai motif.
 *
 * ## Ce que cette suite ne prouve pas
 *
 * **Aucun SMS réel n'est envoyé.** Le fournisseur est un faux serveur HTTP
 * local. Que Twilio renvoie bien ces codes dans ces circonstances est documenté
 * par Twilio, pas vérifié ici — voir `docs/SMS-OTP-TEST-REEL.md`.
 */

const AUTH_TOKEN = 'faux_jeton_auth_twilio_pas_un_secret';
const ACCOUNT_SID = 'ACfauxcomptedetest0001';

let fake;
let h;
let adminToken;
let appels = 0;
/** Champ `From` de chaque appel, dans l'ordre : sert à prouver le repli. */
let expediteurs = [];

/** Comportement courant du faux fournisseur. */
let comportement = { status: 400, body: { code: 21211, message: 'Invalid To', status: 400 } };

const startFakeTwilio = () =>
  new Promise((resolve) => {
    fake = createServer((req, res) => {
      let brut = '';
      req.on('data', (c) => {
        brut += c;
      });
      req.on('end', () => {
        appels += 1;
        expediteurs.push(Object.fromEntries(new URLSearchParams(brut)).From ?? null);
        res.setHeader('content-type', 'application/json');
        res.statusCode = comportement.status;
        res.end(JSON.stringify(comportement.body));
      });
    });
    fake.listen(0, '127.0.0.1', () => resolve());
  });

const { startHarness } = await import('./support/harness.mjs');

const PASSWORD = 'MotDePasse!2026';
const NUMERO = '+243810000901';

before(async () => {
  await startFakeTwilio();
  const { port } = fake.address();

  /*
   * Posé **avant** `startHarness()` : `config/env.js` est évalué à l'import.
   * Le SID et l'identifiant sont conformes, sinon la validation de configuration
   * au démarrage refuserait de lancer la recette — ce qui est d'ailleurs la
   * preuve que cette validation fonctionne.
   */
  process.env.SMS_PROVIDER = 'twilio';
  process.env.TWILIO_ACCOUNT_SID = ACCOUNT_SID;
  process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
  process.env.TWILIO_SENDER_ID = 'AGRIKONNECT';
  process.env.TWILIO_API_BASE_URL = `http://127.0.0.1:${port}`;
  process.env.E2E_SMS_PROVIDER = 'twilio';

  /*
   * Plafond quotidien relevé.
   *
   * `countSentToday` compte **tous** les messages du jour, y compris les échecs —
   * un envoi soumis au fournisseur peut être facturé même refusé. Avec le défaut
   * de 5, cette suite atteindrait le plafond `DAILY_LIMIT` dès le sixième test et
   * mesurerait le garde-fou au lieu de la traduction des erreurs. Le plafond
   * lui-même est couvert ailleurs (`smsTwilio.e2e.test.mjs`).
   */
  process.env.SMS_DAILY_LIMIT_PER_FARMER = '500';
  process.env.SMS_DAILY_LIMIT_PER_ORGANIZATION = '0';

  h = await startHarness();

  // Un administrateur : `/sms/test-send` exige la permission `sms.send`.
  const email = 'admin-erreurs@agrikonnect.test';
  await h.request('POST', '/auth/register', {
    body: {
      accountType: 'FARMER',
      firstName: 'Admin',
      lastName: 'Erreurs',
      email,
      password: PASSWORD,
      countryCode: 'CD',
      locale: 'fr',
      phone: NUMERO,
    },
  });
  const connexion = await h.request('POST', '/auth/login', {
    body: { identifier: email, password: PASSWORD },
  });
  adminToken = connexion.body.data.session.accessToken;
  await h.prisma.membership.updateMany({
    where: { userId: connexion.body.data.user.id },
    data: { roles: ['FARMER', 'ADMIN', 'SUPER_ADMIN'] },
  });
  const apres = await h.request('POST', '/auth/login', {
    body: { identifier: email, password: PASSWORD },
  });
  adminToken = apres.body.data.session.accessToken;

  /*
   * Consentement accordé pour l'usage « ALERT ».
   *
   * Sans lui, le garde-fou `NO_CONSENT` retient l'envoi **avant** tout appel au
   * fournisseur : la suite mesurerait alors les garde-fous, pas la traduction des
   * erreurs Twilio, qui est son objet. `/sms/test-send` lève la garde du numéro
   * vérifié, pas celle du consentement — et c'est voulu.
   */
  const consentement = await h.request('POST', '/sms/consent', {
    token: adminToken,
    body: { purpose: 'ALERT' },
  });
  assert.equal(consentement.status, 201, JSON.stringify(consentement.body));

  const preferences = await h.request('PUT', '/notifications/preferences', {
    token: adminToken,
    body: { preferences: [{ type: 'ALERT', channel: 'SMS', enabled: true }] },
  });
  assert.equal(preferences.status, 200, JSON.stringify(preferences.body));
}, { timeout: 180_000 });

after(async () => {
  await h?.stop();
  await new Promise((resolve) => fake?.close(resolve));
});

/** Envoie via la sonde d'administration et renvoie la réponse. */
const sonder = (numero = NUMERO) =>
  h.request('POST', '/sms/test-send', {
    token: adminToken,
    body: { phone: numero, body: 'AGRIKONNECT : test de canal.', purpose: 'ALERT' },
  });

/** Dernier message enregistré en base. */
const dernierMessage = () =>
  h.prisma.smsMessage.findFirst({ orderBy: { createdAt: 'desc' } });

test('E2E erreurs Twilio : 21211 (numéro invalide) atteint la base et la réponse', async () => {
  comportement = { status: 400, body: { code: 21211, message: "The 'To' number is not a valid phone number", status: 400 } };

  const reponse = await sonder('+243810000902');
  assert.equal(reponse.status, 422, JSON.stringify(reponse.body));
  assert.equal(reponse.body.data.sent, false);
  // La réponse de l'API porte l'explication, pas seulement un code.
  const texte = reponse.body.data.error ?? '';
  assert.match(texte, /\[21211\]/, `réponse : ${texte}`);
  assert.match(texte, /E.164/, 'l’action doit nommer le format attendu');

  const message = await dernierMessage();
  assert.equal(message.errorCode, '21211', 'le code Twilio doit être conservé tel quel');
  assert.match(message.errorMessage, /\[21211\]/);
  assert.match(message.errorMessage, /Cause : /);
  assert.match(message.errorMessage, /Action : /);
  assert.equal(message.status, 'FAILED');
});

test('E2E erreurs Twilio : 21614 (ligne fixe) est traduit et non rejoué', async () => {
  comportement = { status: 400, body: { code: 21614, message: "To number is not a valid mobile number", status: 400 } };

  const avant = appels;
  const reponse = await sonder('+243810000903');
  assert.equal(reponse.status, 422, JSON.stringify(reponse.body));

  /*
   * Un 21614 est définitif : le numéro est une ligne fixe. Une seule tentative
   * doit avoir été faite — pas trois.
   */
  assert.equal(appels - avant, 1, `appels au fournisseur : ${appels - avant} (1 attendu)`);

  const message = await dernierMessage();
  assert.equal(message.errorCode, '21614');
  assert.match(message.errorMessage, /ligne fixe/i);
  assert.match(message.errorMessage, /Ne pas réessayer|ne pas réessayer/i);
});

test('E2E erreurs Twilio : 20003 (authentification) nomme les variables à vérifier', async () => {
  comportement = { status: 401, body: { code: 20003, message: 'Authenticate', status: 401 } };

  const avant = appels;
  const reponse = await sonder('+243810000904');
  assert.equal(reponse.status, 422, JSON.stringify(reponse.body));
  assert.equal(appels - avant, 1, 'un échec d’authentification ne se rejoue pas');

  const message = await dernierMessage();
  assert.equal(message.errorCode, '20003');
  assert.match(message.errorMessage, /TWILIO_ACCOUNT_SID/);
  assert.match(message.errorMessage, /TWILIO_AUTH_TOKEN/);
  assert.match(message.errorMessage, /sms:verifier-config/);
});

test('E2E erreurs Twilio : 63016 (pays non autorisé) indique le réglage à changer', async () => {
  comportement = { status: 400, body: { code: 63016, message: 'Destination not permitted', status: 400 } };

  const reponse = await sonder('+243810000905');
  assert.equal(reponse.status, 422, JSON.stringify(reponse.body));

  const message = await dernierMessage();
  assert.equal(message.errorCode, '63016');
  assert.match(message.errorMessage, /République démocratique du Congo/);
  assert.match(message.errorMessage, /Geographic Permissions/);
});

test('E2E erreurs Twilio : 30005 (opérateur) est le seul cas rejoué', async () => {
  /*
   * Contre-épreuve des trois tests précédents : si aucun code n'était rejoué, on
   * ne pourrait pas dire que les autres sont retenus **parce qu'ils sont
   * définitifs**. Ici, une défaillance d'opérateur doit être retentée.
   */
  comportement = { status: 502, body: { code: 30005, message: 'Carrier failure', status: 502 } };

  const avant = appels;
  await sonder('+243810000906');
  const tentatives = appels - avant;
  assert.ok(
    tentatives > 1,
    `un 30005 est transitoire : ${tentatives} tentative(s), plusieurs attendues`,
  );

  const message = await dernierMessage();
  assert.equal(message.errorCode, '30005');
});

test('E2E repli expéditeur : sans TWILIO_FALLBACK_FROM, un refus de l’alphanumérique reste un refus', async () => {
  /*
   * Point central de la règle : **aucune bascule silencieuse**. L'agriculteur
   * reconnaît l'expéditeur de ses alertes, et en RDC les identifiants numériques
   * ne sont pas remis par Airtel — un repli non demandé ferait arriver le message
   * chez certains opérateurs et pas chez d'autres, sans aucun signe visible.
   *
   * `TWILIO_FALLBACK_FROM` n'est pas renseigné dans cette suite.
   */
  comportement = { status: 400, body: { code: 30040, message: 'Alphanumeric Sender ID not supported', status: 400 } };
  expediteurs = [];
  const avant = appels;

  const reponse = await sonder('+243810000909');
  assert.equal(reponse.status, 422, JSON.stringify(reponse.body));

  assert.equal(appels - avant, 1, 'un seul envoi : aucune seconde tentative depuis un autre expéditeur');
  assert.deepEqual(expediteurs, ['AGRIKONNECT'], 'l’envoi doit partir de l’alphanumérique, et de lui seul');

  const message = await dernierMessage();
  assert.equal(message.status, 'FAILED');
  assert.equal(message.senderId, 'AGRIKONNECT');
});

test('E2E repli expéditeur : un code de destinataire ne déclenche pas le repli', async () => {
  /*
   * Contre-épreuve du test précédent. Un 21211 (numéro invalide) ne sera pas
   * réparé par un autre expéditeur : si le repli se déclenchait sur n'importe
   * quel échec, il coûterait un envoi pour rien et changerait l'expéditeur sans
   * raison. Seuls 30018 et 30040 — qui portent sur l'expéditeur — le justifient.
   */
  comportement = { status: 400, body: { code: 21211, message: 'Invalid To', status: 400 } };
  expediteurs = [];
  const avant = appels;

  await sonder('+243810000910');

  assert.equal(appels - avant, 1, 'un 21211 ne doit pas déclencher de repli');
  assert.deepEqual(expediteurs, ['AGRIKONNECT']);
});

test('E2E erreurs Twilio : un code inconnu est conservé et décrit, pas avalé', async () => {
  comportement = { status: 400, body: { code: 99887, message: 'Something unusual', status: 400 } };

  const reponse = await sonder('+243810000907');
  assert.equal(reponse.status, 422, JSON.stringify(reponse.body));

  const message = await dernierMessage();
  assert.equal(message.errorCode, '99887', 'un code non prévu doit quand même être stocké');
  assert.match(message.errorMessage, /Something unusual/, 'le motif du fournisseur est conservé');
});

test('E2E erreurs Twilio : aucun message d’erreur ne contient de Markdown', async () => {
  /*
   * Ces textes finissent dans une colonne de base et dans une réponse JSON.
   * Contrôle sur l'ensemble des codes réellement produits par cette suite.
   */
  const messages = await h.prisma.smsMessage.findMany({
    where: { errorMessage: { not: null } },
    select: { errorMessage: true },
  });
  assert.ok(messages.length >= 5, `seulement ${messages.length} messages d’erreur en base`);
  for (const { errorMessage } of messages) {
    assert.equal(errorMessage.includes('*'), false, `Markdown dans : ${errorMessage.slice(0, 80)}`);
    assert.equal(errorMessage.includes('\n'), false, `saut de ligne dans : ${errorMessage.slice(0, 80)}`);
  }
});

test('E2E erreurs Twilio : le jeton d’authentification n’apparaît ni en base ni dans la réponse', async () => {
  const messages = await h.prisma.smsMessage.findMany({ select: { errorMessage: true, body: true } });
  const toutBase = JSON.stringify(messages);
  assert.equal(toutBase.includes(AUTH_TOKEN), false, 'le jeton Twilio est stocké en base');

  const reponse = await sonder('+243810000908');
  assert.equal(
    JSON.stringify(reponse.body).includes(AUTH_TOKEN),
    false,
    'le jeton Twilio est renvoyé par l’API',
  );
});
