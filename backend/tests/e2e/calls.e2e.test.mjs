/**
 * Appels audio — de bout en bout (PostgreSQL embarqué réel + GoTrue simulé +
 * service de salles LiveKit simulé). Aucun appel réseau vers LiveKit, aucune
 * base Supabase : la configuration LiveKit ci-dessous est FACTICE.
 *
 * Couvre : autorisations serveur (membres actifs, conversation ouverte, accès
 * participant), jetons audio-only, transitions concurrentes, refus, annulation,
 * appel manqué, fin, webhooks signés (mécanisme officiel), rejeu idempotent,
 * notifications, et RLS des nouvelles tables.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Configuration FACTICE, posée avant que l'application ne lise `env`.
process.env.CALLS_ENABLED = 'true';
process.env.LIVEKIT_URL = 'wss://livekit.test.invalid';
process.env.LIVEKIT_API_KEY = 'APIcleDeTest';
process.env.LIVEKIT_API_SECRET = 'secret-de-test-uniquement-pour-les-recettes-0123456789';

const { startHarness } = await import('./support/harness.mjs');
const { AccessToken, TokenVerifier } = await import('livekit-server-sdk');

const PASSWORD = 'Agrikonnect!2026';
let h;
const salles = { creees: [], fermees: [] };
const comptes = {};
let conversationId;
let conversationBloqueeId;

const inscrire = async (cle, email, accountType = 'FARMER') => {
  const reponse = await h.request('POST', '/auth/register', {
    body: { accountType, firstName: cle, lastName: 'Appel', email, password: PASSWORD, countryCode: 'CD', locale: 'fr' },
  });
  assert.equal(reponse.status, 201, JSON.stringify(reponse.body));
  const connexion = await h.request('POST', '/auth/login', { body: { identifier: email, password: PASSWORD } });
  assert.equal(connexion.status, 200, JSON.stringify(connexion.body));
  comptes[cle] = {
    id: reponse.body.data.user.id,
    organizationId: reponse.body.data.organization.id,
    token: connexion.body.data.session.accessToken,
  };
  return comptes[cle];
};

const appeler = (cle, body, { cleIdempotence } = {}) =>
  h.request('POST', '/calls', { token: comptes[cle].token, body, headers: cleIdempotence ? { 'Idempotency-Key': cleIdempotence } : {} });
const action = (cle, id, nom) => h.request('POST', `/calls/${id}/${nom}`, { token: comptes[cle].token, body: {} });

/** Webhook signé comme LiveKit : JWT (clé/secret de l'API) portant le SHA-256 base64 du corps brut. */
const webhookSigne = async (evenement, { secret = process.env.LIVEKIT_API_SECRET, corpsSigne = null } = {}) => {
  const corps = JSON.stringify(evenement);
  const jeton = new AccessToken(process.env.LIVEKIT_API_KEY, secret);
  jeton.sha256 = crypto.createHash('sha256').update(corpsSigne ?? corps).digest('base64');
  return h.request('POST', '/webhooks/livekit', {
    rawBody: true,
    body: corps,
    headers: { 'content-type': 'application/webhook+json', authorization: await jeton.toJwt() },
  });
};

before(async () => {
  h = await startHarness();
  const { definirClientLiveKitPourTests } = await import('../../src/integrations/livekit.js');
  definirClientLiveKitPourTests({
    createRoom: async ({ name }) => { salles.creees.push(name); },
    deleteRoom: async (name) => { salles.fermees.push(name); },
  });

  await inscrire('awa', 'awa-appels@agrikonnect.test');            // organisation A (appelante)
  await inscrire('ben', 'ben-appels@agrikonnect.test', 'BUYER');   // organisation B
  await inscrire('cora', 'cora-appels@agrikonnect.test');          // rattachée à A ensuite
  await inscrire('dan', 'dan-appels@agrikonnect.test');            // étranger à la conversation
  await inscrire('eli', 'eli-appels@agrikonnect.test');            // membre RETIRÉ de B

  await h.prisma.membership.create({
    data: { userId: comptes.cora.id, organizationId: comptes.awa.organizationId, roles: ['COOPERATIVE_MEMBER'], status: 'ACTIVE' },
  });
  await h.prisma.membership.create({
    data: { userId: comptes.eli.id, organizationId: comptes.ben.organizationId, roles: ['BUYER'], status: 'REMOVED' },
  });

  conversationId = 'conv_appels_ouverte_0001';
  conversationBloqueeId = 'conv_appels_bloquee_0001';
  await h.prisma.conversation.createMany({
    data: [
      { id: conversationId, subjectType: 'ORDER', subjectId: 'ord_appels_0001', participantOrgIds: [comptes.awa.organizationId, comptes.ben.organizationId], status: 'OPEN' },
      { id: conversationBloqueeId, subjectType: 'ORDER', subjectId: 'ord_appels_0002', participantOrgIds: [comptes.awa.organizationId, comptes.ben.organizationId], status: 'BLOCKED' },
    ],
  });
});

after(async () => {
  await h.stop();
});

/* ─────────────────────── activation & schéma ─────────────────────── */

test('Appels : configuration exposée sans secret, module actif dans cette recette', async () => {
  const config = await h.request('GET', '/calls/config', { token: comptes.awa.token });
  assert.equal(config.status, 200, JSON.stringify(config.body));
  assert.equal(config.body.data.enabled, true);
  assert.equal(config.body.data.audioOnly, true);
  assert.equal(config.body.data.recording, false);
  assert.equal(config.body.data.endToEndEncryption, false, 'TLS/DTLS n’est pas du bout en bout');
  assert.equal(JSON.stringify(config.body).includes(process.env.LIVEKIT_API_SECRET), false);
});

test('RLS : les trois tables d’appel ont la sécurité au niveau des lignes activée', async () => {
  const lignes = await h.prisma.$queryRaw`
    SELECT c.relname AS table, c.relrowsecurity AS rls FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN ('call_sessions', 'call_participants', 'call_events')`;
  assert.equal(lignes.length, 3);
  for (const ligne of lignes) assert.equal(ligne.rls, true, `${ligne.table} sans RLS`);
});

test('Invitables : membres actifs des organisations de la conversation, sans soi-même ni membre retiré', async () => {
  const reponse = await h.request('GET', `/calls/eligible?conversationId=${conversationId}`, { token: comptes.awa.token });
  assert.equal(reponse.status, 200, JSON.stringify(reponse.body));
  const ids = reponse.body.data.people.map((p) => p.userId);
  assert.ok(ids.includes(comptes.ben.id));
  assert.ok(ids.includes(comptes.cora.id));
  assert.equal(ids.includes(comptes.awa.id), false, 'pas soi-même');
  assert.equal(ids.includes(comptes.eli.id), false, 'membre retiré exclu');
  assert.equal(ids.includes(comptes.dan.id), false, 'étranger exclu');
  assert.equal(reponse.body.data.callable, true);
  assert.equal((await h.request('GET', `/calls/eligible?conversationId=${conversationId}`, { token: comptes.dan.token })).status, 404);
});

/* ─────────────────────── autorisations ─────────────────────── */

test('Création : invité étranger à la conversation ou membre retiré → refus serveur', async () => {
  const etranger = await appeler('awa', { conversationId, inviteeUserIds: [comptes.dan.id] });
  assert.equal(etranger.status, 403, JSON.stringify(etranger.body));
  const retire = await appeler('awa', { conversationId, inviteeUserIds: [comptes.eli.id] });
  assert.equal(retire.status, 403, 'adhésion REMOVED refusée');
  const soiMeme = await appeler('awa', { conversationId, inviteeUserIds: [comptes.awa.id] });
  assert.equal(soiMeme.status, 422);
});

test('Création : conversation bloquée → 409 ; conversation d’autrui → 404 ; salle imposée → 422', async () => {
  assert.equal((await appeler('awa', { conversationId: conversationBloqueeId, inviteeUserIds: [comptes.ben.id] })).status, 409);
  assert.equal((await appeler('dan', { conversationId, inviteeUserIds: [comptes.ben.id] })).status, 404);
  const salleImposee = await appeler('awa', { conversationId, inviteeUserIds: [comptes.ben.id], roomName: 'salle-choisie' });
  assert.equal(salleImposee.status, 422, 'le client ne choisit pas la salle');
});

test('Appel individuel : jeton de l’hôte audio-only pour LA salle, invité sans jeton avant acceptation', async () => {
  const cree = await appeler('awa', { conversationId, inviteeUserIds: [comptes.ben.id] });
  assert.equal(cree.status, 201, JSON.stringify(cree.body));
  const { call, livekit } = cree.body.data;
  assert.equal(call.kind, 'DIRECT');
  assert.equal(call.status, 'RINGING');
  assert.equal(JSON.stringify(call).includes('ak-call-'), false, 'le nom de salle n’est pas exposé dans la vue');

  const session = await h.prisma.callSession.findUnique({ where: { id: call.id } });
  assert.ok(salles.creees.includes(session.roomName), 'salle créée côté serveur');
  const revendications = await new TokenVerifier(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET).verify(livekit.token);
  assert.equal(revendications.sub, comptes.awa.id, 'identité = utilisateur Supabase vérifié');
  assert.equal(revendications.video.room, session.roomName);
  assert.equal(revendications.video.canPublishData, false);
  assert.deepEqual(revendications.video.canPublishSources.map(String).map((s) => s.toLowerCase()), ['microphone']);

  // Notification + invitation enregistrées.
  const notification = await h.prisma.notification.findFirst({ where: { userId: comptes.ben.id, type: 'call.incoming' } });
  assert.equal(notification?.payload?.callId, call.id);

  // L'invité n'obtient aucun jeton avant d'avoir accepté ; un tiers ne voit rien.
  assert.equal((await action('ben', call.id, 'token')).status, 403);
  assert.equal((await h.request('GET', `/calls/${call.id}`, { token: comptes.dan.token })).status, 404);
  assert.equal((await action('dan', call.id, 'token')).status, 404);

  const accepte = await action('ben', call.id, 'accept');
  assert.equal(accepte.status, 200, JSON.stringify(accepte.body));
  assert.equal(accepte.body.data.call.status, 'ACTIVE');
  assert.ok(accepte.body.data.livekit.token);
  // Accepter deux fois = idempotent.
  assert.equal((await action('ben', call.id, 'accept')).status, 200);

  // Départ de l'invité : il reste seul l'hôte → fin d'appel et salle fermée.
  const quitte = await action('ben', call.id, 'leave');
  assert.equal(quitte.status, 200);
  assert.equal(quitte.body.data.status, 'ENDED');
  assert.ok(salles.fermees.includes(session.roomName));
  assert.equal((await action('awa', call.id, 'token')).status, 403, 'plus de jeton après la fin');
});

/* ─────────────────────── concurrence ─────────────────────── */

test('Conférence : deux acceptations simultanées → un seul passage RINGING → ACTIVE', async () => {
  const cree = await appeler('awa', { conversationId, inviteeUserIds: [comptes.ben.id, comptes.cora.id] });
  assert.equal(cree.status, 201, JSON.stringify(cree.body));
  const id = cree.body.data.call.id;
  assert.equal(cree.body.data.call.kind, 'GROUP');

  const [b, c] = await Promise.all([action('ben', id, 'accept'), action('cora', id, 'accept')]);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal(c.status, 200, JSON.stringify(c.body));

  const transitions = await h.prisma.callEvent.count({ where: { callId: id, type: 'call.active' } });
  assert.equal(transitions, 1, 'une seule ouverture journalisée');
  const appel = await h.prisma.callSession.findUnique({ where: { id }, include: { participants: true } });
  assert.equal(appel.status, 'ACTIVE');
  assert.equal(appel.participants.filter((p) => p.status === 'ACCEPTED').length, 3);

  assert.equal((await action('awa', id, 'end')).body.data.status, 'ENDED');
});

test('Concurrence : annulation et acceptation simultanées → état final cohérent', async () => {
  const cree = await appeler('awa', { conversationId, inviteeUserIds: [comptes.ben.id] });
  const id = cree.body.data.call.id;
  const [annulation, acceptation] = await Promise.all([action('awa', id, 'cancel'), action('ben', id, 'accept')]);
  const appel = await h.prisma.callSession.findUnique({ where: { id }, include: { participants: true } });
  const ben = appel.participants.find((p) => p.userId === comptes.ben.id);

  if (appel.status === 'CANCELLED') {
    assert.equal(annulation.status, 200);
    assert.notEqual(acceptation.status, 200, 'l’acceptation perdante est refusée');
    assert.ok(['CANCELLED', 'ACCEPTED'].includes(ben.status) === true);
    assert.equal(ben.status, 'CANCELLED');
  } else {
    assert.equal(appel.status, 'ACTIVE');
    assert.equal(acceptation.status, 200);
    assert.equal(annulation.status, 409, 'l’annulation perdante est refusée');
    assert.equal(ben.status, 'ACCEPTED');
    await action('awa', id, 'end');
  }
});

/* ─────────────────────── refus, annulation, manqué ─────────────────────── */

test('Refus : l’unique invité refuse → appel DECLINED, salle fermée', async () => {
  const cree = await appeler('awa', { conversationId, inviteeUserIds: [comptes.ben.id] });
  const id = cree.body.data.call.id;
  const refus = await action('ben', id, 'decline');
  assert.equal(refus.status, 200, JSON.stringify(refus.body));
  assert.equal(refus.body.data.status, 'DECLINED');
  assert.equal((await action('ben', id, 'decline')).status, 200, 'refus idempotent');
  assert.equal((await action('ben', id, 'accept')).status, 409, 'plus d’acceptation après refus');
});

test('Création idempotente : double envoi pendant la sonnerie → le même appel, une seule salle', async () => {
  const corps = { conversationId, inviteeUserIds: [comptes.ben.id] };
  const [premier, second] = [await appeler('awa', corps), await appeler('awa', corps)];
  assert.equal(premier.status, 201);
  assert.equal(second.body.data.call.id, premier.body.data.call.id);
  assert.equal(second.body.data.replayed, true);
  assert.equal(await h.prisma.callSession.count({ where: { id: premier.body.data.call.id } }), 1);
  await action('awa', premier.body.data.call.id, 'cancel');
});

test('Annulation : seul l’appelant annule ; les invités passent CANCELLED', async () => {
  const cree = await appeler('awa', { conversationId, inviteeUserIds: [comptes.ben.id] });
  const id = cree.body.data.call.id;
  assert.equal((await action('ben', id, 'cancel')).status, 403);
  const annule = await action('awa', id, 'cancel');
  assert.equal(annule.status, 200);
  assert.equal(annule.body.data.status, 'CANCELLED');
  assert.equal(annule.body.data.participants.find((p) => p.userId === comptes.ben.id).status, 'CANCELLED');
});

test('Appel manqué : sonnerie expirée → MISSED, invité MISSED, notification « manqué »', async () => {
  const cree = await appeler('awa', { conversationId, inviteeUserIds: [comptes.ben.id] });
  const id = cree.body.data.call.id;
  await h.prisma.callSession.update({ where: { id }, data: { ringExpiresAt: new Date(Date.now() - 1000) } });

  const vue = await h.request('GET', `/calls/${id}`, { token: comptes.ben.token });
  assert.equal(vue.status, 200);
  assert.equal(vue.body.data.status, 'MISSED');
  assert.equal(vue.body.data.me.status, 'MISSED');
  assert.equal((await action('ben', id, 'accept')).status, 409, 'trop tard pour décrocher');
  const manque = await h.prisma.notification.findFirst({ where: { userId: comptes.ben.id, type: 'call.missed' } });
  assert.equal(manque?.payload?.callId, id);
});

/* ─────────────────────── webhooks LiveKit ─────────────────────── */

test('Webhook : signature officielle, effet appliqué une seule fois, rejeu sans effet', async () => {
  const cree = await appeler('awa', { conversationId, inviteeUserIds: [comptes.ben.id] });
  const id = cree.body.data.call.id;
  await action('ben', id, 'accept');
  const { roomName } = await h.prisma.callSession.findUnique({ where: { id } });

  const evenement = {
    event: 'participant_joined',
    id: `EV_${crypto.randomBytes(6).toString('hex')}`,
    createdAt: String(Math.floor(Date.now() / 1000)),
    room: { name: roomName, sid: 'RM_test' },
    participant: { identity: comptes.ben.id, sid: 'PA_test' },
  };
  const premier = await webhookSigne(evenement);
  assert.equal(premier.status, 200, JSON.stringify(premier.body));
  assert.equal(premier.body.data.applied, true);
  const rejeu = await webhookSigne(evenement);
  assert.equal(rejeu.status, 200);
  assert.equal(rejeu.body.data.duplicate, true, 'rejeu reconnu');
  assert.equal(await h.prisma.callEvent.count({ where: { source: 'livekit', externalId: evenement.id } }), 1);

  const ben = await h.prisma.callParticipant.findFirst({ where: { callId: id, userId: comptes.ben.id } });
  assert.equal(ben.status, 'JOINED');

  // Fin de salle signalée par LiveKit → appel ENDED.
  const fin = await webhookSigne({ event: 'room_finished', id: `EV_${crypto.randomBytes(6).toString('hex')}`, createdAt: String(Math.floor(Date.now() / 1000)), room: { name: roomName, sid: 'RM_test' } });
  assert.equal(fin.status, 200);
  assert.equal((await h.prisma.callSession.findUnique({ where: { id } })).status, 'ENDED');
});

test('Webhook : faux secret, corps altéré ou identité non admise → refusé ou ignoré', async () => {
  const evenement = { event: 'participant_joined', id: 'EV_falsifie_01', createdAt: String(Math.floor(Date.now() / 1000)), room: { name: 'ak-call-inconnue', sid: 'RM_x' } };
  assert.equal((await webhookSigne(evenement, { secret: 'mauvais-secret-0123456789-0123456789-01' })).status, 401);
  assert.equal((await webhookSigne(evenement, { corpsSigne: '{"autre":"corps"}' })).status, 401, 'empreinte du corps vérifiée');
  const sansSignature = await h.request('POST', '/webhooks/livekit', {
    rawBody: true, body: JSON.stringify(evenement), headers: { 'content-type': 'application/webhook+json' },
  });
  assert.equal(sansSignature.status, 401);

  // Signé mais pour un intrus non invité : conservé au journal, sans effet.
  const cree = await appeler('awa', { conversationId, inviteeUserIds: [comptes.ben.id] });
  const { roomName } = await h.prisma.callSession.findUnique({ where: { id: cree.body.data.call.id } });
  const intrus = await webhookSigne({ event: 'participant_joined', id: 'EV_intrus_01', createdAt: String(Math.floor(Date.now() / 1000)), room: { name: roomName, sid: 'RM_y' }, participant: { identity: comptes.dan.id, sid: 'PA_y' } });
  assert.equal(intrus.status, 200);
  assert.equal(intrus.body.data.applied, false);
  const journal = await h.prisma.callEvent.findFirst({ where: { externalId: 'EV_intrus_01' } });
  assert.equal(journal.details.reason, 'participant_not_admitted');
  assert.equal(JSON.stringify(journal.details).includes('authorization'), false, 'aucun en-tête conservé');
  await action('awa', cree.body.data.call.id, 'cancel');
});
