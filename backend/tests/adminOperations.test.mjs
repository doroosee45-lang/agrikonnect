/**
 * SPEC-SUPER-ADMIN M4 — modération unifiée (unitaire).
 *
 * Ce que garantit ce test :
 *   1. chaque décision est **déléguée au service métier existant** (RG-M4-1) :
 *      mapping approuver/refuser/suspendre vers les statuts réels ;
 *   2. toute décision **notifie l'acteur concerné** (RG-M4-2) en plus de
 *      l'audit déjà écrit par le service délégué ;
 *   3. la file de modération liste, filtre et pagine les éléments réels (U-M4-2) ;
 *   4. négatifs : entité inconnue, élément absent, motif trop court, suspension
 *      d'une vérification refusée avec un message explicite.
 */
import './helpers/pinTestEnv.mjs';

import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/config/prisma.js';
import * as service from '../src/modules/admin/admin.operations.service.js';
import { moderateSchema } from '../src/modules/admin/admin.operations.schema.js';
import { broadcastSchema } from '../src/modules/admin/admin.notifications.schema.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';

const acteur = () => ({
  user: {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'm4@agrikonnect.test',
    roles: ['ADMIN'],
    profile: { id: '33333333-3333-4333-8333-333333333333', mfaEnabled: true },
  },
  headers: { 'user-agent': 'test-m4', 'x-forwarded-for': '127.0.0.1' },
  ip: '127.0.0.1',
  tenant: null,
});

const L_ID = 'lst_m4_0000000000000000000001';
const R_ID = 'rev_m4_0000000000000000000001';
const V_ID = 'ver_m4_0000000000000000000001';

const monter = (initial = {}) =>
  withFakePrisma(prisma, {
    listing: [],
    review: [],
    verification: [],
    organization: [],
    membership: [],
    profile: [],
    notification: [],
    notificationPreference: [],
    auditLog: [],
    ...initial,
});

const annonce = (surcharge = {}) => ({
  id: L_ID,
  title: 'Maïs jaune — lot 12',
  status: 'DRAFT',
  createdBy: 'user-producteur',
  deletedAt: null,
  createdAt: new Date('2026-11-01T10:00:00.000Z'),
  ...surcharge,
});

/* ═══════════ 1. Délégation + notification (RG-M4-1/RG-M4-2) ═══════════ */

test('listing.approve : statut PUBLISHED via le service métier, notification du producteur', async () => {
  const { fake, restore } = await monter({ listing: [annonce()] });
  try {
    const sortie = await service.moderate('listing', L_ID, {
      decision: 'approve',
      reason: 'Dossier conforme au cahier des charges',
    }, acteur());

    assert.equal(sortie.after.status, 'PUBLISHED', 'statut changé par listings.moderate');
    assert.equal(sortie.before.status, 'DRAFT');
    assert.equal(sortie.notified, true, 'le producteur est notifié (RG-M4-2)');

    const actions = fake._store.auditLog.map((l) => l.action);
    assert.ok(actions.includes('listing.moderate'), 'audit métier écrit par le service délégué');

    const notif = fake._store.notification.find((n) => n.userId === 'user-producteur');
    assert.ok(notif, 'notification créée pour le propriétaire');
    assert.equal(notif.type, 'moderation.listing');
    assert.match(notif.body, /Dossier conforme/, 'le motif figure dans la notification');
  } finally {
    restore();
  }
});

test('listing.reject/suspend : mapping HIDDEN/ARCHIVED', async () => {
  const { fake, restore } = await monter({ listing: [annonce()] });
  try {
    await service.moderate('listing', L_ID, { decision: 'reject', reason: 'Photos non conformes' }, acteur());
    assert.equal(fake._store.listing[0].status, 'HIDDEN');

    await service.moderate('listing', L_ID, { decision: 'suspend', reason: 'Litige en cours sur le lot' }, acteur());
    assert.equal(fake._store.listing[0].status, 'ARCHIVED');
  } finally {
    restore();
  }
});

test('review : approuver = KEEP (PUBLISHED), refuser = REMOVE (HIDDEN), notif de l auteur', async () => {
  const { fake, restore } = await monter({
    review: [{ id: R_ID, orderId: 'o1', authorOrgId: 'org-auteur', targetOrgId: 'org-cible', rating: 4, status: 'PUBLISHED', createdAt: new Date() }],
    organization: [{ id: 'org-auteur', createdBy: 'user-auteur' }],
  });
  try {
    const ok = await service.moderate('review', R_ID, { decision: 'approve', reason: 'Avis constructif et argumenté' }, acteur());
    assert.equal(ok.after.status, 'PUBLISHED');
    assert.equal(ok.notified, true, 'l auteur de l avis est notifié');

    await service.moderate('review', R_ID, { decision: 'reject', reason: 'Propos injurieux dans le commentaire' }, acteur());
    assert.equal(fake._store.review[0].status, 'HIDDEN', 'REMOVE → masqué, jamais supprimé');

    const notif = fake._store.notification.find((n) => n.userId === 'user-auteur');
    assert.ok(notif);
    assert.equal(notif.type, 'moderation.review');
  } finally {
    restore();
  }
});

test('verification : approve → APPROVED ; suspend → refus explicite', async () => {
  const { fake, restore } = await monter({
    verification: [{ id: V_ID, subjectType: 'USER', subjectId: 'u1', organizationId: 'org-v', level: 'BASIC', status: 'PENDING', createdAt: new Date(), updatedAt: new Date() }],
    organization: [{ id: 'org-v', createdBy: 'user-demandeur' }],
  });
  try {
    const ok = await service.moderate('verification', V_ID, { decision: 'approve', reason: 'Pièces d identité vérifiées' }, acteur());
    assert.equal(ok.after.status, 'APPROVED');
    assert.equal(ok.notified, true, 'le demandeur est notifié (RG-M4-2)');

    await assert.rejects(
      () => service.moderate('verification', V_ID, { decision: 'suspend', reason: 'Mise en attente prolongée' }, acteur()),
      (e) => /suspension ne s applique pas/.test(e.message),
      'suspend n est pas applicable aux vérifications',
    );
  } finally {
    restore();
  }
});

/* ═══════════ 2. File de modération (U-M4-2) ═══════════ */

test('file : liste filtrable et paginée par entité', async () => {
  const { restore } = await monter({
    listing: [
      annonce({ id: 'lst_a', status: 'DRAFT', createdAt: new Date('2026-11-02T09:00:00.000Z') }),
      annonce({ id: 'lst_b', status: 'HIDDEN', title: 'Riz parfumé', createdAt: new Date('2026-11-02T10:00:00.000Z') }),
      { id: 'lst_del', title: 'Supprimée', status: 'DRAFT', createdBy: 'x', deletedAt: new Date(), createdAt: new Date() },
    ],
  });
  try {
    const page = await service.file('listing', { page: 1, limit: 20 });
    assert.equal(page.items.length, 2, 'les annonces supprimées sont exclues');
    assert.equal(page.total, 2);
    assert.deepEqual(page.items.map((i) => i.id), ['lst_b', 'lst_a'], 'tri du plus récent au plus ancien');

    const filtrees = await service.file('listing', { page: 1, limit: 20, status: 'HIDDEN' });
    assert.equal(filtrees.items.length, 1);
    assert.equal(filtrees.items[0].label, 'Riz parfumé');
  } finally {
    restore();
  }
});

/* ═══════════ 3. Négatifs (motif, entité, absence) ═══════════ */

test('négatifs : motif requis, entité inconnue, élément absent', async () => {
  const { restore } = await monter({ listing: [annonce()] });
  try {
    assert.equal(moderateSchema.safeParse({ decision: 'approve', reason: 'ok' }).success, false, 'motif < 3 caractères refusé');
    assert.equal(moderateSchema.safeParse({ decision: 'promote', reason: 'motif valide' }).success, false, 'décision inconnue refusée');
    assert.ok(moderateSchema.safeParse({ decision: 'suspend', reason: 'Motif suffisamment long' }).success);

    await assert.rejects(
      () => service.moderate('dispute', 'd1', { decision: 'approve', reason: 'Motif valide' }, acteur()),
      /Entité de modération inconnue/,
    );
    await assert.rejects(
      () => service.moderate('listing', 'lst_absente', { decision: 'approve', reason: 'Motif valide' }, acteur()),
      /Élément introuvable/,
    );
  } finally {
    restore();
  }
});

test('schéma annonce : ciblage obligatoire (rôle ou pays)', () => {
  assert.equal(broadcastSchema.safeParse({ title: 'Maintenance', body: 'Intervention planifiée ce soir' }).success, false);
  assert.ok(broadcastSchema.safeParse({ title: 'Maintenance', body: 'Intervention planifiée ce soir', country: 'cd' }).success);
  assert.ok(broadcastSchema.safeParse({ title: 'Maintenance', body: 'Intervention planifiée ce soir', role: 'BUYER' }).success);
});
