import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';
import * as messaging from '../src/modules/messaging/messaging.service.js';

/**
 * Messagerie (MSG-01 → MSG-04) sur Prisma simulé.
 *
 * Invariants vérifiés :
 *  - impossible d'ouvrir un fil avec une organisation qui n'est pas partie au dossier ;
 *  - un fil est unique par dossier (réutilisation, pas de doublon) ;
 *  - les pièces jointes sont validées ;
 *  - un message signalé n'est jamais supprimé ;
 *  - les accusés de lecture et le compteur de non-lus sont exacts ;
 *  - un fil bloqué n'accepte plus d'écriture.
 */

const BUYER = 'org_buyer';
const SELLER = 'org_seller';
const OUTSIDER = 'org_intrus';

const reqAs = (organizationId, userId = 'user_1') => ({
  tenant: { organizationId },
  user: { id: userId, roles: [] },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
});

const orderRow = {
  id: 'ord_1',
  number: 'CMD-2026-00001',
  buyerOrgId: BUYER,
  sellerOrgId: SELLER,
  status: 'ACCEPTED',
  deletedAt: null,
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
};

const setup = async () =>
  withFakePrisma(prisma, {
    order: [orderRow],
    conversation: [],
    message: [],
    notification: [],
    notificationPreference: [],
    auditLog: [],
    membership: [
      { id: 'mem_buyer', organizationId: BUYER, userId: 'user_buyer', status: 'ACTIVE' },
      { id: 'mem_seller', organizationId: SELLER, userId: 'user_seller', status: 'ACTIVE' },
    ],
    listing: [],
    dispute: [],
  });

test('MSG-01 : une conversation doit être rattachée à un dossier dont on est partie', async () => {
  const { restore } = await setup();
  try {
    await assert.rejects(
      () =>
        messaging.startConversation(
          { subjectType: 'ORDER', subjectId: 'ord_1', participantOrgIds: [SELLER] },
          reqAs(OUTSIDER),
        ),
      (error) => error.status === 404,
    );

    await assert.rejects(
      () =>
        messaging.startConversation(
          { subjectType: 'ORDER', subjectId: 'ord_absent', participantOrgIds: [SELLER] },
          reqAs(BUYER),
        ),
      (error) => error.status === 404,
    );
  } finally {
    restore();
  }
});

test('MSG-01 : les participants doivent tous être parties au dossier', async () => {
  const { restore } = await setup();
  try {
    await assert.rejects(
      () =>
        messaging.startConversation(
          { subjectType: 'ORDER', subjectId: 'ord_1', participantOrgIds: [OUTSIDER] },
          reqAs(BUYER),
        ),
      (error) => error.status === 403 && /partie à l'objet métier/.test(error.message),
    );
  } finally {
    restore();
  }
});

test('MSG-01 : un seul fil par dossier — le second appel réutilise', async () => {
  const { fake, restore } = await setup();
  try {
    const first = await messaging.startConversation(
      { subjectType: 'ORDER', subjectId: 'ord_1', participantOrgIds: [SELLER], firstMessage: 'Bonjour, quand livrez-vous ?' },
      reqAs(BUYER),
    );
    assert.equal(first.replayed, false);
    assert.deepEqual([...first.conversation.participantOrgIds].sort(), [BUYER, SELLER].sort());

    const second = await messaging.startConversation(
      { subjectType: 'ORDER', subjectId: 'ord_1', participantOrgIds: [SELLER] },
      reqAs(BUYER),
    );
    assert.equal(second.replayed, true);
    assert.equal(second.conversation.id, first.conversation.id);
    assert.equal(fake._store.conversation.length, 1);
  } finally {
    restore();
  }
});

test('MSG-02 : message posté, notifié au destinataire, visible des deux parties', async () => {
  const { fake, restore } = await setup();
  try {
    const { conversation } = await messaging.startConversation(
      { subjectType: 'ORDER', subjectId: 'ord_1', participantOrgIds: [SELLER] },
      reqAs(BUYER),
    );

    await messaging.postMessage(conversation.id, { body: 'Colis prêt pour enlèvement' }, reqAs(SELLER, 'user_seller'));

    const sellerView = await messaging.listMessages(conversation.id, { limit: 30 }, reqAs(SELLER, 'user_seller'));
    const buyerView = await messaging.listMessages(conversation.id, { limit: 30 }, reqAs(BUYER, 'user_buyer'));

    assert.equal(sellerView.items.length, 1);
    assert.equal(buyerView.items.length, 1);
    assert.equal(buyerView.items[0].body, 'Colis prêt pour enlèvement');

    // La notification est adressée à l'acheteur, pas au vendeur
    assert.equal(fake._store.notification.length, 1);
    assert.equal(fake._store.notification[0].userId, 'user_buyer');
  } finally {
    restore();
  }
});

test('MSG-02 : accusés de lecture et compteur de non-lus', async () => {
  const { restore } = await setup();
  try {
    const { conversation } = await messaging.startConversation(
      { subjectType: 'ORDER', subjectId: 'ord_1', participantOrgIds: [SELLER] },
      reqAs(BUYER, 'user_buyer'),
    );

    await messaging.postMessage(conversation.id, { body: 'Message 1' }, reqAs(SELLER, 'user_seller'));
    await messaging.postMessage(conversation.id, { body: 'Message 2' }, reqAs(SELLER, 'user_seller'));

    const before = await messaging.listConversations({ page: 1, limit: 20 }, reqAs(BUYER, 'user_buyer'));
    assert.equal(before.items[0].unread, 2);
    assert.equal(before.totalUnread, 2);

    // La lecture marque les messages reçus comme lus
    const thread = await messaging.listMessages(conversation.id, { limit: 30 }, reqAs(BUYER, 'user_buyer'));
    assert.equal(thread.items.length, 2);
    assert.ok(thread.items.every((m) => m.readBy.includes('user_buyer')));

    const after = await messaging.listConversations({ page: 1, limit: 20 }, reqAs(BUYER, 'user_buyer'));
    assert.equal(after.items[0].unread, 0);
  } finally {
    restore();
  }
});

test('MSG-02 : pièce jointe invalide refusée (URL http(s) ou clé de stockage)', async () => {
  const { restore } = await setup();
  try {
    const { conversation } = await messaging.startConversation(
      { subjectType: 'ORDER', subjectId: 'ord_1', participantOrgIds: [SELLER] },
      reqAs(BUYER),
    );

    await assert.rejects(
      () => messaging.postMessage(conversation.id, { body: 'Voir pièce', attachments: ['javascript:alert(1)'] }, reqAs(BUYER)),
      (error) => error.status === 422 && /Pièce jointe invalide/.test(error.message),
    );

    const accepted = await messaging.postMessage(
      conversation.id,
      { body: 'Photo du lot', attachments: ['https://storage.example/lot.jpg', 'org/media/2026-10/photo.jpg'] },
      reqAs(BUYER),
    );
    assert.equal(accepted.attachments.length, 2);
  } finally {
    restore();
  }
});

test('MSG-03 : un message signalé est conservé (jamais supprimé)', async () => {
  const { fake, restore } = await setup();
  try {
    const { conversation } = await messaging.startConversation(
      { subjectType: 'ORDER', subjectId: 'ord_1', participantOrgIds: [SELLER] },
      reqAs(BUYER),
    );
    const message = await messaging.postMessage(conversation.id, { body: 'Contenu litigieux' }, reqAs(SELLER, 'user_seller'));

    const result = await messaging.reportMessage(message.id, { reason: 'Propos déplacés' }, reqAs(BUYER));
    assert.equal(result.reported, true);
    assert.match(result.retention, /conservé/i);
    assert.equal(fake._store.message.filter((m) => m.id === message.id).length, 1, 'le message existe toujours');
  } finally {
    restore();
  }
});

test('MSG-02 : un fil archivé ou bloqué refuse les nouveaux messages', async () => {
  const { restore } = await setup();
  try {
    const { conversation } = await messaging.startConversation(
      { subjectType: 'ORDER', subjectId: 'ord_1', participantOrgIds: [SELLER] },
      reqAs(BUYER),
    );

    await messaging.archiveConversation(conversation.id, reqAs(BUYER));
    await assert.rejects(
      () => messaging.postMessage(conversation.id, { body: 'Trop tard' }, reqAs(BUYER)),
      (error) => error.status === 409,
    );
  } finally {
    restore();
  }
});

test('MSG-02 : le blocage de modération ferme le fil aux deux parties', async () => {
  const { restore } = await setup();
  try {
    const { conversation } = await messaging.startConversation(
      { subjectType: 'ORDER', subjectId: 'ord_1', participantOrgIds: [SELLER] },
      reqAs(BUYER),
    );

    const blocked = await messaging.blockConversation(conversation.id, { reason: 'Harcèlement signalé' }, reqAs('org_support', 'user_mod'));
    assert.equal(blocked.status, 'BLOCKED');

    for (const party of [BUYER, SELLER]) {
      await assert.rejects(
        () => messaging.postMessage(conversation.id, { body: 'Encore un message' }, reqAs(party)),
        (error) => error.status === 409,
      );
    }
  } finally {
    restore();
  }
});

test('MSG-01 : un tiers ne peut pas lire un fil dont il n\'est pas partie', async () => {
  const { restore } = await setup();
  try {
    const { conversation } = await messaging.startConversation(
      { subjectType: 'ORDER', subjectId: 'ord_1', participantOrgIds: [SELLER] },
      reqAs(BUYER),
    );

    await assert.rejects(
      () => messaging.listMessages(conversation.id, { limit: 30 }, reqAs(OUTSIDER)),
      (error) => error.status === 404,
    );
  } finally {
    restore();
  }
});

test('MSG-02 : pagination par curseur (before) sans doublon ni perte', async () => {
  const { restore } = await setup();
  try {
    const { conversation } = await messaging.startConversation(
      { subjectType: 'ORDER', subjectId: 'ord_1', participantOrgIds: [SELLER] },
      reqAs(BUYER),
    );

    for (let i = 1; i <= 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await messaging.postMessage(conversation.id, { body: `Message ${i}` }, reqAs(SELLER, 'user_seller'));
      // Le curseur s'appuie sur `createdAt` : on espace les écritures d'1 ms.
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 2));
    }

    const page1 = await messaging.listMessages(conversation.id, { limit: 3 }, reqAs(BUYER));
    assert.equal(page1.items.length, 3);
    assert.equal(page1.hasMore, true);
    assert.ok(page1.nextCursor);

    const page2 = await messaging.listMessages(conversation.id, { limit: 3, before: page1.nextCursor }, reqAs(BUYER));
    assert.equal(page2.items.length, 2);
    assert.equal(page2.hasMore, false);

    const all = [...page2.items, ...page1.items].map((m) => m.body);
    assert.deepEqual(all, ['Message 1', 'Message 2', 'Message 3', 'Message 4', 'Message 5']);
  } finally {
    restore();
  }
});
