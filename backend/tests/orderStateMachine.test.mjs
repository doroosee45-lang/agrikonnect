import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TRANSITIONS,
  HOLDS_STOCK,
  TERMINAL,
  canTransition,
  allowedTargets,
  partyOf,
  progressOf,
  isTerminal,
  isModeratorRole,
} from '../src/shared/orderStateMachine.js';

/**
 * Machine à états des commandes (CDС V2 §8.4).
 * Ces tests verrouillent les transitions autorisées : toute régression
 * ouvrant une transition non prévue fait échouer la suite.
 */

test('partyOf : identifie acheteur, vendeur et tiers', () => {
  const order = { buyerOrgId: 'org_buyer', sellerOrgId: 'org_seller' };
  assert.equal(partyOf(order, 'org_buyer'), 'buyer');
  assert.equal(partyOf(order, 'org_seller'), 'seller');
  assert.equal(partyOf(order, 'org_tiers'), null);
  assert.equal(partyOf(null, 'org_buyer'), null);
});

test('transition nominale : le vendeur accepte, l\'acheteur ne peut pas', () => {
  assert.equal(canTransition({ from: 'PENDING', to: 'ACCEPTED', role: 'seller' }).allowed, true);

  const buyerAttempt = canTransition({ from: 'PENDING', to: 'ACCEPTED', role: 'buyer' });
  assert.equal(buyerAttempt.allowed, false);
  assert.equal(buyerAttempt.code, 'FORBIDDEN_ROLE');
});

test('une transition inexistante est refusée avec la liste des possibles', () => {
  const decision = canTransition({ from: 'PENDING', to: 'COMPLETED', role: 'buyer' });
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, 'FORBIDDEN_TRANSITION');
  assert.deepEqual(decision.allowedTargets.sort(), ['CANCELLED']);
});

test('les états terminaux n\'autorisent plus aucune transition', () => {
  for (const status of TERMINAL) {
    assert.deepEqual(allowedTargets(status, 'buyer', false), []);
    assert.equal(isTerminal(status), true);
  }
});

test('le stock n\'est libéré que s\'il était réservé', () => {
  assert.equal(canTransition({ from: 'PENDING', to: 'CANCELLED', role: 'buyer' }).releasesStock, false);
  assert.equal(canTransition({ from: 'ACCEPTED', to: 'CANCELLED', role: 'buyer' }).releasesStock, true);
  assert.equal(canTransition({ from: 'READY', to: 'CANCELLED', role: 'seller' }).releasesStock, true);
  assert.equal(canTransition({ from: 'DISPUTED', to: 'CANCELLED', role: null, moderator: true }).releasesStock, true);
  assert.equal(canTransition({ from: 'ACCEPTED', to: 'PROCESSING', role: 'seller' }).releasesStock, false);
});

test('HOLDS_STOCK couvre tous les états post-acceptation', () => {
  for (const status of ['ACCEPTED', 'PROCESSING', 'READY', 'IN_TRANSIT', 'DELIVERED', 'DISPUTED']) {
    assert.equal(HOLDS_STOCK.has(status), true, status);
  }
  for (const status of ['PENDING', 'REJECTED', 'CANCELLED', 'COMPLETED']) {
    assert.equal(HOLDS_STOCK.has(status), false, status);
  }
});

test('le modérateur ne peut agir que sur les transitions qui lui sont ouvertes', () => {
  // Litige tranché : réservé au modérateur
  assert.equal(canTransition({ from: 'DISPUTED', to: 'COMPLETED', moderator: true }).allowed, true);
  assert.equal(canTransition({ from: 'DISPUTED', to: 'CANCELLED', moderator: true }).allowed, true);
  // Mais pas sur une transition vendeur
  assert.equal(canTransition({ from: 'PENDING', to: 'ACCEPTED', moderator: true }).allowed, false);
});

test('un statut inconnu est rejeté explicitement', () => {
  const decision = canTransition({ from: 'ARCHIVED', to: 'COMPLETED', role: 'buyer' });
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, 'UNKNOWN_STATUS');
});

test('le parcours heureux est entièrement couvert par TRANSITIONS', () => {
  const happy = ['PENDING', 'ACCEPTED', 'PROCESSING', 'READY', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'];
  const roles = ['seller', 'seller', 'seller', 'seller', 'buyer', 'buyer'];

  for (let i = 0; i < happy.length - 1; i += 1) {
    const decision = canTransition({ from: happy[i], to: happy[i + 1], role: roles[i] });
    assert.equal(decision.allowed, true, `${happy[i]} → ${happy[i + 1]}`);
  }
});

test('chaque état déclare des cibles cohérentes (pas de cible fantôme)', () => {
  for (const [from, targets] of Object.entries(TRANSITIONS)) {
    for (const to of Object.keys(targets)) {
      assert.ok(to in TRANSITIONS, `${from} → ${to} : état cible inconnu`);
      assert.ok(targets[to].length > 0, `${from} → ${to} : aucun rôle`);
    }
  }
});

test('progressOf : progression lisible pour l\'interface', () => {
  assert.equal(progressOf('PENDING').percent, Math.round((1 / 7) * 100));
  assert.equal(progressOf('COMPLETED').percent, 100);
  assert.equal(progressOf('CANCELLED').offTrack, true);
  assert.equal(progressOf('CANCELLED').current, -1);
});

test('isModeratorRole : modération et administration', () => {
  assert.equal(isModeratorRole(['MODERATOR']), true);
  assert.equal(isModeratorRole(['ADMIN']), true);
  assert.equal(isModeratorRole(['FARMER', 'BUYER']), false);
  assert.equal(isModeratorRole(undefined), false);
});
