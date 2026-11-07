import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createHash } from 'node:crypto';

import {
  analyseMessage,
  fitsSingleSegment,
  validateSenderId,
  validateE164,
  messagesUrl,
  SEGMENT_LIMITS,
} from '../src/integrations/twilio.js';
import {
  expectedTwilioSignature,
  twilioBodySha256,
  validateTwilioSignature,
  validateTwilioSignatureWithBody,
  webhookUrlFromRequest,
} from '../src/integrations/twilioSignature.js';

/**
 * Tests **purs** — aucun réseau, aucune base.
 *
 * Deux familles, et chacune répond à un risque précis :
 *
 *  - **signature** : un webhook non vérifié permettrait à quiconque de marquer
 *    une alerte « remise » alors que l'agriculteur n'a rien reçu. Les vecteurs
 *    sont construits avec `node:crypto` **indépendamment** de l'implémentation
 *    testée : si les deux se trompaient de la même façon, le test ne vaudrait
 *    rien.
 *  - **segmentation** : un message qui bascule en UCS-2 coûte plus de segments
 *    et peut être coupé autrement. C'est un coût, il doit être mesuré.
 */

/* ─────────────────────────── Segmentation ─────────────────────────── */

test('SMS : un texte ASCII tient dans un segment', () => {
  const result = analyseMessage('Semer le mais cette semaine');
  assert.equal(result.encoding, 'GSM7');
  assert.equal(result.segments, 1);
  assert.equal(result.nonGsm7.length, 0);
});

test('SMS : exactement 160 caractères GSM font encore un segment', () => {
  const body = 'a'.repeat(SEGMENT_LIMITS.GSM7.single);
  assert.equal(analyseMessage(body).segments, 1);
  // Un caractère de plus : deux segments, à 153 par morceau.
  assert.equal(analyseMessage(body + 'a').segments, 2);
});

/**
 * Le piège coûteux du SMS : **un seul** caractère hors GSM force l'UCS-2 pour
 * tout le message, ce qui divise par plus de deux la capacité par segment.
 */
test('SMS : un accent hors GSM fait basculer tout le message en UCS-2', () => {
  const ascii = analyseMessage('Alerte : semer le mais cette semaine');
  assert.equal(ascii.encoding, 'GSM7');
  assert.equal(ascii.segments, 1);

  // **Résultat vérifié, contre-intuitif pour le français** : « é », « è »,
  // « à », « ù » et « ç » figurent au jeu GSM de base, mais « î », « ï »,
  // « ê », « â », « ô », « û » et « ë », **non**. Un seul de ces caractères
  // fait basculer tout le message en UCS-2.
  const ok = analyseMessage('Alerte : semer le maïs'.replace('ï', 'i'));
  assert.equal(ok.encoding, 'GSM7');

  const accentsOk = analyseMessage('Sélection : été, où, très cher, à revoir');
  assert.equal(accentsOk.encoding, 'GSM7', 'é è ù à sont au jeu GSM de base');

  // **Trois caractères français courants n'y sont pas** — vérifié un par un :
  // « ç » minuscule (seul « Ç » majuscule y figure), « ô » et « î ».
  for (const [char, word] of [['ç', 'ça va'], ['ô', 'bientôt'], ['î', 'maître']]) {
    const result = analyseMessage(word);
    assert.equal(result.encoding, 'UCS2', `le « ${char} » devrait forcer l’UCS-2`);
    assert.ok(result.nonGsm7.includes(char), `« ${char} » doit être nommé (${word})`);
  }

  const nonGsm = analyseMessage('Alerte : semer le maïs cette semaine');
  assert.equal(nonGsm.encoding, 'UCS2', 'le ï n’est pas au jeu GSM de base : il force l’UCS-2');
  assert.deepEqual(nonGsm.nonGsm7, ['ï'], 'le caractère fautif est nommé, pas deviné');
});

/**
 * Conséquence pratique pour la rédaction des alertes en français : plusieurs
 * signes typographiques courants coûtent un basculement en UCS-2, donc un
 * doublement du nombre de segments.
 */
test('SMS : les signes typographiques français usuels font basculer en UCS-2', () => {
  const costly = {
    'apostrophe typographique': 'L’alerte',
    'guillemets français': '« semer »',
    'points de suspension': 'attendre…',
    'e dans l’o': 'œil',
  };
  for (const [label, text] of Object.entries(costly)) {
    const result = analyseMessage(text);
    assert.equal(result.encoding, 'UCS2', `${label} (« ${text} ») devrait forcer l’UCS-2`);
  }
  // Leurs équivalents ASCII, eux, restent en GSM-7.
  assert.equal(analyseMessage("L'alerte").encoding, 'GSM7');
  assert.equal(analyseMessage('"semer"').encoding, 'GSM7');
  assert.equal(analyseMessage('attendre...').encoding, 'GSM7');
});

test('SMS : en UCS-2, 70 caractères font un segment et 71 en font deux', () => {
  const body = 'î'.repeat(SEGMENT_LIMITS.UCS2.single);
  const one = analyseMessage(body);
  assert.equal(one.encoding, 'UCS2');
  assert.equal(one.segments, 1);
  assert.equal(analyseMessage(body + 'î').segments, 2);
});

test('SMS : un texte vide compte comme un segment, pas zéro', () => {
  // Un message vide ne devrait jamais partir ; mais s'il est analysé, « 0
  // segment » fausserait tout calcul de coût.
  const result = analyseMessage('');
  assert.equal(result.segments, 1);
  assert.equal(result.characterCount, 0);
});

test('SMS : les emoji comptent pour ce qu’ils coûtent', () => {
  const result = analyseMessage('Alerte 🌱');
  assert.equal(result.encoding, 'UCS2');
  assert.equal(result.segments, 1);
  assert.equal(fitsSingleSegment('Alerte 🌱'), true);
});

test('SMS : un message long en GSM coûte moins de segments qu’en UCS-2', () => {
  // Même longueur, deux encodages : c'est la démonstration chiffrée du coût.
  const length = 200;
  const gsm = analyseMessage('a'.repeat(length));
  const ucs2 = analyseMessage('î'.repeat(length));
  assert.equal(gsm.encoding, 'GSM7');
  assert.equal(ucs2.encoding, 'UCS2');
  assert.ok(
    ucs2.segments > gsm.segments,
    `UCS-2 (${ucs2.segments}) doit coûter plus que GSM-7 (${gsm.segments})`,
  );
});

/* ─────────────────── Identifiant d'expéditeur (RDC) ─────────────────── */

test('Expéditeur : AGRIKONNECT est valide (11 caractères, avec lettres)', () => {
  const result = validateSenderId('AGRIKONNECT');
  assert.equal(result.valid, true, JSON.stringify(result.reasons));
});

test('Expéditeur : plus de 11 caractères est refusé', () => {
  const result = validateSenderId('AGRIKONNECTX');
  assert.equal(result.valid, false);
  assert.ok(result.reasons.some((reason) => /11/.test(reason)));
});

/**
 * Spécifique à la RDC : la documentation Twilio indique que les identifiants
 * **numériques ne sont pas pris en charge par le réseau Airtel** — les messages
 * soumis avec un identifiant numérique vers ses abonnés ne sont pas remis.
 */
test('Expéditeur : un identifiant uniquement numérique est refusé', () => {
  const result = validateSenderId('243999');
  assert.equal(result.valid, false);
  assert.ok(result.reasons.some((reason) => /numérique/i.test(reason)));
});

test('Expéditeur : un identifiant générique est signalé', () => {
  // Twilio : « Generic Alphanumeric Sender IDs, such as InfoSMS, INFO, Verify
  // and Notify, should be avoided. »
  for (const generic of ['INFO', 'InfoSMS', 'Verify', 'Notify']) {
    const result = validateSenderId(generic);
    assert.equal(result.valid, false, `${generic} devrait être signalé`);
    assert.ok(result.reasons.some((reason) => /générique/i.test(reason)), generic);
  }
});

test('Expéditeur : les caractères non autorisés sont refusés', () => {
  assert.equal(validateSenderId('AGRI@K').valid, false);
  assert.equal(validateSenderId('AGRIKÑ').valid, false);
  // Les symboles tolérés par Twilio passent.
  assert.equal(validateSenderId('AGRI-K').valid, true);
  assert.equal(validateSenderId('AGRI K').valid, true);
});

test('Expéditeur : un identifiant absent est refusé', () => {
  assert.equal(validateSenderId('').valid, false);
  assert.equal(validateSenderId(undefined).valid, false);
});

test('Numéro : seul le format E.164 est accepté', () => {
  assert.equal(validateE164('+243812345678'), true);
  assert.equal(validateE164('0812345678'), false, 'un numéro local sans +243 n’est pas E.164');
  assert.equal(validateE164('+0123456789'), false, 'un indicatif ne commence pas par 0');
  assert.equal(validateE164(''), false);
});

test('URL : l’URL d’envoi est construite à partir de la base configurable', () => {
  const url = messagesUrl('AC123', 'https://faux.serveur.test');
  assert.equal(url, 'https://faux.serveur.test/2010-04-01/Accounts/AC123/Messages.json');
  // Un slash final ne doit pas doubler.
  assert.equal(
    messagesUrl('AC123', 'https://faux.serveur.test/'),
    'https://faux.serveur.test/2010-04-01/Accounts/AC123/Messages.json',
  );
});

/* ───────────────────────── Signature Twilio ───────────────────────── */

/**
 * Signature de référence, calculée **ici** avec `node:crypto` et non via le
 * module testé : c'est ce qui donne au test une valeur.
 *
 * Algorithme publié par Twilio : URL + paramètres triés (clé+valeur, sans
 * séparateur), HMAC-SHA1 avec l'`AuthToken`, Base64.
 */
const referenceSignature = (authToken, url, params = {}) => {
  const payload =
    url +
    Object.keys(params)
      .sort()
      .map((key) => `${key}${params[key]}`)
      .join('');
  return createHmac('sha1', authToken).update(payload, 'utf8').digest('base64');
};

const AUTH_TOKEN = 'faux_jeton_de_test_pas_un_secret_reel';
const URL = 'https://api.agrikonnect.test/api/v1/webhooks/twilio/status';

test('Signature : la signature calculée correspond au calcul de référence', () => {
  const params = {
    MessageSid: 'SM1234567890abcdef',
    MessageStatus: 'delivered',
    To: '+243812345678',
    AccountSid: 'AC1234567890abcdef',
  };
  assert.equal(
    expectedTwilioSignature(AUTH_TOKEN, URL, params),
    referenceSignature(AUTH_TOKEN, URL, params),
  );
});

test('Signature : les paramètres sont triés par clé avant d’être signés', () => {
  const params = { Zebra: '1', Apple: '2', Mango: '3' };
  const shuffled = { Mango: '3', Apple: '2', Zebra: '1' };
  assert.equal(
    expectedTwilioSignature(AUTH_TOKEN, URL, params),
    expectedTwilioSignature(AUTH_TOKEN, URL, shuffled),
    'l’ordre d’arrivée des paramètres ne doit pas changer la signature',
  );
  // Et le tri compte vraiment : un ordre différent donne une autre signature.
  const manual = createHmac('sha1', AUTH_TOKEN)
    .update(`${URL}Apple2Mango3Zebra1`, 'utf8')
    .digest('base64');
  assert.equal(expectedTwilioSignature(AUTH_TOKEN, URL, params), manual);
});

test('Signature : une requête Twilio valide est acceptée', () => {
  const params = { MessageSid: 'SM1', MessageStatus: 'delivered' };
  assert.equal(
    validateTwilioSignature({
      authToken: AUTH_TOKEN,
      signature: referenceSignature(AUTH_TOKEN, URL, params),
      url: URL,
      params,
    }),
    true,
  );
});

/** Le cas central : sans ce refus, n'importe qui forge un accusé de remise. */
test('Signature : une signature forgée est refusée', () => {
  const params = { MessageSid: 'SM1', MessageStatus: 'delivered' };
  assert.equal(
    validateTwilioSignature({
      authToken: AUTH_TOKEN,
      signature: referenceSignature('un_autre_jeton', URL, params),
      url: URL,
      params,
    }),
    false,
  );
});

test('Signature : un paramètre modifié invalide la signature', () => {
  const signed = { MessageSid: 'SM1', MessageStatus: 'sent' };
  const tampered = { MessageSid: 'SM1', MessageStatus: 'delivered' };
  assert.equal(
    validateTwilioSignature({
      authToken: AUTH_TOKEN,
      signature: referenceSignature(AUTH_TOKEN, URL, signed),
      url: URL,
      params: tampered,
    }),
    false,
    'passer un message de « sent » à « delivered » doit être détecté',
  );
});

test('Signature : une URL différente invalide la signature', () => {
  const params = { MessageSid: 'SM1', MessageStatus: 'delivered' };
  assert.equal(
    validateTwilioSignature({
      authToken: AUTH_TOKEN,
      signature: referenceSignature(AUTH_TOKEN, URL, params),
      url: 'https://autre.hote.test/webhook',
      params,
    }),
    false,
  );
});

test('Signature : un paramètre ajouté par Twilio ne casse pas la validation', () => {
  // Twilio ajoute des paramètres sans préavis : la validation doit signer tout
  // ce qui est reçu, sans sélection.
  const params = { MessageSid: 'SM1', MessageStatus: 'delivered', NumMedia: '0' };
  assert.equal(
    validateTwilioSignature({
      authToken: AUTH_TOKEN,
      signature: referenceSignature(AUTH_TOKEN, URL, params),
      url: URL,
      params,
    }),
    true,
  );
});

test('Signature : le port par défaut est accepté avec ou sans', () => {
  const params = { MessageSid: 'SM1', MessageStatus: 'delivered' };
  const signedWithPort = referenceSignature(AUTH_TOKEN, 'https://h.test:443/webhook', params);
  assert.equal(
    validateTwilioSignature({
      authToken: AUTH_TOKEN,
      signature: signedWithPort,
      url: 'https://h.test/webhook',
      params,
    }),
    true,
  );
});

test('Signature : un jeton ou une signature absent est refusé, pas ignoré', () => {
  const params = { MessageSid: 'SM1' };
  assert.equal(
    validateTwilioSignature({ authToken: '', signature: 'x', url: URL, params }),
    false,
  );
  assert.equal(
    validateTwilioSignature({ authToken: AUTH_TOKEN, signature: '', url: URL, params }),
    false,
  );
  assert.equal(
    validateTwilioSignature({ authToken: AUTH_TOKEN, signature: undefined, url: URL, params }),
    false,
  );
});

test('Signature : une signature vide ne peut pas valider une signature vide', () => {
  // Comparaison à temps constant : deux chaînes vides ne doivent pas « matcher ».
  assert.equal(
    validateTwilioSignature({ authToken: AUTH_TOKEN, signature: '', url: URL, params: {} }),
    false,
  );
});

/* ──────────────────────── Corps JSON (bodySHA256) ──────────────────────── */

test('bodySHA256 : le hachage du corps brut est hexadécimal', () => {
  const body = '{"MessageSid":"SM1","MessageStatus":"delivered"}';
  assert.equal(twilioBodySha256(body), createHash('sha256').update(body).digest('hex'));
});

test('Signature JSON : un corps intact et bien signé est accepté', () => {
  const body = '{"MessageSid":"SM1","MessageStatus":"delivered"}';
  const hash = createHash('sha256').update(body).digest('hex');
  const url = `${URL}?bodySHA256=${hash}`;
  assert.equal(
    validateTwilioSignatureWithBody({
      authToken: AUTH_TOKEN,
      signature: referenceSignature(AUTH_TOKEN, url, {}),
      url,
      rawBody: body,
      bodySha256: hash,
    }),
    true,
  );
});

test('Signature JSON : un corps modifié est refusé même si la signature est valide', () => {
  const body = '{"MessageSid":"SM1","MessageStatus":"sent"}';
  const hash = createHash('sha256').update(body).digest('hex');
  const url = `${URL}?bodySHA256=${hash}`;
  assert.equal(
    validateTwilioSignatureWithBody({
      authToken: AUTH_TOKEN,
      signature: referenceSignature(AUTH_TOKEN, url, {}),
      url,
      // Le corps reçu n'est plus celui qui a été haché.
      rawBody: '{"MessageSid":"SM1","MessageStatus":"delivered"}',
      bodySha256: hash,
    }),
    false,
  );
});

test('Signature JSON : un bodySHA256 falsifié est refusé', () => {
  const body = '{"MessageSid":"SM1"}';
  const hash = createHash('sha256').update(body).digest('hex');
  const url = `${URL}?bodySHA256=${hash}`;
  assert.equal(
    validateTwilioSignatureWithBody({
      authToken: AUTH_TOKEN,
      signature: referenceSignature(AUTH_TOKEN, url, {}),
      url,
      rawBody: body,
      bodySha256: 'a'.repeat(64),
    }),
    false,
  );
});

/* ──────────────── Reconstruction d'URL derrière un mandataire ──────────────── */

test('Webhook : l’URL est reconstruite depuis la requête', () => {
  const url = webhookUrlFromRequest({
    protocol: 'https',
    headers: { host: 'api.agrikonnect.test' },
    originalUrl: '/api/v1/webhooks/twilio/status',
  });
  assert.equal(url, 'https://api.agrikonnect.test/api/v1/webhooks/twilio/status');
});

/**
 * Le piège classique : derrière un mandataire qui termine le TLS,
 * `req.protocol` vaut `http` alors que Twilio a signé `https`. Sans honorer
 * `X-Forwarded-Proto`, **toutes** les validations échouent alors que tout va
 * bien.
 */
test('Webhook : X-Forwarded-Proto et X-Forwarded-Host sont honorés', () => {
  const url = webhookUrlFromRequest({
    protocol: 'http',
    headers: {
      host: 'interne:3000',
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'api.agrikonnect.test',
    },
    originalUrl: '/api/v1/webhooks/twilio/status',
  });
  assert.equal(url, 'https://api.agrikonnect.test/api/v1/webhooks/twilio/status');
});

test('Webhook : une URL imposée par configuration l’emporte', () => {
  const url = webhookUrlFromRequest(
    { protocol: 'http', headers: { host: 'mauvais.hote' }, originalUrl: '/webhook?a=1' },
    { baseUrl: 'https://api.agrikonnect.test/api/v1/' },
  );
  assert.equal(url, 'https://api.agrikonnect.test/api/v1/webhook?a=1');
});

test('Webhook : les en-têtes de mandataire sont ignorés si on ne leur fait pas confiance', () => {
  const url = webhookUrlFromRequest(
    {
      protocol: 'http',
      headers: { host: 'vrai.hote', 'x-forwarded-proto': 'https', 'x-forwarded-host': 'faux.hote' },
      originalUrl: '/webhook',
    },
    { trustProxyHeaders: false },
  );
  assert.equal(url, 'http://vrai.hote/webhook');
});
