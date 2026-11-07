import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';
import * as listings from '../src/modules/market/listings/listings.service.js';

/**
 * Annonces marketplace (MKT-01 → MKT-06) sur Prisma simulé.
 *
 * Invariants vérifiés :
 *  - une publication sans photo est **acceptée** mais signalée (avertissement) ;
 *  - une publication sans quantité est refusée ;
 *  - un locataire ne peut pas modifier l'annonce d'un autre ;
 *  - les transitions de statut sont contrôlées par la machine à états ;
 *  - l'expiration est automatique à la lecture.
 */

const SELLER = 'org_seller';
const OTHER = 'org_other';

const reqAs = (organizationId, userId = 'user_1') => ({
  tenant: { organizationId },
  user: { id: userId, roles: ['FARMER'] },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
});

const listingRow = (overrides = {}) => ({
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
  status: 'DRAFT',
  expiresAt: null,
  createdBy: 'user_seller',
  createdAt: new Date('2026-10-01T08:00:00Z'),
  updatedAt: new Date('2026-10-01T08:00:00Z'),
  deletedAt: null,
  version: 1,
  ...overrides,
});

const setup = async (rows = [listingRow()]) =>
  withFakePrisma(prisma, {
    listing: rows,
    media: [],
    crop: [{ id: 'crop_mais', slug: 'mais', names: { fr: 'Maïs' } }],
    auditLog: [],
    organization: [],
    conversation: [],
    message: [],
    notification: [],
    notificationPreference: [],
    membership: [],
  });

test('MKT-01 : publication sans photo → succès + avertissement non bloquant', async () => {
  const { restore } = await setup();
  try {
    const result = await listings.changeStatus('lst_1', 'PUBLISHED', reqAs(SELLER));
    assert.equal(result.listing.status, 'PUBLISHED');
    assert.equal(result.warnings.length, 1);
    assert.equal(result.warnings[0].field, 'photos');
    assert.equal(result.warnings[0].code, 'recommended');
  } finally {
    restore();
  }
});

test('MKT-01 : publication avec photos → aucun avertissement', async () => {
  const { fake, restore } = await setup();
  try {
    fake._store.media.push({
      id: 'med_1',
      listingId: 'lst_1',
      url: 'https://cdn.example/photo.jpg',
      storageKey: 'org/photo.jpg',
      position: 0,
      deletedAt: null,
    });

    const result = await listings.changeStatus('lst_1', 'PUBLISHED', reqAs(SELLER));
    assert.equal(result.listing.status, 'PUBLISHED');
    assert.equal(result.warnings.length, 0);
  } finally {
    restore();
  }
});

test('MKT-01 : une annonce sans quantité ne peut pas être publiée', async () => {
  const { restore } = await setup([listingRow({ quantity: 0 })]);
  try {
    await assert.rejects(
      () => listings.changeStatus('lst_1', 'PUBLISHED', reqAs(SELLER)),
      (error) => error.status === 422 && /quantité/i.test(error.message),
    );
  } finally {
    restore();
  }
});

test('MOD-01 : la modération masque une annonce avec un motif tracé', async () => {
  const { fake, restore } = await setup([listingRow({ status: 'PUBLISHED' })]);
  try {
    const updated = await listings.moderate(
      'lst_1',
      { status: 'HIDDEN', reason: 'Prix manifestement trompeur' },
      reqAs('org_support', 'user_mod'),
    );

    assert.equal(updated.status, 'HIDDEN');
    const entry = fake._store.auditLog.find((log) => log.action === 'listing.moderate');
    assert.ok(entry, 'la décision est journalisée');
    assert.equal(entry.oldValue.status, 'PUBLISHED');
    assert.equal(entry.newValue.reason, 'Prix manifestement trompeur');
  } finally {
    restore();
  }
});

test('MOD-01 : une décision de modération hors états autorisés est refusée', async () => {
  const { restore } = await setup([listingRow({ status: 'PUBLISHED' })]);
  try {
    await assert.rejects(
      () => listings.moderate('lst_1', { status: 'SOLD_OUT', reason: 'Incohérent' }, reqAs('org_support')),
      (error) => error.status === 422,
    );
  } finally {
    restore();
  }
});

test('MKT-04 : les transitions de statut non prévues sont refusées', async () => {
  const { restore } = await setup([listingRow({ status: 'DRAFT' })]);
  try {
    await assert.rejects(
      () => listings.changeStatus('lst_1', 'SOLD_OUT', reqAs(SELLER)),
      (error) => error.status === 409 && /Transition interdite/.test(error.message),
    );
  } finally {
    restore();
  }
});

test('SEC-05 : un locataire ne peut pas modifier l\'annonce d\'un autre (404)', async () => {
  const { restore } = await setup();
  try {
    await assert.rejects(
      () => listings.changeStatus('lst_1', 'PUBLISHED', reqAs(OTHER)),
      (error) => error.status === 404,
    );
    await assert.rejects(
      () => listings.update('lst_1', { title: 'Piratée' }, reqAs(OTHER)),
      (error) => error.status === 404,
    );
  } finally {
    restore();
  }
});

test('MKT-04 : l\'expiration est appliquée avant toute lecture publique', async () => {
  const { fake, restore } = await setup([
    listingRow({
      status: 'PUBLISHED',
      expiresAt: new Date(Date.now() - 86_400_000),
    }),
  ]);
  try {
    const result = await listings.search(
      { page: 1, limit: 20, sort: 'createdAt', order: 'desc' },
      reqAs(OTHER),
    );
    assert.equal(result.total, 0, 'l\'annonce expirée sort des résultats');
    assert.equal(fake._store.listing[0].status, 'EXPIRED');
  } finally {
    restore();
  }
});

test('MKT-03 : recherche publique — seules les annonces publiées remontent', async () => {
  const { restore } = await setup([
    listingRow({ id: 'lst_1', status: 'PUBLISHED' }),
    listingRow({ id: 'lst_2', status: 'DRAFT', title: 'Brouillon' }),
    listingRow({ id: 'lst_3', status: 'PUBLISHED', organizationId: OTHER, countryCode: 'CI' }),
  ]);
  try {
    const result = await listings.search({ page: 1, limit: 20, sort: 'createdAt', order: 'desc' }, reqAs(SELLER));
    assert.equal(result.total, 2);
    assert.ok(result.items.every((item) => item.status === 'PUBLISHED'));

    const filtered = await listings.search(
      { page: 1, limit: 20, sort: 'createdAt', order: 'desc', countryCode: 'CI' },
      reqAs(SELLER),
    );
    assert.equal(filtered.total, 1);
    assert.equal(filtered.items[0].id, 'lst_3');
  } finally {
    restore();
  }
});

test('MKT-03 : `mine=true` renvoie aussi les brouillons du locataire', async () => {
  const { restore } = await setup([
    listingRow({ id: 'lst_1', status: 'PUBLISHED' }),
    listingRow({ id: 'lst_2', status: 'DRAFT' }),
  ]);
  try {
    const result = await listings.search(
      { page: 1, limit: 20, sort: 'createdAt', order: 'desc', mine: 'true' },
      reqAs(SELLER),
    );
    assert.equal(result.total, 2);
    assert.ok(result.items.every((item) => Array.isArray(item.photos)));
    assert.ok(result.items.every((item) => item.crop && item.crop.slug === 'mais'));
  } finally {
    restore();
  }
});
