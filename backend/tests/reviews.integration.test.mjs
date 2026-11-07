import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';
import * as reviews from '../src/modules/market/reviews/reviews.service.js';

/**
 * REV-01 → REV-03 / MOD-02 — Avis, réputation et modération.
 *
 * Un avis est une preuve d'exécution commerciale : il n'existe qu'après une
 * commande livrée, une seule fois par partie, et sa modération masque sans
 * jamais détruire la trace.
 */

const BUYER = 'org_buyer';
const SELLER = 'org_seller';

const reqAs = (organizationId, roles = [], userId = 'user_1') => ({
  tenant: { organizationId, effectiveRoles: roles },
  user: { id: userId, roles },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
});

const order = (status, overrides = {}) => ({
  id: 'ord_1',
  number: 'CMD-2026-00001',
  buyerOrgId: BUYER,
  sellerOrgId: SELLER,
  status,
  deletedAt: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  ...overrides,
});

const setup = async (overrides = {}) =>
  withFakePrisma(prisma, {
    order: [],
    review: [],
    auditLog: [],
    notification: [],
    notificationPreference: [],
    membership: [],
    ...overrides,
  });

test('REV-01 : aucun avis avant livraison', async () => {
  const { restore } = await setup({ order: [order('IN_TRANSIT')] });
  try {
    await assert.rejects(
      () => reviews.createForOrder('ord_1', { rating: 5, comment: 'Très bien' }, reqAs(BUYER)),
      (error) => error.status === 409 && /après livraison/.test(error.message),
    );
  } finally {
    restore();
  }
});

test('REV-02 : un seul avis par partie et par commande', async () => {
  const { fake, restore } = await setup({ order: [order('DELIVERED')] });
  try {
    const first = await reviews.createForOrder('ord_1', { rating: 5, comment: 'Conforme' }, reqAs(BUYER));
    assert.equal(first.rating, 5);
    assert.equal(first.targetOrgId, SELLER, 'l’avis cible le vendeur');

    await assert.rejects(
      () => reviews.createForOrder('ord_1', { rating: 3, comment: 'Encore' }, reqAs(BUYER)),
      (error) => error.status === 409,
    );

    // Le vendeur peut évaluer l'acheteur : deux avis au total, pas un de plus
    await reviews.createForOrder('ord_1', { rating: 4 }, reqAs(SELLER, ['FARMER'], 'user_seller'));
    assert.equal(fake._store.review.length, 2);
  } finally {
    restore();
  }
});

test('REV-02 : un tiers ne peut pas noter la commande', async () => {
  const { restore } = await setup({ order: [order('COMPLETED')] });
  try {
    await assert.rejects(
      () => reviews.createForOrder('ord_1', { rating: 1 }, reqAs('org_intrus')),
      (error) => error.status === 404,
    );
  } finally {
    restore();
  }
});

test('REV-03 : la réputation renvoie une moyenne ET un volume, jamais une note seule', async () => {
  const { restore } = await setup({
    review: [
      { id: 'rev_1', orderId: 'ord_1', authorOrgId: BUYER, targetOrgId: SELLER, rating: 5, status: 'PUBLISHED' },
      { id: 'rev_2', orderId: 'ord_2', authorOrgId: 'org_3', targetOrgId: SELLER, rating: 4, status: 'PUBLISHED' },
      { id: 'rev_3', orderId: 'ord_3', authorOrgId: 'org_4', targetOrgId: SELLER, rating: 1, status: 'HIDDEN' },
    ],
  });
  try {
    const reputation = await reviews.reputation(SELLER);
    assert.equal(reputation.average, 4.5);
    assert.equal(reputation.count, 2, 'un avis masqué ne compte pas');
    assert.deepEqual(reputation.distribution, { 5: 1, 4: 1 });
  } finally {
    restore();
  }
});

test('REV-03 : sans avis, la réponse est explicite (pas de note inventée)', async () => {
  const { restore } = await setup();
  try {
    const reputation = await reviews.reputation(SELLER);
    assert.equal(reputation.average, null);
    assert.equal(reputation.count, 0);
    assert.match(reputation.note, /Aucun avis/);
  } finally {
    restore();
  }
});

test('MOD-02 : la modération masque un avis sans le supprimer', async () => {
  const { fake, restore } = await setup({
    review: [
      { id: 'rev_1', orderId: 'ord_1', authorOrgId: BUYER, targetOrgId: SELLER, rating: 1, status: 'FLAGGED' },
    ],
  });
  try {
    const result = await reviews.moderate(
      'rev_1',
      { decision: 'REMOVE', reason: 'Propos injurieux' },
      reqAs('org_support', ['MODERATOR'], 'user_mod'),
    );

    assert.equal(result.review.status, 'HIDDEN');
    assert.match(result.retention, /conservé/i);
    assert.equal(fake._store.review.length, 1, 'l’avis existe toujours en base');
  } finally {
    restore();
  }
});

test('MOD-02 : une décision KEEP remet l’avis en ligne', async () => {
  const { restore } = await setup({
    review: [
      { id: 'rev_1', orderId: 'ord_1', authorOrgId: BUYER, targetOrgId: SELLER, rating: 2, status: 'HIDDEN' },
    ],
  });
  try {
    const result = await reviews.moderate(
      'rev_1',
      { decision: 'KEEP', reason: 'Avis fondé, vérifié' },
      reqAs('org_support', ['MODERATOR'], 'user_mod'),
    );
    assert.equal(result.review.status, 'PUBLISHED');
  } finally {
    restore();
  }
});
