/**
 * Push (FCM / APNs) — fonctions pures, sans réseau ni base.
 * Les clés sont GÉNÉRÉES pendant le test : aucun secret réel.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  assertionGoogle,
  jetonFournisseurApns,
  messageFcm,
  requeteApns,
  doitRevoquer,
  planPourAppareil,
  fcmConfigure,
  apnsConfigure,
  masquer,
  avertissementPush,
  PORTEE_FCM,
} from '../src/integrations/push.js';
import { registerDeviceSchema } from '../src/modules/push/push.routes.js';

const decoder = (jwt) => jwt.split('.').slice(0, 2).map((p) => JSON.parse(Buffer.from(p, 'base64url').toString('utf8')));

test('FCM : assertion OAuth RS256 vérifiable, portée firebase.messaging, 1 h, clé PEM échappée acceptée', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pemEchappee = privateKey.export({ type: 'pkcs8', format: 'pem' }).replace(/\n/g, '\\n');
  const jwt = assertionGoogle({ clientEmail: 'push@projet.iam.gserviceaccount.com', privateKey: pemEchappee, maintenantSecondes: 1_000 });
  const [entete, charge] = decoder(jwt);
  assert.equal(entete.alg, 'RS256');
  assert.equal(charge.scope, PORTEE_FCM);
  assert.equal(charge.aud, 'https://oauth2.googleapis.com/token');
  assert.equal(charge.exp - charge.iat, 3600);
  const [h, c, s] = jwt.split('.');
  assert.ok(crypto.verify('RSA-SHA256', Buffer.from(`${h}.${c}`), publicKey, Buffer.from(s, 'base64url')));
});

test('APNs : jeton fournisseur ES256 (P1363), kid et iss attendus, vérifiable', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwt = jetonFournisseurApns({
    teamId: 'EQUIPE1234', keyId: 'CLE1234567',
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }), maintenantSecondes: 2_000,
  });
  const [entete, charge] = decoder(jwt);
  assert.deepEqual(entete, { alg: 'ES256', kid: 'CLE1234567' });
  assert.deepEqual(charge, { iss: 'EQUIPE1234', iat: 2_000 });
  const [h, c, s] = jwt.split('.');
  assert.ok(crypto.verify('sha256', Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url')));
});

test('FCM : appel entrant = message de DONNÉES priorité haute, TTL = sonnerie, valeurs en chaînes', () => {
  const { message } = messageFcm({ token: 'jeton', donnees: { callId: 'c1', kind: 'DIRECT', n: 3 }, priorite: 'HIGH', ttlSecondes: 45 });
  assert.equal(message.notification, undefined, 'pas de notification système : l’application affiche l’écran d’appel');
  assert.equal(message.android.priority, 'HIGH');
  assert.equal(message.android.ttl, '45s');
  assert.deepEqual(message.data, { callId: 'c1', kind: 'DIRECT', n: '3' });
});

test('APNs : VoIP sur <bundle>.voip, priorité 10, expiration courte, charge sans aps', () => {
  const voip = requeteApns({ token: 'ab12', type: 'voip', bundleId: 'africa.agrikonnect', donnees: { callId: 'c1' }, expirationSecondes: 45, maintenantSecondes: 100 });
  assert.equal(voip.path, '/3/device/ab12');
  assert.equal(voip.headers['apns-push-type'], 'voip');
  assert.equal(voip.headers['apns-topic'], 'africa.agrikonnect.voip');
  assert.equal(voip.headers['apns-priority'], '10');
  assert.equal(voip.headers['apns-expiration'], '145');
  assert.equal(voip.body.aps, undefined);
  assert.equal(voip.body.callId, 'c1');

  const alerte = requeteApns({ token: 'ab12', type: 'alert', bundleId: 'africa.agrikonnect', alerte: { titre: 'T', corps: 'C' } });
  assert.equal(alerte.headers['apns-topic'], 'africa.agrikonnect');
  assert.deepEqual(alerte.body.aps.alert, { title: 'T', body: 'C' });

  const fond = requeteApns({ token: 'ab12', type: 'background', bundleId: 'africa.agrikonnect' });
  assert.equal(fond.headers['apns-priority'], '5', 'Apple impose la priorité 5 en arrière-plan');
  assert.equal(fond.body.aps['content-available'], 1);
});

test('Révocation : seulement sur refus DÉFINITIF du fournisseur', () => {
  assert.equal(doitRevoquer('FCM', 404, {}), true);
  assert.equal(doitRevoquer('FCM', 400, { error: { details: [{ errorCode: 'UNREGISTERED' }] } }), true);
  assert.equal(doitRevoquer('FCM', 503, {}), false, 'panne temporaire : on garde le jeton');
  assert.equal(doitRevoquer('APNS_VOIP', 410, {}), true);
  assert.equal(doitRevoquer('APNS', 400, { reason: 'BadDeviceToken' }), true);
  assert.equal(doitRevoquer('APNS', 400, { reason: 'PayloadTooLarge' }), false);
  assert.equal(doitRevoquer('APNS', 429, { reason: 'TooManyRequests' }), false);
});

test('Plan d’envoi : VoIP iOS UNIQUEMENT pour un appel entrant ; jamais de VoIP pour arrêter une sonnerie', () => {
  const voip = { provider: 'APNS_VOIP', installationId: 'i1' };
  const ios = { provider: 'APNS', installationId: 'i1' };
  const iosSansVoip = { provider: 'APNS', installationId: 'i2' };
  const android = { provider: 'FCM', installationId: 'a1' };
  const contexte = { installationsVoip: new Set(['i1']) };

  assert.deepEqual(planPourAppareil(voip, { genre: 'APPEL_ENTRANT' }, contexte), { canal: 'APNS', type: 'voip' });
  assert.equal(planPourAppareil(voip, { genre: 'APPEL_TERMINE' }, contexte), null);
  assert.equal(planPourAppareil(voip, { genre: 'NOTIFICATION' }, contexte), null);
  assert.equal(planPourAppareil(ios, { genre: 'APPEL_ENTRANT' }, contexte), null, 'la VoIP suffit sur cette installation');
  assert.deepEqual(planPourAppareil(iosSansVoip, { genre: 'APPEL_ENTRANT' }, contexte), { canal: 'APNS', type: 'alert' }, 'repli');
  assert.deepEqual(planPourAppareil(ios, { genre: 'APPEL_TERMINE' }, contexte), { canal: 'APNS', type: 'background' });
  assert.deepEqual(planPourAppareil(android, { genre: 'APPEL_ENTRANT' }, contexte), { canal: 'FCM', priorite: 'HIGH', notification: false });
  assert.deepEqual(planPourAppareil(android, { genre: 'NOTIFICATION' }, contexte), { canal: 'FCM', priorite: 'HIGH', notification: true });
});

test('Configuration : désactivé par défaut, fournisseur incomplet = inutilisé, contradiction signalée', () => {
  assert.equal(fcmConfigure({ PUSH_ENABLED: 'false', FCM_PROJECT_ID: 'p', FCM_CLIENT_EMAIL: 'e@x.io', FCM_PRIVATE_KEY: 'k' }), false);
  assert.equal(fcmConfigure({ PUSH_ENABLED: 'true', FCM_PROJECT_ID: 'p', FCM_CLIENT_EMAIL: 'e@x.io' }), false);
  assert.equal(fcmConfigure({ PUSH_ENABLED: 'true', FCM_PROJECT_ID: 'p', FCM_CLIENT_EMAIL: 'e@x.io', FCM_PRIVATE_KEY: 'k' }), true);
  assert.equal(apnsConfigure({ PUSH_ENABLED: 'true', APNS_TEAM_ID: 't', APNS_KEY_ID: 'k', APNS_PRIVATE_KEY: 'p' }), false, 'bundle requis');
  assert.match(avertissementPush({ PUSH_ENABLED: 'true' }), /aucun push ne partira/);
  assert.equal(avertissementPush({ PUSH_ENABLED: 'false' }), null);
});

test('Journaux : jeton d’appareil masqué', () => {
  assert.equal(masquer('abcdefghijklmnop1234567890'), '…567890');
  assert.equal(masquer(null), '∅');
});

test('Enregistrement d’appareil : entrée stricte (pas d’utilisateur ni de statut fournis par le client)', () => {
  const base = { provider: 'FCM', token: 'x'.repeat(152), installationId: 'inst-0123456789' };
  assert.equal(registerDeviceSchema.safeParse(base).success, true);
  assert.equal(registerDeviceSchema.safeParse({ ...base, userId: 'autre' }).success, false);
  assert.equal(registerDeviceSchema.safeParse({ ...base, revokedAt: null }).success, false);
  assert.equal(registerDeviceSchema.safeParse({ ...base, provider: 'WEB' }).success, false);
  assert.equal(registerDeviceSchema.safeParse({ ...base, token: 'court' }).success, false);
});
