/**
 * Exigences CDC couvertes : ORD-01, ORD-02, ORD-03, ORD-04, ORD-05, DISP-01, DISP-02, NFR-04.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../../config/prisma.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { resolveId } from '../../../shared/ids.js';
import { paginationArgs, orderBy } from '../../../shared/pagination.js';
import { audit } from '../../../shared/audit.js';
import { notifyMany } from '../../../shared/events.js';
import { round } from '../../../shared/money.js';
import { ensureBusinessConversationSafe } from '../../../shared/conversations.js';
import {
  canTransition,
  partyOf,
  isModeratorRole,
  allowedTargets,
  progressOf,
} from '../../../shared/orderStateMachine.js';
import { emitToOrganizations } from '../../../realtime/bus.js';

/**
 * ORD-01 → ORD-05 — Commandes.
 *
 * Quatre garanties non négociables du CDC :
 *  1. Snapshot : les conditions (prix, quantité, unité) sont figées à la création.
 *  2. Machine à états stricte (`shared/orderStateMachine.js`), contrôlée par
 *     rôle ET par état source, puis auditée.
 *  3. Atomicité du stock : la réservation est une mise à jour conditionnelle,
 *     ce qui rend la survente impossible même en concurrence.
 *  4. Traçabilité : chaque transition produit un `OrderEvent` immuable.
 */

const SETTINGS = {
  maxNumberAttempts: 3,
};

/**
 * Numéro séquentiel lisible (`CMD-AAAA-00001`).
 * Basé sur le maximum existant (et non sur `count`, qui régresse si une
 * commande est supprimée logiquement) + nouvelle tentative en cas de collision
 * concurrente sur la contrainte unique.
 */
const buildNumber = (year, sequence) => `CMD-${year}-${String(sequence).padStart(5, '0')}`;

const nextNumber = async (attempt = 1) => {
  const year = new Date().getUTCFullYear();
  const last = await prisma.order.findFirst({
    where: { number: { startsWith: `CMD-${year}-` } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });

  const lastSequence = last ? Number(last.number.split('-')[2]) : 0;
  const sequence = lastSequence + attempt;

  return { number: buildNumber(year, sequence), sequence };
};

/**
 * ORD-01 — création depuis une annonce ou une offre acceptée.
 * Le snapshot fige les conditions : une modification ultérieure de l'annonce
 * ne change pas la commande (principe P2 de V2).
 */
export const create = async (payload, req) => {
  const organizationId = req.tenant.organizationId;

  let listing = null;
  let offer = null;

  if (payload.offerId) {
    offer = await prisma.offer.findUnique({ where: { id: payload.offerId } });
    if (!offer) throw ApiError.notFound('Offre introuvable');
    if (offer.status !== 'ACCEPTED') {
      throw ApiError.conflict('Seule une offre acceptée peut donner lieu à une commande');
    }
    if (offer.sellerOrgId === organizationId) {
      throw ApiError.badRequest('Tu ne peux pas commander auprès de toi-même');
    }
  }

  if (payload.listingId) {
    listing = await prisma.listing.findUnique({ where: { id: payload.listingId } });
    if (!listing || listing.deletedAt) throw ApiError.notFound('Annonce introuvable');
    if (listing.status !== 'PUBLISHED' && listing.status !== 'RESERVED') {
      throw ApiError.conflict('Cette annonce n\'est pas disponible');
    }
    if (listing.organizationId === organizationId) {
      throw ApiError.badRequest('Tu ne peux pas commander ta propre annonce');
    }
    if (Number(payload.quantity) > Number(listing.quantity)) {
      throw ApiError.badRequest(
        `Quantité demandée (${payload.quantity}) supérieure au disponible (${listing.quantity} ${listing.unit})`,
      );
    }
  }

  if (!listing && !offer) {
    throw ApiError.badRequest('Une commande doit référencer une annonce ou une offre');
  }

  const sellerOrgId = offer?.sellerOrgId ?? listing.organizationId;
  const unitPrice = Number(payload.unitPrice ?? offer?.price ?? listing.indicativePrice ?? 0);
  const quantity = Number(payload.quantity ?? offer?.quantity ?? listing.quantity);
  const unit = payload.unit ?? offer?.unit ?? listing.unit;
  const currency = payload.currency ?? offer?.currency ?? listing.currency ?? 'USD';

  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw ApiError.badRequest('Un prix unitaire positif est requis pour créer une commande');
  }

  const snapshot = {
    items: [
      {
        listingId: listing?.id ?? null,
        offerId: offer?.id ?? null,
        title: listing?.title ?? payload.title ?? 'Offre négociée',
        cropId: listing?.cropId ?? null,
        quantity,
        unit,
        unitPrice,
        lineTotal: round(unitPrice * quantity),
        quality: listing?.quality ?? null,
      },
    ],
    price: unitPrice,
    currency,
    terms: payload.terms ?? listing?.conditions ?? offer?.conditions ?? null,
    frozenAt: new Date().toISOString(),
    // Rappel explicite : aucun paiement n'est opéré par la plateforme (ORD-04)
    paymentNotice: 'Le règlement s\'effectue hors plateforme. Le statut de paiement est déclaratif.',
  };

  let order = null;

  for (let attempt = 1; attempt <= SETTINGS.maxNumberAttempts; attempt += 1) {
    const { number } = await nextNumber(attempt);
    try {
      order = await prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            id: resolveId(payload.id),
            number,
            buyerOrgId: organizationId,
            sellerOrgId,
            listingId: listing?.id ?? null,
            requestId: offer?.requestId ?? payload.requestId ?? null,
            offerId: offer?.id ?? null,
            snapshot,
            totalAmount: round(unitPrice * quantity),
            currency,
            delivery: payload.delivery ?? undefined,
            placedBy: req.user.id,
          },
        });

        await tx.orderEvent.create({
          data: { orderId: created.id, from: null, to: 'PENDING', actorId: req.user.id, actorOrgId: organizationId },
        });

        return created;
      });
      break;
    } catch (error) {
      // P2002 = collision de numéro (deux créations simultanées) → on réessaie
      if (error.code === 'P2002') continue;
      throw error;
    }
  }

  if (!order) {
    throw ApiError.conflict('Création impossible : collision de numérotation après plusieurs tentatives, réessaie.');
  }

  // Fil de discussion automatique entre les deux parties (MSG-01)
  const conversation = await ensureBusinessConversationSafe({
    subjectType: 'ORDER',
    subjectId: order.id,
    participantOrgIds: [organizationId, sellerOrgId],
    actorUserId: req.user.id,
  });

  // Notification + temps réel côté vendeur
  const sellerMembers = await prisma.membership.findMany({
    where: { organizationId: sellerOrgId, status: 'ACTIVE' },
    select: { userId: true },
  });
  await notifyMany(sellerMembers.map((m) => m.userId), {
    type: 'order.created',
    title: `Nouvelle commande ${order.number}`,
    body: `${quantity} ${unit} — ${order.totalAmount} ${currency}`,
    payload: { orderId: order.id },
    dedupeKey: `order:${order.id}`,
  });

  emitToOrganizations([sellerOrgId], 'order:new', {
    orderId: order.id,
    number: order.number,
    totalAmount: order.totalAmount,
    currency: order.currency,
    status: order.status,
  });

  await audit({
    actorId: req.user.id,
    action: 'order.create',
    resource: 'orders',
    resourceId: order.id,
    req,
    newValue: { number: order.number, sellerOrgId, totalAmount: order.totalAmount, currency },
  });

  return { ...order, conversationId: conversation?.id ?? null };
};

/** ORD-03 — transition de statut contrôlée (état + rôle + propriété). */
export const transition = async (id, { status: target, reason }, req) => {
  const order = await prisma.order.findUnique({ where: { id }, include: { events: true } });
  if (!order || order.deletedAt) throw ApiError.notFound('Commande introuvable');

  const party = partyOf(order, req.tenant.organizationId);
  const moderator = isModeratorRole(req.user?.roles ?? []);

  if (!party && !moderator) throw ApiError.notFound('Commande introuvable');

  const decision = canTransition({ from: order.status, to: target, role: party, moderator });

  if (!decision.allowed) {
    if (decision.code === 'FORBIDDEN_ROLE') throw ApiError.forbidden(decision.message);
    throw ApiError.conflict(decision.message);
  }

  const result = await prisma.$transaction(async (tx) => {
    // Réservation atomique du stock à l'acceptation (NFR-04 : pas de survente)
    if (target === 'ACCEPTED' && order.listingId) {
      const item = order.snapshot?.items?.[0];
      const qty = Number(item?.quantity ?? 0);

      const reserved = await tx.listing.updateMany({
        where: { id: order.listingId, quantity: { gte: qty }, status: { in: ['PUBLISHED', 'RESERVED'] } },
        data: { quantity: { decrement: qty }, status: 'RESERVED', version: { increment: 1 } },
      });

      if (reserved.count === 0) {
        throw ApiError.conflict(
          'Stock insuffisant : un autre acheteur a été plus rapide. Aucune survente n\'est possible.',
        );
      }

      const remaining = await tx.listing.findUnique({
        where: { id: order.listingId },
        select: { quantity: true },
      });
      if (remaining && Number(remaining.quantity) <= 0) {
        await tx.listing.update({ where: { id: order.listingId }, data: { status: 'SOLD_OUT' } });
      }
    }

    // Libération du stock si annulation alors qu'il était réservé (y compris
    // après un litige tranché en annulation par un modérateur).
    if (decision.releasesStock && order.listingId) {
      const qty = Number(order.snapshot?.items?.[0]?.quantity ?? 0);
      if (qty > 0) {
        await tx.listing.updateMany({
          where: { id: order.listingId },
          data: { quantity: { increment: qty }, status: 'PUBLISHED' },
        });
      }
    }

    const updated = await tx.order.update({
      where: { id },
      data: { status: target, version: { increment: 1 } },
    });

    await tx.orderEvent.create({
      data: {
        orderId: id,
        from: order.status,
        to: target,
        actorId: req.user.id,
        actorOrgId: req.tenant.organizationId,
        reason: reason ?? null,
      },
    });

    return updated;
  });

  // Notification + temps réel vers l'autre partie
  const counterpartOrg = party === 'buyer' ? order.sellerOrgId : order.buyerOrgId;
  const members = await prisma.membership.findMany({
    where: { organizationId: counterpartOrg, status: 'ACTIVE' },
    select: { userId: true },
  });
  await notifyMany(members.map((m) => m.userId), {
    type: 'order.updated',
    title: `Commande ${order.number} : ${target}`,
    body: reason ?? null,
    payload: { orderId: id, status: target },
    dedupeKey: `order:${id}:${target}`,
  });

  emitToOrganizations([order.buyerOrgId, order.sellerOrgId], 'order:updated', {
    orderId: id,
    number: order.number,
    from: order.status,
    status: target,
    progress: progressOf(target),
  });

  await audit({
    actorId: req.user.id,
    action: 'order.transition',
    resource: 'orders',
    resourceId: id,
    req,
    oldValue: { status: order.status },
    newValue: { status: target, reason: reason ?? null },
  });

  return {
    order: result,
    previousStatus: order.status,
    progress: progressOf(target),
    allowedTransitions: allowedTargets(target, party, moderator),
  };
};

/** ORD-04 — statut de paiement déclaratif (aucun encaissement par la plateforme). */
export const declarePayment = async (id, { paymentStatus }, req) => {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw ApiError.notFound('Commande introuvable');

  const party = partyOf(order, req.tenant.organizationId);
  if (party !== 'buyer') throw ApiError.forbidden('Seul l\'acheteur déclare le paiement');

  const updated = await prisma.order.update({
    where: { id },
    data: { paymentStatus, version: { increment: 1 } },
  });

  await audit({
    actorId: req.user.id,
    action: 'order.payment.declare',
    resource: 'orders',
    resourceId: id,
    req,
    newValue: { paymentStatus, note: 'Déclaratif — aucun paiement opéré par la plateforme' },
  });

  return {
    order: updated,
    disclaimer: 'AGRIKONNECT n\'opère aucun paiement. Ce statut est déclaré par l\'acheteur.',
  };
};

export const list = async (query, req) => {
  const { page, limit, sort, order, status, role } = query;
  const organizationId = req.tenant.organizationId;

  const where = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(role === 'buyer'
      ? { buyerOrgId: organizationId }
      : role === 'seller'
        ? { sellerOrgId: organizationId }
        : { OR: [{ buyerOrgId: organizationId }, { sellerOrgId: organizationId }] }),
  };

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      ...paginationArgs({ page, limit }),
      orderBy: orderBy(sort, order, ['createdAt', 'updatedAt']),
      include: { events: { orderBy: { at: 'desc' }, take: 1 }, dispute: { select: { status: true } } },
    }),
    prisma.order.count({ where }),
  ]);

  return { items, total, page, limit };
};

export const getOne = async (id, req) => {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      events: { orderBy: { at: 'asc' } },
      invoices: true,
      reviews: true,
      dispute: true,
    },
  });
  if (!order || order.deletedAt) throw ApiError.notFound('Commande introuvable');

  const party = partyOf(order, req.tenant.organizationId);
  const moderator = isModeratorRole(req.user?.roles ?? []);
  if (!party && !moderator) throw ApiError.notFound('Commande introuvable');

  const conversation = await prisma.conversation.findFirst({
    where: { subjectType: 'ORDER', subjectId: id, status: 'OPEN' },
    select: { id: true },
  });

  return {
    order,
    viewerRole: party ?? 'moderator',
    allowedTransitions: allowedTargets(order.status, party, moderator),
    progress: progressOf(order.status),
    conversationId: conversation?.id ?? null,
  };
};

/** Journal des transitions, en lecture seule (il est déjà dans `getOne`). */
export const events = async (id, req) => {
  const order = await prisma.order.findUnique({ where: { id }, include: { events: { orderBy: { at: 'asc' } } } });
  if (!order || order.deletedAt) throw ApiError.notFound('Commande introuvable');

  const party = partyOf(order, req.tenant.organizationId);
  if (!party && !isModeratorRole(req.user?.roles ?? [])) throw ApiError.notFound('Commande introuvable');

  return {
    orderId: id,
    currentStatus: order.status,
    events: order.events,
    appendOnly: true,
  };
};

/** ORD-05 — litige. */
export const openDispute = async (id, { reason, evidence }, req) => {
  const order = await prisma.order.findUnique({ where: { id }, include: { dispute: true } });
  if (!order || order.deletedAt) throw ApiError.notFound('Commande introuvable');
  if (order.dispute) throw ApiError.conflict('Un litige est déjà ouvert sur cette commande');

  const party = partyOf(order, req.tenant.organizationId);
  if (!party) throw ApiError.notFound('Commande introuvable');

  if (!['ACCEPTED', 'PROCESSING', 'READY', 'IN_TRANSIT', 'DELIVERED'].includes(order.status)) {
    throw ApiError.conflict(`Un litige ne peut pas être ouvert au statut ${order.status}`);
  }

  const dispute = await prisma.$transaction(async (tx) => {
    const created = await tx.dispute.create({
      data: {
        id: resolveId(),
        orderId: id,
        openedByOrgId: req.tenant.organizationId,
        reason,
        evidence: evidence ?? [],
      },
    });

    await tx.order.update({ where: { id }, data: { status: 'DISPUTED' } });
    await tx.orderEvent.create({
      data: { orderId: id, from: order.status, to: 'DISPUTED', actorId: req.user.id, actorOrgId: req.tenant.organizationId, reason },
    });

    return created;
  });

  // Un litige ouvre son propre fil, distinct de la conversation de commande
  await ensureBusinessConversationSafe({
    subjectType: 'DISPUTE',
    subjectId: dispute.id,
    participantOrgIds: [order.buyerOrgId, order.sellerOrgId],
    actorUserId: req.user.id,
  });

  const members = await prisma.membership.findMany({
    where: { organizationId: order.buyerOrgId === req.tenant.organizationId ? order.sellerOrgId : order.buyerOrgId, status: 'ACTIVE' },
    select: { userId: true },
  });
  await notifyMany(members.map((m) => m.userId), {
    type: 'dispute.opened',
    title: `Litige sur la commande ${order.number}`,
    body: reason,
    payload: { orderId: id, disputeId: dispute.id },
    dedupeKey: `dispute:${dispute.id}`,
  });

  emitToOrganizations([order.buyerOrgId, order.sellerOrgId], 'order:disputed', {
    orderId: id,
    disputeId: dispute.id,
    status: 'DISPUTED',
  });

  await audit({ actorId: req.user.id, action: 'dispute.open', resource: 'disputes', resourceId: dispute.id, req, newValue: { orderId: id, reason } });
  return dispute;
};

/** Arbitrage par un modérateur. */
export const resolveDispute = async (id, { status, decision }, req) => {
  const dispute = await prisma.dispute.findUnique({ where: { id } });
  if (!dispute) throw ApiError.notFound('Litige introuvable');
  if (['RESOLVED_BUYER', 'RESOLVED_SELLER', 'WITHDRAWN'].includes(dispute.status)) {
    throw ApiError.conflict('Ce litige est déjà clos');
  }

  const order = await prisma.order.findUnique({ where: { id: dispute.orderId } });

  const updated = await prisma.dispute.update({
    where: { id },
    data: { status, decision, moderatorId: req.user.id, decidedAt: new Date() },
  });

  // Le litige tranché remet la commande dans un état cohérent
  const nextOrderStatus = {
    RESOLVED_BUYER: 'COMPLETED',
    RESOLVED_SELLER: 'CANCELLED',
    WITHDRAWN: null,
    UNDER_REVIEW: null,
  }[status];

  if (nextOrderStatus && order && order.status === 'DISPUTED') {
    await prisma.$transaction(async (tx) => {
      // Annulation après litige : le stock réservé est restitué
      if (nextOrderStatus === 'CANCELLED' && order.listingId) {
        const qty = Number(order.snapshot?.items?.[0]?.quantity ?? 0);
        if (qty > 0) {
          await tx.listing.updateMany({
            where: { id: order.listingId },
            data: { quantity: { increment: qty }, status: 'PUBLISHED' },
          });
        }
      }
      await tx.order.update({ where: { id: order.id }, data: { status: nextOrderStatus } });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          from: 'DISPUTED',
          to: nextOrderStatus,
          actorId: req.user.id,
          actorOrgId: req.tenant.organizationId,
          reason: `Décision de médiation : ${decision ?? status}`,
        },
      });
    });

    emitToOrganizations([order.buyerOrgId, order.sellerOrgId], 'order:updated', {
      orderId: order.id,
      status: nextOrderStatus,
      from: 'DISPUTED',
    });
  }

  await audit({ actorId: req.user.id, action: 'dispute.resolve', resource: 'disputes', resourceId: id, req, newValue: { status, decision } });
  return { dispute: updated, orderStatus: nextOrderStatus };
};

/**
 * ORD-05 / MOD-01 — file des litiges pour la modération.
 *
 * Lecture seule et **sans données de contact** : le modérateur voit le dossier,
 * pas les coordonnées privées des parties.
 */
export const listDisputes = async (query, req) => {
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.orderId ? { orderId: query.orderId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 30,
      skip: ((query.page ?? 1) - 1) * (query.limit ?? 30),
    }),
    prisma.dispute.count({ where }),
  ]);

  const orderIds = items.map((d) => d.orderId);
  const orders = orderIds.length
    ? await prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, number: true, status: true, totalAmount: true, currency: true, buyerOrgId: true, sellerOrgId: true },
      })
    : [];
  const orderById = new Map(orders.map((o) => [o.id, o]));

  return {
    items: items.map((dispute) => ({
      ...dispute,
      ageDays: Math.floor((Date.now() - new Date(dispute.createdAt).getTime()) / 86_400_000),
      order: orderById.get(dispute.orderId) ?? null,
      sla: dispute.status === 'OPEN' ? 'À traiter : décision du modérateur sous 5 jours ouvrés' : null,
    })),
    total,
    page: query.page ?? 1,
    limit: query.limit ?? 30,
  };
};
