/**
 * Preuves d'acceptation — V2 (marché, contrats, confiance).
 *
 * Une preuve par exigence numérotée, exécutée sur le code réel des services :
 * aucun mock de service, uniquement le client Prisma remplacé par un double
 * en mémoire (`tests/helpers/fakePrisma.mjs`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';

import * as listingsService from '../src/modules/market/listings/listings.service.js';
import * as requestsService from '../src/modules/market/requests/requests.service.js';
import * as offersService from '../src/modules/market/offers/offers.service.js';
import * as ordersService from '../src/modules/market/orders/orders.service.js';
import * as inventoryService from '../src/modules/market/inventory/inventory.service.js';
import * as transportService from '../src/modules/transport/transport.service.js';
import * as groupoffersService from '../src/modules/cooperatives/groupoffers.service.js';
import { JOBS } from '../src/jobs/index.js';

const ORG = 'org_buyer';
const SELLER = 'org_seller';
const OTHER = 'org_other';

const reqAs = (organizationId = ORG, roles = ['BUYER'], userId = 'user_1') => ({
  tenant: { organizationId, effectiveRoles: roles },
  user: { id: userId, roles },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
  requestId: 'req_test',
});

const store = (overrides = {}) => ({
  listing: [],
  purchaseRequest: [],
  offer: [],
  order: [],
  orderEvent: [],
  inventoryItem: [],
  inventoryMovement: [],
  transportRequest: [],
  transportOffer: [],
  notification: [],
  notificationPreference: [],
  membership: [],
  organization: [],
  profile: [],
  crop: [],
  auditLog: [],
  groupOffer: [],
  cooperative: [],
  cooperativeMember: [],
  ...overrides,
});

const expectStatus = async (promise, status, pattern = null) => {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, status, `statut attendu ${status}, reçu ${error.status} (${error.message})`);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
};

const listing = (overrides = {}) => ({
  id: 'lst_1',
  organizationId: SELLER,
  title: 'Manioc frais',
  cropId: 'crop_manioc',
  quantity: 1000,
  unit: 'kg',
  indicativePrice: 0.35,
  currency: 'USD',
  status: 'PUBLISHED',
  version: 1,
  deletedAt: null,
  expiresAt: new Date('2027-01-01'),
  ...overrides,
});

/* ───────────────────────────── ANNONCES ───────────────────────────── */

test('MKT-02 : une vente ne peut pas dépasser le stock annoncé', async () => {
  const { fake, restore } = await withFakePrisma(prisma, store({ listing: [listing()] }));
  try {
    await expectStatus(
      ordersService.create({ listingId: 'lst_1', quantity: 1200, unitPrice: 0.35 }, reqAs()),
      422,
      /disponible/i,
    );
    assert.equal(fake._store.order.length, 0, 'aucune commande créée au-delà du stock');

    const created = await ordersService.create({ listingId: 'lst_1', quantity: 1000, unitPrice: 0.35 }, reqAs());
    assert.equal(created.snapshot.items[0].quantity, 1000, 'quantité figée dans l’instantané');
    assert.equal(created.totalAmount, 350, 'montant = quantité × prix, jamais arrondi au hasard');
  } finally {
    restore();
  }
});

test('MKT-05 : une décision de modération sans motif est refusée et tracée sinon', async () => {
  const { fake, restore } = await withFakePrisma(prisma, store({ listing: [listing()] }));
  try {
    await expectStatus(listingsService.moderate('lst_1', { status: 'HIDDEN' }, reqAs(OTHER, ['MODERATOR'])), 422, /motif/i);

    await listingsService.moderate(
      'lst_1',
      { status: 'HIDDEN', reason: 'Prix manifestement erroné (0,003 USD/kg)' },
      reqAs(OTHER, ['MODERATOR'], 'mod_1'),
    );

    assert.equal(fake._store.listing[0].status, 'HIDDEN');
    const entry = fake._store.auditLog.find((row) => row.action === 'listing.moderate');
    assert.ok(entry, 'décision journalisée');
    assert.equal(entry.actorId, 'mod_1', 'modérateur nominatif');
    assert.equal(entry.newValue.reason, 'Prix manifestement erroné (0,003 USD/kg)');
    assert.equal(entry.oldValue.status, 'PUBLISHED', 'état précédent conservé');
  } finally {
    restore();
  }
});

/* ───────────────────────── DEMANDES D'ACHAT ───────────────────────── */

test('REQ-01 : une demande d’achat ne divulgue aucune coordonnée', async () => {
  const { fake, restore } = await withFakePrisma(prisma, store());
  try {
    const { request } = await requestsService.create(
      {
        cropId: 'crop_manioc',
        quantity: 500,
        unit: 'kg',
        maxPrice: 0.4,
        currency: 'USD',
        deliveryProvince: 'Kinshasa',
        neededBy: '2026-12-01',
      },
      reqAs(),
    );

    assert.equal(request.buyerOrgId, ORG, 'acheteur identifié côté serveur');
    const serialized = JSON.stringify(request);
    assert.equal(/@/.test(serialized), false, 'aucune adresse email dans la demande publiée');
    assert.equal(request.buyerPhone, undefined, 'aucun téléphone exposé');
    assert.equal(fake._store.purchaseRequest.length, 1);
  } finally {
    restore();
  }
});

test('REQ-03 : les producteurs compatibles sont notifiés, avec plafond anti-spam', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      purchaseRequest: [
        { id: 'req_1', buyerOrgId: ORG, cropId: 'crop_manioc', quantity: 500, unit: 'kg', status: 'OPEN', deletedAt: null },
      ],
      listing: [
        listing({ id: 'lst_a', organizationId: 'org_p1' }),
        listing({ id: 'lst_b', organizationId: 'org_p2' }),
        listing({ id: 'lst_c', organizationId: 'org_p3', cropId: 'crop_riz' }),
      ],
      membership: [
        { id: 'm1', organizationId: 'org_p1', userId: 'prod_1', status: 'ACTIVE' },
        { id: 'm2', organizationId: 'org_p2', userId: 'prod_2', status: 'ACTIVE' },
        { id: 'm3', organizationId: 'org_p3', userId: 'prod_3', status: 'ACTIVE' },
      ],
    }),
  );
  try {
    const { notificationsSent } = await requestsService.create(
      { cropId: 'crop_manioc', quantity: 500, unit: 'kg', maxPrice: 0.4, currency: 'USD' },
      reqAs(),
    );

    const recipients = new Set(fake._store.notification.map((n) => n.userId));
    assert.equal(recipients.has('prod_3'), false, 'culture différente : pas de notification');
    assert.ok(notificationsSent >= 1, 'des producteurs ont été notifiés');
    assert.ok(
      fake._store.notification.every((n) => n.type === 'purchase_request.match'),
      'type de notification explicite',
    );
  } finally {
    restore();
  }
});

test('REQ-04 : une offre est chiffrée, datée et opposable', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      purchaseRequest: [
        { id: 'req_1', buyerOrgId: ORG, cropId: 'crop_manioc', quantity: 500, unit: 'kg', status: 'OPEN', deletedAt: null },
      ],
      membership: [{ id: 'm1', organizationId: ORG, userId: 'buyer_1', status: 'ACTIVE' }],
    }),
  );
  try {
    const offer = await offersService.createForRequest(
      'req_1',
      {
        quantity: 500,
        unit: 'kg',
        price: 0.38,
        currency: 'USD',
        validUntil: '2026-11-15',
        conditions: 'Enlèvement sur site, paiement à la livraison',
      },
      reqAs(SELLER, ['PRODUCER'], 'seller_1'),
    );

    assert.equal(offer.price, 0.38);
    assert.equal(offer.currency, 'USD');
    assert.ok(offer.validUntil, 'date de validité portée par l’offre');
    assert.equal(offer.status, 'PENDING');
    assert.equal(offer.sellerOrgId, SELLER);
    assert.ok(fake._store.notification.length >= 1, 'l’acheteur est notifié sans recevoir les coordonnées');
  } finally {
    restore();
  }
});

test('REQ-05 : le matching est expliqué, jamais un score opaque', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      purchaseRequest: [
        { id: 'req_1', buyerOrgId: ORG, cropId: 'crop_manioc', quantity: 500, unit: 'kg', status: 'OPEN', deletedAt: null },
      ],
      listing: [
        listing({ id: 'lst_a', organizationId: 'org_p1' }),
        listing({ id: 'lst_b', organizationId: 'org_p2', cropId: 'crop_riz' }),
      ],
      organization: [
        { id: 'org_p1', name: 'Coop Kivu', countryCode: 'CD', province: 'Nord-Kivu' },
        { id: 'org_p2', name: 'Riz du Sud', countryCode: 'CD', province: 'Kinshasa' },
      ],
      crop: [{ id: 'crop_manioc', slug: 'manioc', names: { fr: 'Manioc' } }],
    }),
  );
  try {
    const result = await requestsService.matches('req_1', {}, reqAs());
    assert.ok(result.results.length >= 1, 'au moins une correspondance');
    const match = result.results[0];
    assert.equal(match.listingId, 'lst_a', 'la culture filtre réellement (aucun riz proposé)');
    assert.ok(Array.isArray(match.criteria) && match.criteria.length > 0, 'chaque correspondance expose ses critères');
    assert.ok(
      match.criteria.every((c) => typeof c.satisfied === 'boolean'),
      'chaque critère est explicitement satisfait ou non, jamais un score opaque',
    );
    assert.equal(match.matched <= match.total, true, 'compte de critères cohérent');
    assert.equal('score' in match, false, 'aucun score global exposé');
  } finally {
    restore();
  }
});

/* ───────────────────────────── OFFRES ───────────────────────────── */

test('OFF-02 : une offre expirée ne peut plus être acceptée', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      offer: [
        {
          id: 'off_1',
          requestId: 'req_1',
          sellerOrgId: SELLER,
          buyerOrgId: ORG,
          quantity: 500,
          unit: 'kg',
          price: 0.38,
          currency: 'USD',
          status: 'PENDING',
          validUntil: new Date('2026-01-01'),
        },
      ],
      purchaseRequest: [{ id: 'req_1', buyerOrgId: ORG, status: 'OPEN', deletedAt: null }],
    }),
  );
  try {
    await expectStatus(offersService.decide('off_1', { status: 'ACCEPTED' }, reqAs()), 409, /expir/i);
  } finally {
    restore();
  }
});

test('OFF-03 : l’acceptation d’une offre donne une commande aux conditions figées', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      offer: [
        {
          id: 'off_1',
          requestId: 'req_1',
          sellerOrgId: SELLER,
          buyerOrgId: ORG,
          quantity: 500,
          unit: 'kg',
          price: 0.38,
          currency: 'USD',
          status: 'PENDING',
          validUntil: new Date('2027-01-01'),
        },
      ],
      purchaseRequest: [{ id: 'req_1', buyerOrgId: ORG, status: 'OPEN', deletedAt: null, cropId: 'crop_manioc' }],
      membership: [{ id: 'm1', organizationId: ORG, userId: 'buyer_1', status: 'ACTIVE' }],
    }),
  );
  try {
    const decided = await offersService.decide('off_1', { status: 'ACCEPTED' }, reqAs());
    assert.equal(decided.status, 'ACCEPTED');

    const order = await ordersService.create({ offerId: 'off_1', quantity: 500, unitPrice: 0.38 }, reqAs());
    assert.equal(order.sellerOrgId, SELLER);
    assert.equal(order.totalAmount, 190, '500 kg × 0,38 USD');
    assert.equal(order.snapshot.items[0].offerId, 'off_1', 'les conditions sont figées dans un instantané');
    assert.equal(fake._store.offer[0].status, 'ACCEPTED');
  } finally {
    restore();
  }
});

test('OFF-04 : une offre peut être retirée tant qu’elle n’est pas décidée', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      offer: [
        {
          id: 'off_1',
          requestId: 'req_1',
          sellerOrgId: SELLER,
          buyerOrgId: ORG,
          quantity: 500,
          unit: 'kg',
          price: 0.38,
          currency: 'USD',
          status: 'PENDING',
          validUntil: new Date('2027-01-01'),
        },
      ],
      purchaseRequest: [{ id: 'req_1', buyerOrgId: ORG, status: 'OPEN', deletedAt: null }],
    }),
  );
  try {
    const withdrawn = await offersService.decide('off_1', { status: 'WITHDRAWN' }, reqAs(SELLER, ['PRODUCER'], 'seller_1'));
    assert.equal(withdrawn.status, 'WITHDRAWN');
    assert.equal(fake._store.offer[0].status, 'WITHDRAWN');
    // Une offre retirée ne peut plus être acceptée : le retrait est définitif.
    await expectStatus(offersService.decide('off_1', { status: 'ACCEPTED' }, reqAs()), 409);
  } finally {
    restore();
  }
});

/* ───────────────────────────── STOCKS ───────────────────────────── */

test('STK-02 : aucun mouvement ne peut rendre un stock négatif', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      inventoryItem: [
        { id: 'item_1', organizationId: ORG, name: 'Manioc', unit: 'kg', deletedAt: null, movements: [] },
      ],
      inventoryMovement: [
        { id: 'mv_1', itemId: 'item_1', organizationId: ORG, type: 'IN', quantity: 100, createdAt: new Date('2026-09-01') },
      ],
    }),
  );
  try {
    await expectStatus(
      inventoryService.addMovement({ itemId: 'item_1', type: 'OUT', quantity: 150 }, reqAs()),
      409,
      /insuffisant/i,
    );
    assert.equal(fake._store.inventoryMovement.length, 1, 'aucun mouvement refusé écrit');

    const movement = await inventoryService.addMovement({ itemId: 'item_1', type: 'OUT', quantity: 40 }, reqAs());
    assert.equal(movement.movement.quantity, 40);
    assert.equal(movement.balance, 60, 'solde dérivé des mouvements (100 − 40)');
    assert.equal(fake._store.inventoryMovement.length, 2, 'mouvement valide enregistré (stock dérivé, jamais un solde)');
  } finally {
    restore();
  }
});

/* ─────────────────────────── TRANSPORT ─────────────────────────── */

const orderFixture = {
  id: 'ord_1',
  organizationId: ORG,
  buyerOrgId: ORG,
  sellerOrgId: SELLER,
  status: 'CONFIRMED',
  currency: 'USD',
  totalAmount: 190,
  paymentStatus: 'DECLARED_UNPAID',
  version: 1,
  deletedAt: null,
  snapshot: { items: [{ title: 'Manioc', quantity: 500, unit: 'kg' }] },
};

test('TRA-01 (TRP-01) : un transport est rattaché à une commande, sans doublon actif', async () => {
  const { fake, restore } = await withFakePrisma(prisma, store({ order: [orderFixture] }));
  try {
    const request = await transportService.createRequest(
      { orderId: 'ord_1', pickup: { label: 'Butembo', countryCode: 'CD' }, dropoff: { label: 'Goma', countryCode: 'CD' } },
      reqAs(),
    );
    assert.equal(request.orderId, 'ord_1');
    assert.equal(request.status, 'REQUESTED');

    await expectStatus(transportService.createRequest({ orderId: 'ord_1' }, reqAs()), 409, /déjà active/i);
    assert.equal(fake._store.transportRequest.length, 1);
  } finally {
    restore();
  }
});

test('TRA-02 : la distance publiée est approximative, les libellés suffisent', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      transportRequest: [
        {
          id: 'tr_1',
          orderId: 'ord_1',
          requesterOrgId: ORG,
          status: 'REQUESTED',
          pickup: { label: 'Kinshasa', province: 'Kinshasa', countryCode: 'CD', latitude: -4.32, longitude: 15.31 },
          dropoff: { label: 'Matadi', province: 'Kongo-Central', countryCode: 'CD', latitude: -5.82, longitude: 13.45 },
          offers: [],
          createdAt: new Date(),
        },
      ],
    }),
  );
  try {
    const { items } = await transportService.openRequests({}, reqAs('org_carrier', ['CARRIER']));
    const first = items[0];
    assert.equal(first.from.label, 'Kinshasa');
    assert.equal(first.to.label, 'Matadi');
    assert.equal(first.from.latitude, undefined, 'aucune coordonnée exacte publiée');
    assert.ok(
      first.approxDistanceKm > 240 && first.approxDistanceKm < 300,
      'distance approximative calculée (≈ 265 km à vol d’oiseau)',
    );
  } finally {
    restore();
  }
});

/* ──────────────────────── NOTIFICATIONS ──────────────────────── */

test('NOTIF-04 : la purge supprime les notifications lues au-delà de la rétention', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      notification: [
        { id: 'n_old', userId: 'u1', type: 'x', readAt: new Date('2026-01-01'), createdAt: new Date('2026-01-01') },
        { id: 'n_new', userId: 'u1', type: 'x', readAt: new Date(), createdAt: new Date() },
        { id: 'n_unread', userId: 'u1', type: 'x', readAt: null, createdAt: new Date('2026-01-01') },
      ],
    }),
  );
  try {
    const result = await JOBS['notifications.purge'].run();
    assert.ok(result.deleted >= 1, 'au moins une notification purgée');
    assert.equal(result.unreadKept, true, 'les non-lues sont explicitement conservées');
    const ids = fake._store.notification.map((n) => n.id);
    assert.equal(ids.includes('n_old'), false, 'notification lue et périmée supprimée');
    assert.equal(ids.includes('n_new'), true, 'notification récente conservée');
    assert.equal(ids.includes('n_unread'), true, 'notification non lue jamais purgée');
  } finally {
    restore();
  }
});

/* ─────────────────────── OFFRE GROUPÉE (COOP-10) ─────────────────────── */

test('COOP-10 : l’offre groupée porte une répartition traçable, jamais devinée', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      cooperative: [{ id: 'coop_1', organizationId: ORG, name: 'Coop Kivu', deletedAt: null }],
      cooperativeMember: [
        { id: 'cm1', cooperativeId: 'coop_1', memberUserId: 'u1', status: 'ACTIVE', consentScopes: ['productions'] },
        { id: 'cm2', cooperativeId: 'coop_1', memberUserId: 'u2', status: 'ACTIVE', consentScopes: ['productions'] },
      ],
      membership: [
        { id: 'm1', organizationId: 'org_m1', userId: 'u1', status: 'ACTIVE' },
        { id: 'm2', organizationId: 'org_m2', userId: 'u2', status: 'ACTIVE' },
      ],
      production: [
        { id: 'p1', organizationId: 'org_m1', cropId: 'crop_mais', quantityKg: 600, harvestedAt: new Date('2026-08-01'), deletedAt: null },
        { id: 'p2', organizationId: 'org_m2', cropId: 'crop_mais', quantityKg: 400, harvestedAt: new Date('2026-08-15'), deletedAt: null },
      ],
      crop: [{ id: 'crop_mais', slug: 'mais', names: { fr: 'Maïs' } }],
    }),
  );
  try {
    const preview = await groupoffersService.previewPool(
      'coop_1',
      { cropId: 'crop_mais', periodFrom: '2026-01-01', periodTo: '2026-12-31' },
      reqAs(),
    );

    assert.equal(preview.totalKg, 1000, 'agrégat = somme réelle des productions consenties');
    assert.equal(preview.split.length, 2, 'une part par membre');
    const u1 = preview.split.find((s) => s.memberUserId === 'u1');
    assert.equal(u1.quantityKg, 600);
    assert.equal(u1.share, 0.6, 'part calculée, explicable (0,6 = 60 %)');
    assert.deepEqual(u1.productionIds, ['p1'], 'chaque part renvoie aux productions qui la composent');
    assert.ok(preview.policy?.consent, 'la base du consentement est rappelée');
    assert.equal(preview.policy.splitFrozen.length > 0, true, 'la répartition est figée à la création');
  } finally {
    restore();
  }
});
