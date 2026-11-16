/**
 * Push de bout en bout (PostgreSQL embarqué + GoTrue simulé + transport
 * FCM/APNs SIMULÉ qui capture les envois). Aucun appel réseau vers Google ni
 * Apple ; les clés sont GÉNÉRÉES pendant le test (aucun secret réel).
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
Object.assign(process.env, {
  CALLS_ENABLED: 'true',
  LIVEKIT_URL: 'wss://livekit.test.invalid',
  LIVEKIT_API_KEY: 'APIcleDeTest',
  LIVEKIT_API_SECRET: 'secret-de-test-uniquement-pour-les-recettes-0123456789',
  PUSH_ENABLED: 'true',
  FCM_PROJECT_ID: 'projet-test',
  FCM_CLIENT_EMAIL: 'push@projet-test.iam.gserviceaccount.com',
  FCM_PRIVATE_KEY: rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).replace(/\n/g, '\\n'),
  APNS_TEAM_ID: 'EQUIPE1234',
  APNS_KEY_ID: 'CLE1234567',
  APNS_PRIVATE_KEY: ec.privateKey.export({ type: 'pkcs8', format: 'pem' }),
  APNS_BUNDLE_ID: 'africa.agrikonnect.test',
  APNS_ENVIRONMENT: 'sandbox',
});

const { startHarness } = await import('./support/harness.mjs');

const PASSWORD = 'Agrikonnect!2026';
let h;
const comptes = {};
let conversationId;
const envois = { fcm: [], apns: [], oauth: 0 };

const jeton = (prefixe) => `${prefixe}${crypto.randomBytes(40).toString('hex')}`;

const inscrire = async (cle, accountType = 'FARMER') => {
  const email = `${cle}-push@agrikonnect.test`;
  const reponse = await h.request('POST', '/auth/register', {
    body: { accountType, firstName: cle, lastName: 'Push', email, password: PASSWORD, countryCode: 'CD', locale: 'fr' },
  });
  assert.equal(reponse.status, 201, JSON.stringify(reponse.body));
  const connexion = await h.request('POST', '/auth/login', { body: { identifier: email, password: PASSWORD } });
  comptes[cle] = { id: reponse.body.data.user.id, organizationId: reponse.body.data.organization.id, token: connexion.body.data.session.accessToken };
};

const enregistrer = (cle, corps) => h.request('POST', '/me/push-devices', { token: comptes[cle].token, body: corps });
const vider = () => { envois.fcm.length = 0; envois.apns.length = 0; };

before(async () => {
  h = await startHarness();
  const { definirClientLiveKitPourTests } = await import('../../src/integrations/livekit.js');
  definirClientLiveKitPourTests({ createRoom: async () => {}, deleteRoom: async () => {} });
  const { definirTransportPushPourTests } = await import('../../src/integrations/push.js');
  definirTransportPushPourTests({
    oauth: async () => { envois.oauth += 1; return { status: 200, body: { access_token: 'jeton-acces-factice', expires_in: 3600 } }; },
    fcm: async ({ message }) => {
      envois.fcm.push(message);
      return message.message.token.startsWith('revoque')
        ? { status: 404, body: { error: { details: [{ errorCode: 'UNREGISTERED' }] } } }
        : { status: 200, body: { name: 'projects/x/messages/1' } };
    },
    apns: async ({ requete, environnement }) => {
      envois.apns.push({ ...requete, environnement });
      return requete.path.includes('/dead') ? { status: 410, body: { reason: 'Unregistered' } } : { status: 200, body: {} };
    },
  });

  await inscrire('awa');
  await inscrire('ben', 'BUYER');
  await inscrire('cora', 'BUYER');
  await inscrire('dan');
  // Cora rejoint l'organisation de Ben (membre actif, invitable).
  await h.prisma.membership.create({ data: { userId: comptes.cora.id, organizationId: comptes.ben.organizationId, roles: ['BUYER'], status: 'ACTIVE' } });

  conversationId = 'conv_push_ouverte_000001';
  await h.prisma.conversation.create({
    data: { id: conversationId, subjectType: 'ORDER', subjectId: 'ord_push_000001', participantOrgIds: [comptes.awa.organizationId, comptes.ben.organizationId], status: 'OPEN' },
  });
});

after(async () => {
  await h.stop();
});

const appareils = {};

test('Appareils : enregistrement Android + iOS (alertes et VoIP), jeton jamais renvoyé en clair', async () => {
  appareils.benFcm = jeton('fcm');
  appareils.benVoip = crypto.randomBytes(32).toString('hex');
  appareils.benApns = crypto.randomBytes(32).toString('hex');
  assert.equal((await enregistrer('ben', { provider: 'FCM', token: appareils.benFcm, installationId: 'inst-ben-android' })).status, 201);
  assert.equal((await enregistrer('ben', { provider: 'APNS_VOIP', token: appareils.benVoip, installationId: 'inst-ben-ios' })).status, 201);
  assert.equal((await enregistrer('ben', { provider: 'APNS', token: appareils.benApns, installationId: 'inst-ben-ios' })).status, 201);

  const liste = await h.request('GET', '/me/push-devices', { token: comptes.ben.token });
  assert.equal(liste.status, 200);
  assert.equal(liste.body.data.length, 3);
  const json = JSON.stringify(liste.body);
  for (const t of [appareils.benFcm, appareils.benVoip, appareils.benApns]) assert.equal(json.includes(t), false, 'jeton masqué');
  assert.ok(liste.body.data.every((a) => a.tokenSuffix.length === 6));
});

test('Appel entrant : FCM données priorité haute + VoIP iOS ; aucune alerte doublon ; rien pour l’appelant', async () => {
  vider();
  const cree = await h.request('POST', '/calls', { token: comptes.awa.token, body: { conversationId, inviteeUserIds: [comptes.ben.id] } });
  assert.equal(cree.status, 201, JSON.stringify(cree.body));
  appareils.callId = cree.body.data.call.id;

  assert.equal(envois.fcm.length, 1);
  const fcm = envois.fcm[0].message;
  assert.equal(fcm.token, appareils.benFcm);
  assert.equal(fcm.android.priority, 'HIGH');
  assert.equal(fcm.android.ttl, '45s');
  assert.equal(fcm.notification, undefined);
  assert.equal(fcm.data.genre, 'APPEL_ENTRANT');
  assert.equal(fcm.data.callId, appareils.callId);
  assert.equal(JSON.stringify(fcm).includes('ak-call-'), false, 'nom de salle jamais transmis');

  assert.equal(envois.apns.length, 1, 'VoIP seulement : pas d’alerte en doublon sur la même installation');
  const voip = envois.apns[0];
  assert.equal(voip.path, `/3/device/${appareils.benVoip}`);
  assert.equal(voip.headers['apns-push-type'], 'voip');
  assert.equal(voip.headers['apns-topic'], 'africa.agrikonnect.test.voip');
  assert.equal(voip.headers['apns-priority'], '10');
  assert.equal(voip.environnement, 'sandbox');
  assert.equal(voip.body.callId, appareils.callId);

  const enregistrement = await h.prisma.notification.findFirst({ where: { userId: comptes.ben.id, type: 'call.incoming', channel: 'PUSH' } });
  assert.ok(enregistrement, 'le push passe par le service de notifications (trace en base)');
});

test('Décroché : arrêt de sonnerie sur les autres appareils (FCM données + iOS background, JAMAIS de VoIP)', async () => {
  vider();
  const accepte = await h.request('POST', `/calls/${appareils.callId}/accept`, { token: comptes.ben.token, body: {} });
  assert.equal(accepte.status, 200, JSON.stringify(accepte.body));
  assert.equal(envois.fcm.length, 1);
  assert.equal(envois.fcm[0].message.data.genre, 'APPEL_TERMINE');
  assert.equal(envois.fcm[0].message.data.reason, 'answered');
  assert.equal(envois.apns.length, 1);
  assert.equal(envois.apns[0].headers['apns-push-type'], 'background');
  assert.equal(envois.apns[0].headers['apns-priority'], '5');
  assert.ok(envois.apns.every((r) => r.headers['apns-push-type'] !== 'voip'));
  await h.request('POST', `/calls/${appareils.callId}/end`, { token: comptes.awa.token, body: {} });
});

test('Préférence utilisateur : PUSH désactivé pour les appels entrants → aucun envoi', async () => {
  await h.prisma.notificationPreference.create({ data: { userId: comptes.ben.id, type: 'call.incoming', channel: 'PUSH', enabled: false } });
  vider();
  const cree = await h.request('POST', '/calls', { token: comptes.awa.token, body: { conversationId, inviteeUserIds: [comptes.ben.id] } });
  assert.equal(cree.status, 201);
  assert.equal(envois.fcm.length + envois.apns.length, 0);
  await h.request('POST', `/calls/${cree.body.data.call.id}/cancel`, { token: comptes.awa.token, body: {} });
  await h.prisma.notificationPreference.deleteMany({ where: { userId: comptes.ben.id } });
});

test('Révocation : jeton refusé définitivement (FCM 404, APNs 410) → appareil révoqué en base', async () => {
  const fcmMort = jeton('revoque');
  const voipMort = `dead${crypto.randomBytes(30).toString('hex')}`;
  await enregistrer('cora', { provider: 'FCM', token: fcmMort, installationId: 'inst-cora-android' });
  await enregistrer('cora', { provider: 'APNS_VOIP', token: voipMort, installationId: 'inst-cora-ios' });

  const cree = await h.request('POST', '/calls', { token: comptes.awa.token, body: { conversationId, inviteeUserIds: [comptes.cora.id] } });
  assert.equal(cree.status, 201, JSON.stringify(cree.body));
  const revoques = await h.prisma.pushDevice.findMany({ where: { userId: comptes.cora.id, revokedAt: { not: null } } });
  assert.equal(revoques.length, 2);
  assert.ok(revoques.every((a) => a.revokedReason?.startsWith('provider_')));
  await h.request('POST', `/calls/${cree.body.data.call.id}/cancel`, { token: comptes.awa.token, body: {} });
});

test('Appel manqué : notification visible (FCM avec notification + alerte iOS)', async () => {
  vider();
  const cree = await h.request('POST', '/calls', { token: comptes.awa.token, body: { conversationId, inviteeUserIds: [comptes.ben.id] } });
  const id = cree.body.data.call.id;
  await h.prisma.callSession.update({ where: { id }, data: { ringExpiresAt: new Date(Date.now() - 1000) } });
  vider();
  const vue = await h.request('GET', `/calls/${id}`, { token: comptes.ben.token });
  assert.equal(vue.body.data.status, 'MISSED');
  const visibles = envois.fcm.filter((m) => m.message.data.type === 'call.missed');
  assert.equal(visibles.length, 1);
  assert.deepEqual(visibles[0].message.notification, { title: 'Appel audio manqué', body: 'Un appel audio n’a pas abouti.' });
  assert.ok(envois.apns.some((r) => r.headers['apns-push-type'] === 'alert' && r.body.type === 'call.missed'));
});

test('Rotation et changement de propriétaire : un jeton n’appartient qu’à un seul compte', async () => {
  const nouveau = jeton('fcm');
  await enregistrer('ben', { provider: 'FCM', token: nouveau, installationId: 'inst-ben-android' });
  const ancien = await h.prisma.pushDevice.findFirst({ where: { token: appareils.benFcm } });
  assert.equal(ancien.revokedReason, 'rotated');

  // Le même jeton réenregistré par Dan (téléphone cédé) change de propriétaire.
  assert.equal((await enregistrer('dan', { provider: 'FCM', token: nouveau, installationId: 'inst-dan-android' })).status, 201);
  const ligne = await h.prisma.pushDevice.findFirst({ where: { token: nouveau } });
  assert.equal(ligne.userId, comptes.dan.id);
  const listeBen = await h.request('GET', '/me/push-devices', { token: comptes.ben.token });
  assert.equal(listeBen.body.data.some((a) => a.id === ligne.id), false);

  // On ne retire que SES appareils.
  assert.equal((await h.request('DELETE', `/me/push-devices/${ligne.id}`, { token: comptes.ben.token })).status, 404);
  assert.equal((await h.request('DELETE', `/me/push-devices/${ligne.id}`, { token: comptes.dan.token })).status, 200);
});

test('Configuration d’appel : canaux push opérationnels exposés sans secret', async () => {
  const config = await h.request('GET', '/calls/config', { token: comptes.awa.token });
  assert.deepEqual(config.body.data.push, { android: true, iosVoip: true });
  const json = JSON.stringify(config.body);
  assert.equal(json.includes('PRIVATE KEY'), false);
  assert.equal(json.includes(process.env.LIVEKIT_API_SECRET), false);
});
