/**
 * SPEC-SUPER-ADMIN M7 — notifications système (unitaire).
 *
 * Ce que garantit ce test :
 *   1. l'annonce interne est **ciblée** par rôle et/ou par pays (U-M7-1) :
 *      rôles d'adhésion actifs, profils par pays, intersection si les deux ;
 *   2. chaque diffusion est auditée `admin.notification.broadcast` avec les
 *      compteurs ciblés/remis (RG-M4-2 : pas d'action sensible sans trace) ;
 *   3. l'historique expose les annonces et le **taux de délivrance SMS** calculé
 *      depuis `sms_messages` (U-M7-1), avec les lots `sms_batch_logs` ;
 *   4. négatifs : ciblage absent refusé (schéma + garde service).
 */
import './helpers/pinTestEnv.mjs';

import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/config/prisma.js';
import * as service from '../src/modules/admin/admin.notifications.service.js';
import { broadcastSchema } from '../src/modules/admin/admin.notifications.schema.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';

const acteur = () => ({
  user: {
    id: '44444444-4444-4444-8444-444444444444',
    email: 'm7@agrikonnect.test',
    roles: ['ADMIN'],
    profile: { id: '44444444-4444-4444-8444-444444444444', mfaEnabled: true },
  },
  headers: { 'user-agent': 'test-m7', 'x-forwarded-for': '127.0.0.1' },
  ip: '127.0.0.1',
});

const monter = (initial = {}) =>
  withFakePrisma(prisma, {
    membership: [],
    profile: [],
    notification: [],
    notificationPreference: [],
    auditLog: [],
    smsMessage: [],
    smsBatchLog: [],
    ...initial,
});

const cibles = () => [
  { id: 'u-acheteur-cd', userId: 'u-acheteur-cd', organizationId: 'org-1', roles: ['BUYER'], status: 'ACTIVE' },
  { id: 'u-acheteur-ke', userId: 'u-acheteur-ke', organizationId: 'org-2', roles: ['BUYER'], status: 'ACTIVE' },
  { id: 'u-producteur-cd', userId: 'u-producteur-cd', organizationId: 'org-3', roles: ['FARMER'], status: 'ACTIVE' },
  { id: 'u-suspendu-cd', userId: 'u-suspendu-cd', organizationId: 'org-4', roles: ['BUYER'], status: 'SUSPENDED' },
];

const profils = () => [
  { id: 'u-acheteur-cd', countryCode: 'CD' },
  { id: 'u-acheteur-ke', countryCode: 'KE' },
  { id: 'u-producteur-cd', countryCode: 'CD' },
  { id: 'u-suspendu-cd', countryCode: 'CD' },
];

/* ═══════════ 1. Ciblage de l'annonce (U-M7-1) ═══════════ */

test('broadcast par rôle : seuls les membres actifs porteurs du rôle sont touchés', async () => {
  const { fake, restore } = await monter({ membership: cibles(), profile: profils() });
  try {
    const sortie = await service.broadcast({
      title: 'Nouvelle politique de qualité',
      body: 'Merci de prendre connaissance des nouvelles exigences de qualité.',
      role: 'BUYER',
      channels: ['IN_APP'],
    }, acteur());

    assert.equal(sortie.targeted, 2, 'acheteurs CD + KE ; le suspendu et le producteur exclus');
    assert.equal(sortie.delivered, 2);

    const destinataires = fake._store.notification.map((n) => n.userId).sort();
    assert.deepEqual(destinataires, ['u-acheteur-cd', 'u-acheteur-ke']);
    assert.ok(fake._store.notification.every((n) => n.type === 'admin.announcement'));
  } finally {
    restore();
  }
});

test('broadcast par pays, et combinaison rôle + pays (intersection)', async () => {
  const { fake, restore } = await monter({ membership: cibles(), profile: profils() });
  try {
    const pays = await service.broadcast({
      title: 'Maintenance planifiée',
      body: 'Intervention technique prévue ce soir en République démocratique du Congo.',
      country: 'CD',
      channels: ['IN_APP'],
    }, acteur());
    assert.equal(pays.targeted, 3, 'trois profils CD (adhésion non requise pour le ciblage pays)');

    fake._store.notification.length = 0;

    const croise = await service.broadcast({
      title: 'Information acheteurs',
      body: 'Message réservé aux acheteurs établis en République démocratique du Congo.',
      role: 'BUYER',
      country: 'CD',
      channels: ['IN_APP'],
    }, acteur());
    assert.equal(croise.targeted, 1, 'intersection rôle ∩ pays');
    assert.equal(fake._store.notification[0].userId, 'u-acheteur-cd');
  } finally {
    restore();
  }
});

test('broadcast : chaque diffusion est auditée avec ses compteurs', async () => {
  const { fake, restore } = await monter({ membership: cibles(), profile: profils() });
  try {
    await service.broadcast({
      title: 'Rappel sécurité',
      body: 'Activez la double authentification sur votre compte administrateur.',
      role: 'BUYER',
      channels: ['IN_APP'],
    }, acteur());

    const trace = fake._store.auditLog.find((l) => l.action === 'admin.notification.broadcast');
    assert.ok(trace, 'audit `admin.notification.broadcast` écrit');
    assert.equal(trace.newValue.targeted, 2);
    assert.equal(trace.newValue.delivered, 2);
    assert.equal(trace.newValue.role, 'BUYER');
    assert.equal(trace.resource, 'notifications');
  } finally {
    restore();
  }
});

/* ═══════════ 2. Historique + taux de délivrance (U-M7-1) ═══════════ */

test('history : annonces, lots SMS et taux de délivrance calculé', async () => {
  const { restore } = await monter({
    auditLog: [
      {
        id: 'a1',
        action: 'admin.notification.broadcast',
        actorId: 'adm',
        createdAt: new Date('2026-11-02T12:00:00.000Z'),
        newValue: { title: 'Annonce test', role: 'BUYER', country: 'CD', channels: ['IN_APP'], targeted: 4, delivered: 4 },
      },
    ],
    smsBatchLog: [
      { id: 'b1', organizationId: 'org-1', batchId: 'batch-1', candidates: 10, sent: 8, skipped: 2, failed: 0, startedAt: new Date('2026-11-02T11:00:00.000Z'), mode: 'CONSOLE' },
    ],
    smsMessage: [
      { id: 'm1', status: 'DELIVERED' },
      { id: 'm2', status: 'DELIVERED' },
      { id: 'm3', status: 'DELIVERED' },
      { id: 'm4', status: 'SENT' },
      { id: 'm5', status: 'FAILED' },
    ],
  });
  try {
    const h = await service.history({ limit: 20 });

    assert.equal(h.annonces.length, 1);
    assert.equal(h.annonces[0].title, 'Annonce test');
    assert.equal(h.annonces[0].targeted, 4);

    assert.equal(h.sms.batches.length, 1);
    assert.equal(h.sms.batches[0].batchId, 'batch-1');

    assert.equal(h.sms.messages.delivered, 3);
    assert.equal(h.sms.messages.pending, 1, 'SENT reste en attente de confirmation réseau');
    assert.equal(h.sms.messages.failed, 1);
    assert.equal(h.sms.messages.total, 5);
    assert.equal(h.sms.messages.deliveryRate, 0.6, '3/5 — calculé depuis `sms_messages`');
  } finally {
    restore();
  }
});

test('history : taux nul et explicite sans message', async () => {
  const { restore } = await monter();
  try {
    const h = await service.history({ limit: 5 });
    assert.deepEqual(h.annonces, []);
    assert.equal(h.sms.messages.total, 0);
    assert.equal(h.sms.messages.deliveryRate, null, 'aucun message → taux nul (jamais inventé)');
  } finally {
    restore();
  }
});

/* ═══════════ 3. Négatifs : ciblage obligatoire ═══════════ */

test('négatifs : annonce sans cible refusée (schéma et garde service)', async () => {
  const { restore } = await monter({ membership: cibles(), profile: profils() });
  try {
    const vide = { title: 'Titre valide', body: 'Corps de message valide.' };
    assert.equal(broadcastSchema.safeParse(vide).success, false, 'schéma : rôle ou pays requis');
    await assert.rejects(() => service.broadcast(vide, acteur()), /Ciblage requis/);

    const mauvaisPays = { ...vide, country: 'XYZ' };
    assert.equal(broadcastSchema.safeParse(mauvaisPays).success, false, 'code pays ISO 2 lettres exigé');
  } finally {
    restore();
  }
});
