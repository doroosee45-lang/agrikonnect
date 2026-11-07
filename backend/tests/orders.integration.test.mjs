import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';
import * as orders from '../src/modules/market/orders/orders.service.js';

/**
 * Tests d'intégration des services de commande, exécutés sur un Prisma simulé
 * en mémoire (aucun PostgreSQL requis).
 *
 * Ils verrouillent les invariants que le CDC V2 considère comme
 * non négociables : snapshot, machine à états, réservation atomique du stock
 * (pas de survente), restitution du stock à l'annulation, journal immuable.
 */

const BUYER = 'org_buyer';
const SELLER = 'org_seller';
const MODERATOR = 'org_support';

const reqAs = (organizationId, roles = [], userId = 'user_1') => ({
  tenant: { organizationId },
  user: { id: userId, roles },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
});

const baseListing = (overrides = {}) => ({
  id: 'lst_1',
  organizationId: SELLER,
  type: 'PRODUCE',
  cropId: 'crop_mais',
  title: 'Maïs jaune — récolte 2026',
  description: null,
  quantity: 100,
  unit: 'kg',
  quality: 'A',
  indicativePrice: 2.5,
  currency: 'USD',
  countryCode: 'CD',
  province: 'Kongo Central',
  latitude: -5.85,
  longitude: 13.05,
  certifications: [],
  conditions: null,
  status: 'PUBLISHED',
  expiresAt: null,
  createdBy: 'user_seller',
  createdAt: new Date('2026-09-01T08:00:00Z'),
  updatedAt: new Date('2026-09-01T08:00:00Z'),
  deletedAt: null,
  version: 1,
  ...overrides,
});

const setup = async (listings = [baseListing()]) => {
  const harness = await withFakePrisma(prisma, {
    listing: listings,
    order: [],
    orderEvent: [],
    conversation: [],
    message: [],
    notification: [],
    notificationPreference: [],
    auditLog: [],
    membership: [],
    dispute: [],
    media: [],
  });
  return harness;
};

test('ORD-01 : création — snapshot figé, numéro séquentiel, fil de discussion', async () => {
  const { restore } = await setup();
  try {
    const buyer = reqAs(BUYER);
    const order = await orders.create({ listingId: 'lst_1', quantity: 40 }, buyer);

    assert.match(order.number, /^CMD-\d{4}-00001$/);
    assert.equal(order.status, 'PENDING');
    assert.equal(order.totalAmount, 100); // 40 kg × 2,5
    assert.equal(order.snapshot.items[0].quantity, 40);
    assert.equal(order.snapshot.items[0].unitPrice, 2.5);
    assert.ok(order.snapshot.frozenAt, 'les conditions sont horodatées');
    assert.match(order.snapshot.paymentNotice, /hors plateforme/);
    assert.ok(order.conversationId, 'une conversation est ouverte entre les parties');

    // Deuxième commande : numérotation incrémentale
    const second = await orders.create({ listingId: 'lst_1', quantity: 10 }, buyer);
    assert.match(second.number, /^CMD-\d{4}-00002$/);
  } finally {
    restore();
  }
});

test('ORD-01 : le snapshot ne change pas si l\'annonce est modifiée ensuite', async () => {
  const { fake, restore } = await setup();
  try {
    const order = await orders.create({ listingId: 'lst_1', quantity: 10 }, reqAs(BUYER));

    // Le vendeur change son prix après la commande
    fake._store.listing[0].indicativePrice = 9.99;
    fake._store.listing[0].title = 'Nouveau titre';

    const reloaded = await orders.getOne(order.id, reqAs(BUYER));
    assert.equal(reloaded.order.snapshot.items[0].unitPrice, 2.5);
    assert.equal(reloaded.order.snapshot.items[0].title, 'Maïs jaune — récolte 2026');
    assert.equal(reloaded.order.totalAmount, 25);
  } finally {
    restore();
  }
});

test('ORD-03 : acceptation — stock réservé, statut RESERVED puis SOLD_OUT', async () => {
  const { fake, restore } = await setup();
  try {
    const order = await orders.create({ listingId: 'lst_1', quantity: 40 }, reqAs(BUYER));
    const result = await orders.transition(order.id, { status: 'ACCEPTED' }, reqAs(SELLER));

    assert.equal(result.order.status, 'ACCEPTED');
    assert.equal(result.previousStatus, 'PENDING');
    assert.equal(fake._store.listing[0].quantity, 60);
    assert.equal(fake._store.listing[0].status, 'RESERVED');

    // Une seconde commande qui épuise le stock passe l'annonce en SOLD_OUT
    const second = await orders.create({ listingId: 'lst_1', quantity: 60 }, reqAs(BUYER));
    await orders.transition(second.id, { status: 'ACCEPTED' }, reqAs(SELLER));
    assert.equal(fake._store.listing[0].quantity, 0);
    assert.equal(fake._store.listing[0].status, 'SOLD_OUT');
  } finally {
    restore();
  }
});

test('NFR-04 : la survente est impossible même avec deux commandes valides', async () => {
  const { fake, restore } = await setup();
  try {
    const first = await orders.create({ listingId: 'lst_1', quantity: 80 }, reqAs(BUYER));
    const second = await orders.create({ listingId: 'lst_1', quantity: 80 }, reqAs(BUYER));

    await orders.transition(first.id, { status: 'ACCEPTED' }, reqAs(SELLER));

    await assert.rejects(
      () => orders.transition(second.id, { status: 'ACCEPTED' }, reqAs(SELLER)),
      (error) => {
        assert.equal(error.status, 409);
        assert.match(error.message, /Stock insuffisant/);
        return true;
      },
    );

    // Le stock restant n'a pas été touché par la tentative
    assert.equal(fake._store.listing[0].quantity, 20);
  } finally {
    restore();
  }
});

test('ORD-03 : annulation après acceptation — le stock est restitué', async () => {
  const { fake, restore } = await setup();
  try {
    const order = await orders.create({ listingId: 'lst_1', quantity: 30 }, reqAs(BUYER));
    await orders.transition(order.id, { status: 'ACCEPTED' }, reqAs(SELLER));
    assert.equal(fake._store.listing[0].quantity, 70);

    const cancelled = await orders.transition(order.id, { status: 'CANCELLED', reason: 'Prix trop élevé' }, reqAs(BUYER));
    assert.equal(cancelled.order.status, 'CANCELLED');
    assert.equal(fake._store.listing[0].quantity, 100);
    assert.equal(fake._store.listing[0].status, 'PUBLISHED');
  } finally {
    restore();
  }
});

test('ORD-03 : rôles — l\'acheteur ne peut pas accepter, le vendeur ne peut pas annuler seul après expédition', async () => {
  const { restore } = await setup();
  try {
    const order = await orders.create({ listingId: 'lst_1', quantity: 10 }, reqAs(BUYER));

    await assert.rejects(
      () => orders.transition(order.id, { status: 'ACCEPTED' }, reqAs(BUYER)),
      (error) => error.status === 403,
    );

    await orders.transition(order.id, { status: 'ACCEPTED' }, reqAs(SELLER));
    await orders.transition(order.id, { status: 'PROCESSING' }, reqAs(SELLER));
    await orders.transition(order.id, { status: 'READY' }, reqAs(SELLER));
    await orders.transition(order.id, { status: 'IN_TRANSIT' }, reqAs(SELLER));

    // Une fois expédiée, la commande ne peut plus être annulée
    await assert.rejects(
      () => orders.transition(order.id, { status: 'CANCELLED' }, reqAs(SELLER)),
      (error) => error.status === 409 && /Transition interdite/.test(error.message),
    );
  } finally {
    restore();
  }
});

test('ORD-03 : un tiers ne voit ni ne modifie la commande (404, jamais 403)', async () => {
  const { restore } = await setup();
  try {
    const order = await orders.create({ listingId: 'lst_1', quantity: 10 }, reqAs(BUYER));

    await assert.rejects(
      () => orders.getOne(order.id, reqAs('org_intrus')),
      (error) => error.status === 404,
    );
    await assert.rejects(
      () => orders.transition(order.id, { status: 'ACCEPTED' }, reqAs('org_intrus')),
      (error) => error.status === 404,
    );
  } finally {
    restore();
  }
});

test('DISP-01 (ORD-05) : litige tranché en faveur du vendeur → commande annulée, stock rendu', async () => {
  const { fake, restore } = await setup();
  try {
    const order = await orders.create({ listingId: 'lst_1', quantity: 50 }, reqAs(BUYER));
    await orders.transition(order.id, { status: 'ACCEPTED' }, reqAs(SELLER));
    assert.equal(fake._store.listing[0].quantity, 50);

    const dispute = await orders.openDispute(order.id, { reason: 'Qualité non conforme à l\'annonce' }, reqAs(BUYER));
    const disputed = await orders.getOne(order.id, reqAs(BUYER));
    assert.equal(disputed.order.status, 'DISPUTED');

    const resolved = await orders.resolveDispute(
      dispute.id,
      { status: 'RESOLVED_SELLER', decision: 'Marchandise conforme après expertise' },
      reqAs(MODERATOR, ['MODERATOR']),
    );

    assert.equal(resolved.orderStatus, 'CANCELLED');
    assert.equal(fake._store.listing[0].quantity, 100, 'le stock réservé est restitué');
  } finally {
    restore();
  }
});

test('journal : chaque transition laisse une trace immuable et ordonnée', async () => {
  const { fake, restore } = await setup();
  try {
    const order = await orders.create({ listingId: 'lst_1', quantity: 20 }, reqAs(BUYER));
    await orders.transition(order.id, { status: 'ACCEPTED' }, reqAs(SELLER));
    await orders.transition(order.id, { status: 'PROCESSING' }, reqAs(SELLER));

    const events = fake._store.orderEvent.filter((e) => e.orderId === order.id);
    assert.equal(events.length, 3);
    assert.deepEqual(
      events.map((e) => [e.from, e.to]),
      [[null, 'PENDING'], ['PENDING', 'ACCEPTED'], ['ACCEPTED', 'PROCESSING']],
    );
  } finally {
    restore();
  }
});

test('ORD-04 : seul l\'acheteur déclare le paiement, et rien n\'est encaissé', async () => {
  const { restore } = await setup();
  try {
    const order = await orders.create({ listingId: 'lst_1', quantity: 5 }, reqAs(BUYER));

    await assert.rejects(
      () => orders.declarePayment(order.id, { paymentStatus: 'DECLARED_PAID' }, reqAs(SELLER)),
      (error) => error.status === 403,
    );

    const result = await orders.declarePayment(order.id, { paymentStatus: 'DECLARED_PAID' }, reqAs(BUYER));
    assert.equal(result.order.paymentStatus, 'DECLARED_PAID');
    assert.match(result.disclaimer, /n'opère aucun paiement/);
  } finally {
    restore();
  }
});

test('ORD-01 : commander sa propre annonce est refusé', async () => {
  const { restore } = await setup();
  try {
    await assert.rejects(
      () => orders.create({ listingId: 'lst_1', quantity: 5 }, reqAs(SELLER)),
      (error) => error.status === 422 && /propre annonce/.test(error.message),
    );
  } finally {
    restore();
  }
});
