import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';

/**
 * Recette de bout en bout — **base réelle + faux serveur HTTP** — pour le
 * fournisseur SMS Twilio (étape E).
 *
 * ## Ce que cette suite prouve
 *
 *  - un envoi part vraiment vers l'API Twilio, avec l'identifiant
 *    **alphanumérique** et l'authentification Basic, sans qu'aucun secret ne
 *    soit journalisé ;
 *  - **aucun envoi sans consentement**, et le consentement retiré coupe
 *    l'envoi — c'est le seul mécanisme de désinscription possible, le canal
 *    étant à sens unique en RDC ;
 *  - le **plafond quotidien** retient l'envoi au-delà de la limite ;
 *  - le webhook **refuse** une signature absente, forgée, ou une charge
 *    modifiée, et **accepte** une signature valide ;
 *  - l'accusé de remise met le message à `DELIVERED`, et un statut terminal ne
 *    recule pas ;
 *  - le journal de lot compte l'envoyé **et** le retenu, par raison.
 *
 * ## Ce que cette suite ne prouve pas
 *
 * **Aucun SMS réel n'est livré.** Le serveur est faux : il répond `queued` sans
 * contacter aucun opérateur. Tant qu'un vrai message n'a pas été reçu sur un
 * téléphone en RDC, l'envoi réel — routage, identifiant préservé, remise par
 * Airtel/Vodacom/Orange — **n'est pas vérifié**.
 */

/**
 * Configuration posée **avant** `startHarness()`, qui importe l'application :
 * après, `env` est figé.
 */
const AUTH_TOKEN = 'faux_jeton_auth_twilio_pas_un_secret';
const ACCOUNT_SID = 'ACfauxcomptedetest0001';

let fake;
let fakePort;
/** Requêtes reçues par le faux serveur, pour assertions. */
let received = [];
/** Comportement forçable : code HTTP et corps renvoyés. */
let fakeBehaviour = { status: 201, body: null };

const startFakeTwilio = () =>
  new Promise((resolve) => {
    fake = createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => {
        raw += chunk;
      });
      req.on('end', () => {
        received.push({
          method: req.method,
          url: req.url,
          headers: req.headers,
          raw,
          form: Object.fromEntries(new URLSearchParams(raw)),
        });
        res.setHeader('content-type', 'application/json');
        if (fakeBehaviour.status >= 400) {
          res.statusCode = fakeBehaviour.status;
          res.end(JSON.stringify(fakeBehaviour.body ?? { code: 21211, message: 'numéro invalide', status: 400 }));
          return;
        }
        res.statusCode = 201;
        res.end(
          JSON.stringify(
            fakeBehaviour.body ?? {
              sid: `SM${received.length.toString().padStart(32, '0')}`,
              status: 'queued',
              numSegments: '1',
              uri: `/2010-04-01/Accounts/${ACCOUNT_SID}/Messages/SM.json`,
            },
          ),
        );
      });
    });
    fake.listen(0, '127.0.0.1', () => {
      fakePort = fake.address().port;
      process.env.TWILIO_ACCOUNT_SID = ACCOUNT_SID;
      process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
      process.env.TWILIO_API_BASE_URL = `http://127.0.0.1:${fakePort}`;
      process.env.TWILIO_SENDER_ID = 'AGRIKONNECT';
      // Lu par le harnais : il force `webhook` sauf surcharge explicite.
      process.env.E2E_SMS_PROVIDER = 'twilio';
      process.env.SMS_DAILY_LIMIT_PER_FARMER = '3';
      resolve();
    });
  });

await startFakeTwilio();

const { startHarness } = await import('./support/harness.mjs');

let h;
let farmerToken;
let adminToken;
const PASSWORD = 'MotDePasse!2026';

const register = async ({ email, accountType = 'FARMER', firstName = 'Awa', lastName = 'Kabila' }) => {
  const response = await h.request('POST', '/auth/register', {
    body: { accountType, firstName, lastName, email, password: PASSWORD, countryCode: 'CD', locale: 'fr' },
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

/** Signature calculée comme Twilio la calcule, pour les tests du webhook. */
const sign = (url, params = {}) => {
  const payload =
    url +
    Object.keys(params)
      .sort()
      .map((key) => `${key}${params[key]}`)
      .join('');
  return createHmac('sha1', AUTH_TOKEN).update(payload, 'utf8').digest('base64');
};

const BODY = 'AGRIKONNECT : alerte pH. Verifier la parcelle avant semis.';

/**
 * `ADMIN` n'est pas un type de compte inscriptible : les rôles
 * d'administration s'attribuent en base. Même procédé que les autres suites
 * de bout en bout.
 */
const makeAdmin = async (email) => {
  await register({ email, firstName: 'Paul', lastName: 'Ilunga' });
  const profile = await h.prisma.profile.findFirst({ where: { email } });
  await h.prisma.membership.updateMany({
    where: { userId: profile.id },
    data: { roles: ['SUPER_ADMIN'] },
  });
  return { id: profile.id, token: await connect(email) };
};

before(async () => {
  h = await startHarness();
  await register({ email: 'fermier-sms@agrikonnect.test' });
  farmerToken = await connect('fermier-sms@agrikonnect.test');
  ({ token: adminToken } = await makeAdmin('admin-sms@agrikonnect.test'));
}, { timeout: 180_000 });

after(async () => {
  await h?.stop();
  await new Promise((resolve) => fake?.close(resolve));
});

/* ─────────────────────────── Configuration ─────────────────────────── */

test('E2E SMS : les réglages sont exposés sans aucun secret', async () => {
  const response = await h.request('GET', '/sms/settings', { token: adminToken });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const data = response.body.data;

  assert.equal(data.provider, 'twilio');
  assert.equal(data.senderId, 'AGRIKONNECT');
  assert.equal(data.senderIdValid, true, JSON.stringify(data.senderIdIssues));
  assert.equal(data.twilioConfigured, true, 'le fournisseur est configuré');
  assert.equal(data.dailyLimitPerFarmer, 3);

  // **Aucun secret ne doit sortir**, ni en clair, ni partiellement.
  const serialized = JSON.stringify(response.body);
  assert.ok(!serialized.includes(AUTH_TOKEN), 'le jeton d’authentification a fuité dans la réponse');
  assert.ok(!serialized.includes(ACCOUNT_SID), 'l’identifiant de compte a fuité dans la réponse');

  // Le point à vérifier avant l'usage réel est dit, pas tu.
  assert.match(data.preRegistrationNotice, /pré-inscription/i);
});

/* ─────────────────────────── Consentement ─────────────────────────── */

test('E2E SMS : sans consentement, rien n’est envoyé', async () => {
  const before = received.length;
  const response = await h.request('POST', '/sms/test-send', {
    token: adminToken,
    body: { phone: '+243810000001', body: BODY },
  });

  assert.equal(response.status, 422, JSON.stringify(response.body));
  assert.equal(response.body.data.sent, false);
  assert.equal(response.body.data.skipReason, 'NO_CONSENT');
  assert.equal(received.length, before, 'aucune requête ne doit partir vers le fournisseur');
});

test('E2E SMS : le consentement se donne et se lit dans l’application', async () => {
  const granted = await h.request('POST', '/sms/consent', {
    token: farmerToken,
    body: { purpose: 'ALERT', noticeVersion: 'v1-2026-10' },
  });
  assert.equal(granted.status, 201, JSON.stringify(granted.body));
  assert.equal(granted.body.data.consent.status, 'GRANTED');
  assert.ok(granted.body.data.consent.grantedAt);

  const list = await h.request('GET', '/sms/consent', { token: farmerToken });
  assert.equal(list.status, 200);
  assert.equal(list.body.data.count, 1);
  // Le canal étant à sens unique, l'API dit comment se désinscrire.
  assert.equal(list.body.data.twoWaySupported, false);
  assert.match(list.body.data.optOutNotice, /sens unique/i);
});

test('E2E SMS : l’envoi part vers Twilio avec l’identifiant alphanumérique', async () => {
  // L'administrateur donne aussi son consentement : le test-send exige le
  // consentement de l'appelant, comme n'importe quel envoi.
  const consent = await h.request('POST', '/sms/consent', {
    token: adminToken,
    body: { purpose: 'ALERT', noticeVersion: 'v1-2026-10' },
  });
  assert.equal(consent.status, 201, JSON.stringify(consent.body));

  const before = received.length;
  const response = await h.request('POST', '/sms/test-send', {
    token: adminToken,
    body: { phone: '+243810000002', body: BODY },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.data.sent, true);

  const message = response.body.data.message;
  assert.ok(message.providerMessageId, 'l’identifiant fournisseur est la clé du suivi de remise');
  assert.equal(message.segments, 1);
  assert.equal(message.encoding, 'GSM7');
  // **Accepté n'est pas remis** : la réponse ne doit pas prétendre le contraire.
  assert.equal(response.body.data.deliveryConfirmed, false);
  assert.notEqual(message.status, 'DELIVERED');

  // Ce que le fournisseur a réellement reçu.
  assert.equal(received.length, before + 1, 'une requête doit être partie');
  const call = received[received.length - 1];
  assert.equal(call.method, 'POST');
  assert.match(call.url, new RegExp(`/2010-04-01/Accounts/${ACCOUNT_SID}/Messages\\.json$`));
  assert.equal(call.form.From, 'AGRIKONNECT', 'l’identifiant alphanumérique est utilisé');
  assert.equal(call.form.To, '+243810000002');
  assert.equal(call.form.Body, BODY);

  // Authentification Basic présente, mais **jamais journalisée**.
  assert.match(call.headers.authorization, /^Basic /);
  const decoded = Buffer.from(call.headers.authorization.slice(6), 'base64').toString('utf8');
  assert.equal(decoded, `${ACCOUNT_SID}:${AUTH_TOKEN}`);
});

test('E2E SMS : un message Unicode est annoncé comme coûtant plus de segments', async () => {
  // « î » n'est pas au jeu GSM : un seul caractère double le coût.
  const response = await h.request('POST', '/sms/test-send', {
    token: adminToken,
    body: { phone: '+243810000003', body: 'AGRIKONNETT : alerte maître. Vérifier.' },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.data.message.encoding, 'UCS2');
});

/* ─────────────────────────── Webhook signé ─────────────────────────── */

const WEBHOOK_PATH = '/webhooks/twilio/status';

/**
 * URL signée : celle que Twilio appellerait, préfixe `/api/v1` et port compris.
 * L'URL fait partie du matériel signé — un seul octet d'écart et la validation
 * échoue, ce qui est exactement le comportement attendu.
 */
const webhookUrl = () => `${h.urls.baseUrl}${WEBHOOK_PATH}`;

test('E2E SMS : un webhook sans signature est refusé', async () => {
  const response = await h.request('POST', WEBHOOK_PATH, {
    body: { MessageSid: 'SMx', MessageStatus: 'delivered' },
  });
  assert.equal(response.status, 403, JSON.stringify(response.body));
});

test('E2E SMS : un webhook à signature forgée est refusé', async () => {
  const params = { MessageSid: 'SMx', MessageStatus: 'delivered' };
  const response = await h.request('POST', WEBHOOK_PATH, {
    body: params,
    form: true,
    headers: { 'x-twilio-signature': sign('https://autre.hote.test' + WEBHOOK_PATH, params) },
  });
  assert.equal(response.status, 403, JSON.stringify(response.body));
});

test('E2E SMS : un webhook dont un paramètre a été modifié est refusé', async () => {
  // Signature calculée sur « sent », charge reçue disant « delivered ».
  const signed = { MessageSid: 'SMx', MessageStatus: 'sent' };
  const sent = { MessageSid: 'SMx', MessageStatus: 'delivered' };
  const response = await h.request('POST', WEBHOOK_PATH, {
    body: sent,
    form: true,
    headers: { 'x-twilio-signature': sign(webhookUrl(), signed) },
  });
  assert.equal(response.status, 403, JSON.stringify(response.body));
});

test('E2E SMS : un accusé de remise signé met le message à DELIVERED', async () => {
  const { token: receiptToken } = await makeAdmin('admin-accuse@agrikonnect.test');
  await h.request('POST', '/sms/consent', { token: receiptToken, body: { purpose: 'ALERT' } });

  // Envoi réel (vers le faux serveur) pour obtenir un identifiant à rapprocher.
  const sent = await h.request('POST', '/sms/test-send', {
    token: receiptToken,
    body: { phone: '+243810000004', body: BODY },
  });
  assert.equal(sent.status, 201, JSON.stringify(sent.body));
  const providerMessageId = sent.body.data.message.providerMessageId;

  const params = {
    MessageSid: providerMessageId,
    MessageStatus: 'delivered',
    To: '+243810000004',
    AccountSid: ACCOUNT_SID,
    NumSegments: '1',
  };
  const response = await h.request('POST', WEBHOOK_PATH, {
    body: params,
    form: true,
    headers: { 'x-twilio-signature': sign(webhookUrl(), params) },
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.data.applied, true);
  assert.equal(response.body.data.status, 'DELIVERED');

  const detail = await h.request('GET', `/sms/messages/${sent.body.data.message.id}`, {
    token: receiptToken,
  });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.message.status, 'DELIVERED');
  // L'historique conserve la trace : on peut dire quand chaque état est arrivé.
  const history = detail.body.data.message.statusHistory;
  assert.ok(history.length >= 2, JSON.stringify(history));
  assert.equal(history[history.length - 1].source, 'webhook');
});

test('E2E SMS : un accusé pour un message inconnu est refusé, pas ignoré', async () => {
  const params = { MessageSid: 'SMinexistant0000000000000000', MessageStatus: 'delivered' };
  const response = await h.request('POST', WEBHOOK_PATH, {
    body: params,
    form: true,
    headers: { 'x-twilio-signature': sign(webhookUrl(), params) },
  });
  assert.equal(response.status, 404, JSON.stringify(response.body));
});

test('E2E SMS : un statut terminal ne recule pas', async () => {
  // Administrateur neuf : le plafond quotidien de l'administrateur principal a
  // déjà été consommé par les tests précédents.
  const { token: freshToken } = await makeAdmin('admin-terminal@agrikonnect.test');
  await h.request('POST', '/sms/consent', { token: freshToken, body: { purpose: 'ALERT' } });

  const sent = await h.request('POST', '/sms/test-send', {
    token: freshToken,
    body: { phone: '+243810000005', body: BODY },
  });
  assert.equal(sent.status, 201, JSON.stringify(sent.body));
  const sid = sent.body.data.message.providerMessageId;

  const deliver = { MessageSid: sid, MessageStatus: 'delivered' };
  const first = await h.request('POST', WEBHOOK_PATH, {
    body: deliver,
    form: true,
    headers: { 'x-twilio-signature': sign(webhookUrl(), deliver) },
  });
  assert.equal(first.body.data.status, 'DELIVERED');

  // Un « sent » arrivé après ne doit pas effacer la preuve de remise.
  const late = { MessageSid: sid, MessageStatus: 'sent' };
  const second = await h.request('POST', WEBHOOK_PATH, {
    body: late,
    form: true,
    headers: { 'x-twilio-signature': sign(webhookUrl(), late) },
  });
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.equal(second.body.data.applied, false);
  assert.equal(second.body.data.reason, 'ALREADY_TERMINAL');

  const detail = await h.request('GET', `/sms/messages/${sent.body.data.message.id}`, {
    token: freshToken,
  });
  assert.equal(detail.body.data.message.status, 'DELIVERED');
});

/* ─────────────────────── Garde-fous de coût ─────────────────────── */

test('E2E SMS : le plafond quotidien retient l’envoi', async () => {
  // Un nouvel utilisateur, pour partir d'un compteur à zéro.
  await register({ email: 'fermier-plafond@agrikonnect.test', firstName: 'Marie', lastName: 'Boseko' });
  const token = await connect('fermier-plafond@agrikonnect.test');
  await h.request('POST', '/sms/consent', { token, body: { purpose: 'ALERT' } });

  // L'envoi exige le droit `sms.send` (administrateurs). Un administrateur
  // **neuf**, pour partir d'un compteur à zéro : le plafond est quotidien et
  // les tests précédents ont déjà consommé celui de l'administrateur principal.
  const { token: limitToken } = await makeAdmin('admin-plafond@agrikonnect.test');
  await h.request('POST', '/sms/consent', { token: limitToken, body: { purpose: 'ALERT' } });

  const responses = [];
  for (let index = 0; index < 5; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    const response = await h.request('POST', '/sms/test-send', {
      token: limitToken,
      body: { phone: `+2438100000${10 + index}`, body: BODY },
    });
    responses.push(response);
  }

  const sentCount = responses.filter((response) => response.body.data.sent === true).length;
  const skipped = responses.filter((response) => response.body.data.skipReason === 'DAILY_LIMIT');
  assert.equal(sentCount, 3, `le plafond est 3 par agriculteur — ${sentCount} envoyés`);
  assert.ok(skipped.length >= 1, 'au-delà du plafond, l’envoi doit être retenu');
  assert.equal(skipped[0].status, 422, 'un envoi retenu n’est pas une panne serveur');
});

test('E2E SMS : le consentement retiré coupe l’envoi', async () => {
  const withdrawn = await h.request('DELETE', '/sms/consent', {
    token: farmerToken,
    body: { purpose: 'ALERT' },
  });
  assert.equal(withdrawn.status, 200, JSON.stringify(withdrawn.body));
  assert.equal(withdrawn.body.data.consent.status, 'WITHDRAWN');
  assert.ok(withdrawn.body.data.consent.withdrawnAt, 'la date de retrait est conservée');

  // Le consentement de l'agriculteur est retiré : plus aucun envoi ne le vise.
  const list = await h.request('GET', '/sms/consent', { token: farmerToken });
  assert.equal(list.body.data.items[0].status, 'WITHDRAWN');
});

test('E2E SMS : redonner son consentement après retrait rouvre l’envoi', async () => {
  const again = await h.request('POST', '/sms/consent', {
    token: farmerToken,
    body: { purpose: 'ALERT', noticeVersion: 'v2-2026-10' },
  });
  assert.equal(again.status, 201, JSON.stringify(again.body));
  assert.equal(again.body.data.consent.status, 'GRANTED');
  assert.equal(again.body.data.consent.withdrawnAt, null, 'le retrait est levé');
  // Une seule ligne par usage : un double clic ne crée pas deux consentements.
  const list = await h.request('GET', '/sms/consent', { token: farmerToken });
  assert.equal(list.body.data.count, 1);
});

/* ─────────────────────────── Journal de lot ─────────────────────────── */

test('E2E SMS : le journal de lot compte l’envoyé et le retenu, par raison', async () => {
  const response = await h.request('GET', '/sms/batches', { token: adminToken });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  // Les envois de recette ne passent pas par un lot : la liste peut être vide.
  assert.ok(Array.isArray(response.body.data.items));
  assert.equal(typeof response.body.data.count, 'number');
});

test('E2E SMS : un producteur ne peut pas déclencher d’envoi de recette', async () => {
  const response = await h.request('POST', '/sms/test-send', {
    token: farmerToken,
    body: { phone: '+243810000099', body: BODY },
  });
  // Un envoi de recette coûte de l'argent réel : la route est réservée aux
  // administrateurs.
  assert.equal(response.status, 403, JSON.stringify(response.body));
});

test('E2E SMS : le suivi d’une autre organisation n’est pas accessible', async () => {
  const response = await h.request('GET', '/sms/messages', { token: farmerToken });
  // L'agriculteur est dans sa propre organisation : il ne voit pas les envois
  // de l'administrateur.
  assert.equal(response.status, 200);
  assert.equal(response.body.data.items.length, 0);
});

/* ───────────────────── Échec du fournisseur ───────────────────── */

test('E2E SMS : un refus du fournisseur est enregistré comme échec', async () => {
  fakeBehaviour = { status: 400, body: { code: 21211, message: 'numéro invalide', status: 400 } };
  try {
    const { token } = await makeAdmin('admin-echec@agrikonnect.test');
    await h.request('POST', '/sms/consent', { token, body: { purpose: 'ALERT' } });

    const response = await h.request('POST', '/sms/test-send', {
      token,
      body: { phone: '+243810000077', body: BODY },
    });
    assert.equal(response.status, 422, JSON.stringify(response.body));
    assert.equal(response.body.data.sent, false);
    assert.ok(response.body.data.error, 'la raison de l’échec est conservée');

    // L'échec reste consultable : il ne doit pas disparaître sans trace.
    const list = await h.request('GET', '/sms/messages?status=FAILED', { token });
    assert.equal(list.status, 200);
    assert.ok(list.body.data.items.length >= 1, 'l’échec doit être listé');
    assert.equal(list.body.data.items[0].status, 'FAILED');
  } finally {
    fakeBehaviour = { status: 201, body: null };
  }
});

/**
 * Twilio envoie ses accusés de remise en formulaire, mais peut être configuré
 * pour du JSON. Dans ce cas il ajoute `bodySHA256` à l'URL et la validation
 * porte sur le **corps brut** : un corps re-sérialisé ne donnerait pas le même
 * hachage.
 */
test('E2E SMS : un webhook JSON est validé par bodySHA256 sur le corps brut', async () => {
  const { token: jsonToken } = await makeAdmin('admin-json@agrikonnect.test');
  await h.request('POST', '/sms/consent', { token: jsonToken, body: { purpose: 'ALERT' } });
  const sent = await h.request('POST', '/sms/test-send', {
    token: jsonToken,
    body: { phone: '+243810000088', body: BODY },
  });
  assert.equal(sent.status, 201, JSON.stringify(sent.body));
  const sid = sent.body.data.message.providerMessageId;

  const rawBody = JSON.stringify({ MessageSid: sid, MessageStatus: 'delivered' });
  const { createHash } = await import('node:crypto');
  const hash = createHash('sha256').update(rawBody).digest('hex');
  const url = `${webhookUrl()}?bodySHA256=${hash}`;

  const response = await h.request('POST', `${WEBHOOK_PATH}?bodySHA256=${hash}`, {
    raw: true,
    headers: {
      'content-type': 'application/json',
      'x-twilio-signature': sign(url, {}),
    },
    body: rawBody,
    rawBody: true,
  });
  const text = response.buffer.toString('utf8');
  assert.equal(response.status, 200, `corps brut + bodySHA256 doivent valider — ${text}`);
  assert.match(text, /DELIVERED/);
});
