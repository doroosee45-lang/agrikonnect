/**
 * Exigences CDC couvertes : OFF-01, OFF-02, OFF-03, OFF-04, REQ-04.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../../config/prisma.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { resolveId } from '../../../shared/ids.js';
import { audit } from '../../../shared/audit.js';
import { notify } from '../../../shared/events.js';

/**
 * REQ-04 / ORD-02 — Offres et contre-propositions.
 * Une offre est chiffrée, datée et opposable : elle porte `validUntil`.
 */

export const createForRequest = async (requestId, payload, req) => {
  const request = await prisma.purchaseRequest.findUnique({ where: { id: requestId } });
  if (!request || request.deletedAt) throw ApiError.notFound('Demande introuvable');
  if (request.status !== 'OPEN' && request.status !== 'MATCHED') {
    throw ApiError.conflict('Cette demande n\'accepte plus d\'offres');
  }

  // Un acheteur ne s'offre pas à lui-même
  if (request.buyerOrgId === req.tenant.organizationId) {
    throw ApiError.badRequest('Tu ne peux pas répondre à ta propre demande');
  }

  const offer = await prisma.offer.create({
    data: {
      ...payload,
      id: resolveId(payload.id),
      requestId,
      sellerOrgId: req.tenant.organizationId,
      createdBy: req.user.id,
    },
  });

  // Notification de l'acheteur (sans révéler les coordonnées, REQ-05)
  const buyerMembers = await prisma.membership.findMany({
    where: { organizationId: request.buyerOrgId, status: 'ACTIVE' },
    select: { userId: true },
  });
  for (const member of buyerMembers) {
    // eslint-disable-next-line no-await-in-loop
    await notify({
      userId: member.userId,
      type: 'offer.received',
      title: 'Nouvelle offre sur votre demande d\'achat',
      body: `${offer.quantity} ${offer.unit} à ${offer.price} ${offer.currency}`,
      payload: { offerId: offer.id, requestId },
      dedupeKey: `offer:${offer.id}:${member.userId}`,
    });
  }

  await audit({
    actorId: req.user.id,
    action: 'offer.create',
    resource: 'offers',
    resourceId: offer.id,
    req,
    newValue: { requestId, price: offer.price, quantity: offer.quantity },
  });

  return offer;
};

/** L'acheteur accepte, rejette, ou contre-propose. */
export const decide = async (offerId, { status, counter }, req) => {
  const offer = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!offer) throw ApiError.notFound('Offre introuvable');
  if (offer.status !== 'PENDING') throw ApiError.conflict('Cette offre a déjà été traitée');

  const request = offer.requestId
    ? await prisma.purchaseRequest.findUnique({ where: { id: offer.requestId } })
    : null;

  const isBuyer = request?.buyerOrgId === req.tenant.organizationId;
  const isSeller = offer.sellerOrgId === req.tenant.organizationId;

  if (!isBuyer && !isSeller) throw ApiError.notFound('Offre introuvable');

  // OFF-02 — la validité datée est opposable : une offre échue ne peut plus
  // être acceptée (elle reste consultable et peut être re-proposée).
  if (
    status === 'ACCEPTED' &&
    offer.validUntil &&
    new Date(offer.validUntil).getTime() < Date.now()
  ) {
    throw ApiError.conflict(
      `Offre expirée le ${new Date(offer.validUntil).toISOString().slice(0, 10)} : elle ne peut plus être acceptée`,
    );
  }

  if (isSeller && status !== 'WITHDRAWN') {
    throw ApiError.forbidden('Le vendeur peut seulement retirer son offre');
  }
  if (isBuyer && status === 'WITHDRAWN') {
    throw ApiError.forbidden('Seul le vendeur peut retirer son offre');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.offer.update({
      where: { id: offerId },
      data: { status },
    });

    // Contre-proposition : nouvelle offre symétrique, l'ancienne est rejetée
    if (counter) {
      await tx.offer.create({
        data: {
          id: resolveId(),
          requestId: offer.requestId,
          listingId: offer.listingId,
          sellerOrgId: offer.sellerOrgId,
          price: counter.price,
          currency: counter.currency ?? offer.currency,
          quantity: counter.quantity ?? offer.quantity,
          unit: counter.unit ?? offer.unit,
          conditions: counter.conditions ?? null,
          status: 'PENDING',
          validUntil: counter.validUntil ?? null,
          createdBy: req.user.id,
        },
      });
    }

    if (status === 'ACCEPTED' && offer.requestId) {
      await tx.purchaseRequest.update({
        where: { id: offer.requestId },
        data: { status: 'CLOSED' },
      });
    }

    return result;
  });

  await audit({
    actorId: req.user.id,
    action: `offer.${status.toLowerCase()}`,
    resource: 'offers',
    resourceId: offerId,
    req,
    oldValue: { status: 'PENDING' },
    newValue: { status, counter: counter ?? null },
  });

  return updated;
};

export const listForRequest = async (requestId, req) => {
  const request = await prisma.purchaseRequest.findUnique({ where: { id: requestId } });
  if (!request) throw ApiError.notFound('Demande introuvable');

  const isBuyer = request.buyerOrgId === req.tenant.organizationId;

  const offers = await prisma.offer.findMany({
    where: { requestId, ...(isBuyer ? {} : { sellerOrgId: req.tenant.organizationId }) },
    orderBy: { createdAt: 'desc' },
  });

  return { offers, visibility: isBuyer ? 'buyer' : 'seller' };
};
