/**
 * Appels audio — règles pures, jetons et câblage (sans base, sans réseau).
 * Les parcours complets (base réelle, webhook signé, concurrence) sont dans
 * tests/e2e/calls.e2e.test.mjs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// Configuration LiveKit FACTICE, posée avant le chargement de `env` (aucun secret réel).
process.env.CALLS_ENABLED = 'true';
process.env.LIVEKIT_URL = 'wss://livekit.test.invalid';
process.env.LIVEKIT_API_KEY = 'APIcleDeTest';
process.env.LIVEKIT_API_SECRET = 'secret-de-test-uniquement-pour-les-recettes-0123456789';

const { TokenVerifier } = await import('livekit-server-sdk');
const etat = await import('../src/modules/calls/calls.state.js');
const { evaluerActivation } = await import('../src/modules/calls/callsConfig.js');
const { droitsAudioSeulement, creerJetonAudio } = await import('../src/integrations/livekit.js');
const { createCallSchema } = await import('../src/modules/calls/calls.routes.js');
const { nouveauNomDeSalle } = await import('../src/modules/calls/calls.service.js');
const { MODULE_PREFIXES } = await import('../src/middleware/settingsEffects.js');
const { can } = await import('../src/shared/permissions.js');

// ─── Cycle de vie ──────────────────────────────────────────────────────────

test('Appels : transitions d’appel autorisées et interdites', () => {
  assert.ok(etat.transitionAppelPermise('RINGING', 'ACTIVE'));
  assert.ok(etat.transitionAppelPermise('RINGING', 'CANCELLED'));
  assert.ok(etat.transitionAppelPermise('RINGING', 'MISSED'));
  assert.ok(etat.transitionAppelPermise('ACTIVE', 'ENDED'));
  for (const terminal of etat.ETATS_TERMINAUX_APPEL) {
    for (const vers of ['RINGING', 'ACTIVE', 'ENDED', 'CANCELLED']) {
      assert.equal(etat.transitionAppelPermise(terminal, vers), false, `${terminal} → ${vers} interdit`);
    }
  }
  assert.equal(etat.transitionAppelPermise('ACTIVE', 'RINGING'), false);
  assert.equal(etat.transitionAppelPermise('ACTIVE', 'CANCELLED'), false, 'un appel décroché se termine, il ne s’annule pas');
});

test('Appels : transitions de participant (reconnexion LEFT → JOINED permise)', () => {
  assert.ok(etat.transitionParticipantPermise('INVITED', 'ACCEPTED'));
  assert.ok(etat.transitionParticipantPermise('ACCEPTED', 'JOINED'));
  assert.ok(etat.transitionParticipantPermise('LEFT', 'JOINED'));
  assert.equal(etat.transitionParticipantPermise('INVITED', 'JOINED'), false, 'pas de salle sans acceptation');
  assert.equal(etat.transitionParticipantPermise('DECLINED', 'ACCEPTED'), false);
  assert.deepEqual(etat.etatsParticipantVers('ACCEPTED'), ['INVITED']);
});

test('Appels : aucun jeton pour un invité qui n’a pas accepté', () => {
  const sonne = { status: 'RINGING' };
  const actif = { status: 'ACTIVE' };
  assert.equal(etat.peutObtenirJeton(sonne, { isHost: true, status: 'ACCEPTED' }), true, 'l’hôte attend dans la salle');
  assert.equal(etat.peutObtenirJeton(sonne, { isHost: false, status: 'INVITED' }), false);
  assert.equal(etat.peutObtenirJeton(actif, { isHost: false, status: 'INVITED' }), false);
  assert.equal(etat.peutObtenirJeton(actif, { isHost: false, status: 'ACCEPTED' }), true);
  assert.equal(etat.peutObtenirJeton(actif, { isHost: false, status: 'LEFT' }), true, 'reconnexion');
  assert.equal(etat.peutObtenirJeton(actif, { isHost: false, status: 'DECLINED' }), false);
  assert.equal(etat.peutObtenirJeton({ status: 'ENDED' }, { isHost: true, status: 'ACCEPTED' }), false);
  assert.equal(etat.peutObtenirJeton(actif, null), false);
});

test('Appels : refus collectif, fin après départ, sonnerie expirée', () => {
  const p = (userId, status, isHost = false) => ({ userId, status, isHost });
  assert.equal(etat.tousOntRefuse([p('h', 'ACCEPTED', true), p('a', 'DECLINED'), p('b', 'INVITED')]), false);
  assert.equal(etat.tousOntRefuse([p('h', 'ACCEPTED', true), p('a', 'DECLINED'), p('b', 'DECLINED')]), true);
  assert.equal(etat.doitSeTerminerApresDepart([p('h', 'JOINED', true), p('a', 'JOINED')], 'a'), true, 'seul, on raccroche');
  assert.equal(etat.doitSeTerminerApresDepart([p('h', 'JOINED', true), p('a', 'JOINED'), p('b', 'JOINED')], 'a'), false);
  const maintenant = new Date('2026-11-16T12:00:00Z');
  assert.equal(etat.sonnerieExpiree({ status: 'RINGING', ringExpiresAt: '2026-11-16T11:59:59Z' }, maintenant), true);
  assert.equal(etat.sonnerieExpiree({ status: 'RINGING', ringExpiresAt: '2026-11-16T12:00:30Z' }, maintenant), false);
  assert.equal(etat.sonnerieExpiree({ status: 'ACTIVE', ringExpiresAt: '2026-11-16T11:00:00Z' }, maintenant), false);
});

// ─── Activation (priorité documentée) ──────────────────────────────────────

test('Appels : actifs seulement si CALLS_ENABLED, LiveKit et modules.appels le permettent', () => {
  assert.deepEqual(evaluerActivation({ callsEnabled: 'true', liveKitPret: true, reglageModule: undefined }), { enabled: true, reasons: [] });
  assert.deepEqual(evaluerActivation({ callsEnabled: 'true', liveKitPret: true, reglageModule: true }).enabled, true);
  const coupeInfra = evaluerActivation({ callsEnabled: 'false', liveKitPret: true, reglageModule: true });
  assert.equal(coupeInfra.enabled, false, 'CALLS_ENABLED=false l’emporte sur le réglage admin');
  assert.deepEqual(coupeInfra.reasons, ['CALLS_ENABLED_FALSE']);
  assert.deepEqual(evaluerActivation({ callsEnabled: 'true', liveKitPret: false }).reasons, ['LIVEKIT_NOT_CONFIGURED']);
  assert.deepEqual(evaluerActivation({ callsEnabled: 'true', liveKitPret: true, reglageModule: false }).reasons, ['MODULE_DISABLED_BY_ADMIN']);
  assert.equal(evaluerActivation({}).enabled, false, 'défaut : désactivé');
});

// ─── Jetons : audio uniquement ─────────────────────────────────────────────

test('Jetons : micro seul, réception audio, ni vidéo, ni écran, ni données, ni administration', () => {
  const droits = droitsAudioSeulement('ak-call-abc');
  assert.equal(droits.room, 'ak-call-abc');
  assert.equal(droits.roomJoin, true);
  assert.equal(droits.canSubscribe, true);
  assert.equal(droits.canPublish, true);
  assert.equal(droits.canPublishSources.length, 1, 'une seule source publiable');
  assert.equal(droits.canPublishData, false);
  for (const interdit of ['roomCreate', 'roomList', 'roomRecord', 'roomAdmin', 'ingressAdmin', 'recorder', 'agent', 'hidden', 'canUpdateOwnMetadata']) {
    assert.equal(droits[interdit], false, `${interdit} refusé`);
  }
});

test('Jetons : signés côté serveur, courts, limités à UNE salle et au micro', async () => {
  const jeton = await creerJetonAudio({ salle: 'ak-call-xyz', identite: '11111111-1111-1111-1111-111111111111', nom: 'Awa', dureeSecondes: 120 });
  const revendications = await new TokenVerifier(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET).verify(jeton);
  assert.equal(revendications.sub, '11111111-1111-1111-1111-111111111111');
  assert.equal(revendications.video.room, 'ak-call-xyz');
  assert.deepEqual(revendications.video.canPublishSources.map(String).map((s) => s.toLowerCase()), ['microphone']);
  assert.equal(revendications.video.canPublishData, false);
  assert.ok(!revendications.video.roomAdmin && !revendications.video.roomRecord);
  assert.ok(revendications.exp - revendications.nbf <= 120 + 5, 'durée de vie courte');
  await assert.rejects(new TokenVerifier(process.env.LIVEKIT_API_KEY, 'autre-secret-0123456789-0123456789-0123').verify(jeton), 'faux secret refusé');
});

test('Salles : nom généré par le serveur, imprévisible', () => {
  const a = nouveauNomDeSalle();
  const b = nouveauNomDeSalle();
  assert.match(a, /^ak-call-[0-9a-f]{32}$/);
  assert.notEqual(a, b);
});

// ─── Entrée client et câblage ──────────────────────────────────────────────

test('Création : le client ne fournit ni nom de salle, ni rôle, ni statut', () => {
  const base = { conversationId: 'conv_0123456789', inviteeUserIds: ['22222222-2222-2222-2222-222222222222'] };
  assert.equal(createCallSchema.safeParse(base).success, true);
  for (const champ of [{ roomName: 'ma-salle' }, { role: 'HOST' }, { status: 'ACTIVE' }, { participants: [] }]) {
    assert.equal(createCallSchema.safeParse({ ...base, ...champ }).success, false, `${Object.keys(champ)[0]} refusé`);
  }
  assert.equal(createCallSchema.safeParse({ ...base, inviteeUserIds: [] }).success, false, 'au moins un invité');
  assert.equal(createCallSchema.safeParse({ ...base, inviteeUserIds: ['pas-un-uuid'] }).success, false);
});

test('Câblage : drapeau `modules.appels` sur /calls, permissions alignées sur la messagerie', () => {
  assert.ok(MODULE_PREFIXES.some((m) => m.module === 'appels' && m.prefixes.includes('/calls')));
  assert.equal(can(['BUYER'], 'calls.start'), true);
  assert.equal(can(['INVESTOR'], 'calls.start'), false, 'mêmes acteurs que la messagerie');
});
