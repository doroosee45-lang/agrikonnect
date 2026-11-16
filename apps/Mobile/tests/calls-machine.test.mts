import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ETAT_INITIAL, codeErreur, phaseDepuisAppel, reduire } from '../src/features/calls/callMachine.ts';
import type { CallView } from '../src/features/calls/types.ts';

const appel = (partiel: Partial<CallView> = {}): CallView => ({
  id: 'call_1',
  conversationId: 'conv_1',
  kind: 'DIRECT',
  status: 'RINGING',
  ringExpiresAt: new Date().toISOString(),
  startedAt: null,
  endedAt: null,
  endReason: null,
  me: { status: 'INVITED', isHost: false },
  participants: [],
  ...partiel,
});

describe('appels — phase d’interface depuis l’état serveur', () => {
  it('invité qui n’a pas répondu → sonnerie', () => {
    assert.equal(phaseDepuisAppel(appel(), false), 'incoming');
  });
  it('hôte pendant la sonnerie → appel sortant', () => {
    assert.equal(phaseDepuisAppel(appel({ me: { status: 'ACCEPTED', isHost: true } }), false), 'outgoing');
  });
  it('appel actif : connexion puis en communication', () => {
    const actif = appel({ status: 'ACTIVE', me: { status: 'ACCEPTED', isHost: false } });
    assert.equal(phaseDepuisAppel(actif, false), 'connecting');
    assert.equal(phaseDepuisAppel(actif, true), 'in_call');
  });
  it('états terminaux → écran de fin', () => {
    for (const status of ['ENDED', 'CANCELLED', 'DECLINED', 'MISSED'] as const) {
      assert.equal(phaseDepuisAppel(appel({ status }), true), 'ended');
    }
  });
  it('sans place dans l’appel → rien à afficher', () => {
    assert.equal(phaseDepuisAppel(appel({ me: null }), false), 'idle');
  });
});

describe('appels — transitions d’interface', () => {
  it('un second appel n’écrase pas l’appel en cours', () => {
    const enCours = reduire(ETAT_INITIAL, { type: 'SERVER', call: appel({ status: 'ACTIVE', me: { status: 'JOINED', isHost: true } }), connected: true });
    assert.equal(enCours.phase, 'in_call');
    const autre = reduire(enCours, { type: 'SERVER', call: appel({ id: 'call_2' }), connected: false });
    assert.equal(autre.call?.id, 'call_1');
  });
  it('reconnexion réseau puis retour', () => {
    let etat = reduire(ETAT_INITIAL, { type: 'SERVER', call: appel({ status: 'ACTIVE', me: { status: 'JOINED', isHost: false } }), connected: true });
    etat = reduire(etat, { type: 'RECONNECTING' });
    assert.equal(etat.phase, 'reconnecting');
    etat = reduire(etat, { type: 'RECONNECTED' });
    assert.equal(etat.phase, 'in_call');
  });
  it('fin d’appel conserve le statut final pour l’affichage', () => {
    const fini = reduire(ETAT_INITIAL, { type: 'SERVER', call: appel({ status: 'MISSED' }), connected: false });
    assert.equal(fini.phase, 'ended');
    assert.equal(fini.endStatus, 'MISSED');
  });
  it('micro coupé / réactivé', () => {
    assert.equal(reduire(ETAT_INITIAL, { type: 'MUTE', muted: true }).muted, true);
  });
});

describe('appels — codes d’erreur', () => {
  it('permission micro refusée', () => {
    assert.equal(codeErreur({ name: 'NotAllowedError' }), 'microphone');
    assert.equal(codeErreur({ name: 'NotFoundError' }), 'microphone');
  });
  it('service indisponible (module désactivé)', () => {
    assert.equal(codeErreur({ status: 503 }), 'unavailable');
  });
  it('réseau', () => {
    assert.equal(codeErreur({ status: 0 }), 'network');
  });
});
