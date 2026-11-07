import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decrireErreurTwilio,
  messageErreurTwilio,
  erreurRejouable,
  CODES_TWILIO_GERES,
} from '../src/integrations/twilioErrors.js';

/**
 * Unité pure — correspondance des codes d'erreur Twilio.
 *
 * Ces messages sont stockés dans `sms_messages.errorMessage` et renvoyés par
 * `/sms/test-send`. Ils sont donc lus par un exploitant qui n'est pas
 * développeur : chaque code doit donner une **cause probable** et une **action**,
 * en français, sans Markdown (la base et le JSON ne le rendent pas).
 */

/** Les 10 codes exigés, avec ce qu'ils signifient réellement. */
const CODES_EXIGES = {
  21211: /numéro/i,
  21608: /essai/i,
  21614: /fixe|SMS/i,
  20003: /identifiants|authentification/i,
  30003: /expir/i,
  30005: /opérateur/i,
  30006: /fixe|injoignable/i,
  30007: /bloqu/i,
  63016: /géographique|destination/i,
  21612: /canal|SMS/i,
};

test('codes Twilio : les 10 codes exigés sont tous gérés', () => {
  for (const code of Object.keys(CODES_EXIGES)) {
    assert.ok(CODES_TWILIO_GERES.includes(code), `le code ${code} n’est pas géré`);
  }
});

test('codes Twilio : chaque code exigé a un résumé qui nomme le problème', () => {
  for (const [code, motif] of Object.entries(CODES_EXIGES)) {
    const e = decrireErreurTwilio(code);
    assert.equal(e.code, String(code));
    assert.match(e.resume, motif, `résumé de ${code} : ${e.resume}`);
  }
});

test('codes Twilio : chaque code donne une cause ET une action', () => {
  for (const code of CODES_TWILIO_GERES) {
    const e = decrireErreurTwilio(code);
    assert.ok(e.cause.length > 20, `${code} : cause trop courte — ${e.cause}`);
    assert.ok(e.action.length > 20, `${code} : action trop courte — ${e.action}`);
    assert.equal(typeof e.rejouable, 'boolean', `${code} : rejouable doit être booléen`);
  }
});

test('codes Twilio : 20003 nomme les deux variables à vérifier', () => {
  const e = decrireErreurTwilio('20003');
  assert.match(e.cause, /TWILIO_ACCOUNT_SID/);
  assert.match(e.cause, /TWILIO_AUTH_TOKEN/);
  assert.match(e.action, /sms:verifier-config/, 'l’action doit pointer vers la commande de diagnostic');
});

test('codes Twilio : 63016 nomme la RDC et le réglage à changer', () => {
  const e = decrireErreurTwilio('63016');
  assert.match(e.action, /République démocratique du Congo/);
  assert.match(e.action, /Geographic Permissions/);
});

test('codes Twilio : 21608 explique la limite du compte d’essai', () => {
  const e = decrireErreurTwilio('21608');
  assert.match(e.cause, /essai|Trial/i);
  assert.match(e.action, /Verified Caller IDs|compte payant/i);
});

test('codes Twilio : 21614 dit de ne pas réessayer', () => {
  const e = decrireErreurTwilio('21614');
  assert.equal(e.rejouable, false);
  assert.match(e.action, /ne pas réessayer|Ne pas réessayer/i);
});

test('codes Twilio : seuls 30003 et 30005 sont rejouables', () => {
  /*
   * Rejouer un échec définitif coûte de l'argent et du temps sans rien changer.
   * Seuls les codes de défaillance transitoire de l'opérateur méritent une
   * nouvelle tentative.
   */
  assert.equal(erreurRejouable('30003'), true);
  assert.equal(erreurRejouable('30005'), true);
  for (const code of ['20003', '21211', '21608', '21612', '21614', '30006', '30007', '63016']) {
    assert.equal(erreurRejouable(code), false, `${code} ne doit pas être rejouable`);
  }
});

test('codes Twilio : un code inconnu reste nommé, pas muet', () => {
  const e = decrireErreurTwilio('99999');
  assert.equal(e.code, '99999');
  assert.ok(e.resume.length > 5, 'un code inconnu doit quand même être décrit');
  assert.ok(e.action.length > 20, 'un code inconnu doit quand même proposer une action');
});

test('codes Twilio : un code inconnu mais connu de nom reprend le motif du fournisseur', () => {
  const e = decrireErreurTwilio('21617', { messageFournisseur: 'Message body too long' });
  assert.match(e.cause, /Message body too long/);
});

test('codes Twilio : aucun message ne contient de Markdown', () => {
  /*
   * Ces textes finissent dans une colonne de base et dans une réponse JSON. Des
   * `**` y apparaîtraient tels quels, ce qui donne « Twilio refuse **avant** de
   * le facturer » à l'écran.
   */
  for (const code of [...CODES_TWILIO_GERES, '99999', '21617', null, undefined]) {
    const message = messageErreurTwilio(code, { messageFournisseur: 'motif brut' });
    assert.equal(message.includes('*'), false, `Markdown dans le message de ${code}`);
    assert.equal(message.includes('#'), false, `Markdown dans le message de ${code}`);
  }
});

test('codes Twilio : le message tient sur une seule ligne', () => {
  /*
   * Le champ est affiché dans une interface d'administration étroite : un saut de
   * ligne y casserait la mise en page.
   */
  for (const code of CODES_TWILIO_GERES) {
    const message = messageErreurTwilio(code);
    assert.equal(message.includes('\n'), false, `${code} contient un saut de ligne`);
    assert.match(message, /^\[\d+\] /, `${code} doit commencer par [code]`);
    assert.match(message, /Cause : /);
    assert.match(message, /Action : /);
  }
});

test('codes Twilio : le message commence toujours par le code', () => {
  assert.match(messageErreurTwilio('21211'), /^\[21211\] /);
  assert.match(messageErreurTwilio(21211), /^\[21211\] /, 'un code numérique doit être accepté');
});

test('codes Twilio : un code absent ou vide ne lève pas', () => {
  for (const valeur of [null, undefined, '', 0]) {
    const e = decrireErreurTwilio(valeur);
    assert.ok(e.resume, `aucun résumé pour ${String(valeur)}`);
    assert.equal(typeof e.rejouable, 'boolean');
  }
});
