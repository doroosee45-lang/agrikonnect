import { describe, expect, it } from 'vitest';

import { ETAT_INITIAL, codeErreur, phaseDepuisAppel, reduire } from '@/features/calls/callMachine';
import type { CallView } from '@/features/calls/types';

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
    expect(phaseDepuisAppel(appel(), false)).toBe('incoming');
  });
  it('hôte pendant la sonnerie → appel sortant', () => {
    expect(phaseDepuisAppel(appel({ me: { status: 'ACCEPTED', isHost: true } }), false)).toBe('outgoing');
  });
  it('appel actif : connexion puis en communication', () => {
    const actif = appel({ status: 'ACTIVE', me: { status: 'ACCEPTED', isHost: false } });
    expect(phaseDepuisAppel(actif, false)).toBe('connecting');
    expect(phaseDepuisAppel(actif, true)).toBe('in_call');
  });
  it('états terminaux → écran de fin', () => {
    for (const status of ['ENDED', 'CANCELLED', 'DECLINED', 'MISSED'] as const) {
      expect(phaseDepuisAppel(appel({ status }), true)).toBe('ended');
    }
  });
  it('sans place dans l’appel → rien à afficher', () => {
    expect(phaseDepuisAppel(appel({ me: null }), false)).toBe('idle');
  });
});

describe('appels — transitions d’interface', () => {
  it('un second appel n’écrase pas l’appel en cours', () => {
    const enCours = reduire(ETAT_INITIAL, { type: 'SERVER', call: appel({ status: 'ACTIVE', me: { status: 'JOINED', isHost: true } }), connected: true });
    expect(enCours.phase).toBe('in_call');
    const autre = reduire(enCours, { type: 'SERVER', call: appel({ id: 'call_2' }), connected: false });
    expect(autre.call?.id).toBe('call_1');
  });
  it('reconnexion réseau puis retour', () => {
    let etat = reduire(ETAT_INITIAL, { type: 'SERVER', call: appel({ status: 'ACTIVE', me: { status: 'JOINED', isHost: false } }), connected: true });
    etat = reduire(etat, { type: 'RECONNECTING' });
    expect(etat.phase).toBe('reconnecting');
    etat = reduire(etat, { type: 'RECONNECTED' });
    expect(etat.phase).toBe('in_call');
  });
  it('fin d’appel conserve le statut final pour l’affichage', () => {
    const fini = reduire(ETAT_INITIAL, { type: 'SERVER', call: appel({ status: 'MISSED' }), connected: false });
    expect(fini.phase).toBe('ended');
    expect(fini.endStatus).toBe('MISSED');
  });
  it('micro coupé / réactivé', () => {
    expect(reduire(ETAT_INITIAL, { type: 'MUTE', muted: true }).muted).toBe(true);
  });
});

describe('appels — codes d’erreur', () => {
  it('permission micro refusée', () => {
    expect(codeErreur({ name: 'NotAllowedError' })).toBe('microphone');
    expect(codeErreur({ name: 'NotFoundError' })).toBe('microphone');
  });
  it('service indisponible (module désactivé)', () => {
    expect(codeErreur({ status: 503 })).toBe('unavailable');
  });
  it('réseau', () => {
    expect(codeErreur({ status: 0 })).toBe('network');
  });
});
