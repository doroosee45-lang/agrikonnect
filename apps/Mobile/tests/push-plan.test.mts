import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { jetonsAEnregistrer, lireFinAppel, lireInvitation, uuidDepuisAppel } from '../src/features/calls/pushPlan.ts';

const JETON = 'x'.repeat(64);

describe('push — jetons déclarés au serveur', () => {
  it('Android : FCM seulement', () => {
    assert.deepEqual(jetonsAEnregistrer('android', { fcm: JETON, apns: JETON, voip: JETON }, { voipPret: true }), [{ provider: 'FCM', token: JETON }]);
  });
  it('iOS sans raccord PushKit → CallKit : aucun jeton VoIP (repli alerte)', () => {
    assert.deepEqual(jetonsAEnregistrer('ios', { apns: JETON, voip: JETON }, { voipPret: false }), [{ provider: 'APNS', token: JETON }]);
  });
  it('iOS avec raccord natif : APNs + VoIP', () => {
    assert.deepEqual(jetonsAEnregistrer('ios', { apns: JETON, voip: JETON }, { voipPret: true }).map((j) => j.provider), ['APNS', 'APNS_VOIP']);
  });
  it('jetons invalides ou plateforme web ignorés', () => {
    assert.deepEqual(jetonsAEnregistrer('android', { fcm: 'court' }, { voipPret: false }), []);
    assert.deepEqual(jetonsAEnregistrer('android', { fcm: 'x'.repeat(5000) }, { voipPret: false }), []);
    assert.deepEqual(jetonsAEnregistrer('web', { fcm: JETON }, { voipPret: true }), []);
  });
});

describe('push — lecture des invitations', () => {
  const maintenant = Date.parse('2026-11-16T10:00:00Z');
  const donnees = { genre: 'APPEL_ENTRANT', type: 'APPEL_ENTRANT', callId: 'cm3abcdefghijk', conversationId: 'conv_123456', callerName: ' Awa ', ringExpiresAt: '2026-11-16T10:00:45Z' };

  it('invitation valide', () => {
    assert.deepEqual(lireInvitation(donnees, maintenant), { callId: 'cm3abcdefghijk', conversationId: 'conv_123456', callerName: 'Awa', ringExpiresAt: '2026-11-16T10:00:45Z' });
  });
  it('sonnerie expirée → aucun écran d’appel', () => {
    assert.equal(lireInvitation({ ...donnees, ringExpiresAt: '2026-11-16T09:59:00Z' }, maintenant), null);
  });
  it('autre genre ou identifiant invalide → ignoré', () => {
    assert.equal(lireInvitation({ ...donnees, genre: 'NOTIFICATION' }, maintenant), null);
    assert.equal(lireInvitation({ ...donnees, callId: 'x' }, maintenant), null);
    assert.equal(lireInvitation(null, maintenant), null);
    assert.equal(lireInvitation('APPEL_ENTRANT', maintenant), null);
  });
  it('fin d’appel', () => {
    assert.equal(lireFinAppel({ genre: 'APPEL_TERMINE', callId: 'cm3abcdefghijk' }), 'cm3abcdefghijk');
    assert.equal(lireFinAppel({ genre: 'APPEL_ENTRANT', callId: 'cm3abcdefghijk' }), null);
  });
});

describe('push — UUID CallKit / ConnectionService', () => {
  it('déterministe et au format UUID v4', () => {
    const a = uuidDepuisAppel('cm3abcdefghijk');
    assert.equal(a, uuidDepuisAppel('cm3abcdefghijk'));
    assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('appels différents → UUID différents', () => {
    assert.notEqual(uuidDepuisAppel('cm3abcdefghijk'), uuidDepuisAppel('cm3abcdefghijl'));
  });
});
