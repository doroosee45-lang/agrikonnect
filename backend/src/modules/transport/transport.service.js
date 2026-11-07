/**
 * Exigences CDC couvertes : TRA-01, TRA-02, TRA-03
 * (identifiant du cahier des charges : TRP-01).
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { audit } from '../../shared/audit.js';
import { notify } from '../../shared/events.js';
import { distanceKm } from '../../shared/geo.js';

/**
 * TRA-01 → TRA-03 — Transport rattaché à une commande.
 *
 * Modèle : `TransportRequest` (pickup / dropoff en JSON structuré) +
 * `TransportOffer` (propositions des transporteurs).
 * Le transporteur ne reçoit jamais les coordonnées exactes avant acceptation :
 * seul un point approximatif et la distance sont exposés.
 */

const assertOrderParty = async (orderId, organizationId) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw ApiError.notFound('Commande introuvable');
  if (order.buyerOrgId !== organizationId && order.sellerOrgId !== organizationId) {
    throw ApiError.notFound('Commande introuvable');
  }
  return order;
};

export const createRequest = async (payload, req) => {
  await assertOrderParty(payload.orderId, req.tenant.organizationId);

  const existing = await prisma.transportRequest.findFirst({
    where: {
      orderId: payload.orderId,
      status: { in: ['REQUESTED', 'OFFERED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] },
    },
  });
  if (existing) {
    throw ApiError.conflict('Une demande de transport est déjà active pour cette commande');
  }

  const request = await prisma.transportRequest.create({
    data: {
      id: resolveId(payload.id),
      orderId: payload.orderId,
      requesterOrgId: req.tenant.organizationId,
      pickup: payload.pickup ?? null,
      dropoff: payload.dropoff ?? null,
      status: 'REQUESTED',
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'transport.request.create',
    resource: 'transport_requests',
    resourceId: request.id,
    req,
    newValue: { orderId: payload.orderId, pickup: payload.pickup?.label, dropoff: payload.dropoff?.label },
  });

  return request;
};

/** Demandes ouvertes pour un transporteur, avec distance approximative. */
export const openRequests = async (query, req) => {
  const requests = await prisma.transportRequest.findMany({
    where: { status: { in: ['REQUESTED', 'OFFERED'] } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { offers: { select: { id: true, price: true, currency: true, etaDays: true } } },
  });

  const items = requests.map((r) => {
    const p = r.pickup ?? {};
    const d = r.dropoff ?? {};
    return {
      id: r.id,
      orderId: r.orderId,
      // Libellés régionaux uniquement (pas d'adresse exacte avant acceptation)
      from: { label: p.label ?? p.province ?? null, countryCode: p.countryCode ?? null },
      to: { label: d.label ?? d.province ?? null, countryCode: d.countryCode ?? null },
      approxDistanceKm:
        p.latitude != null && d.latitude != null
          ? distanceKm(Number(p.latitude), Number(p.longitude), Number(d.latitude), Number(d.longitude))
          : null,
      offersCount: r.offers.length,
      createdAt: r.createdAt,
      status: r.status,
    };
  });

  return { items, total: items.length };
};

export const createOffer = async (requestId, payload, req) => {
  const request = await prisma.transportRequest.findUnique({ where: { id: requestId } });
  if (!request) throw ApiError.notFound('Demande de transport introuvable');
  if (request.requesterOrgId === req.tenant.organizationId) {
    throw ApiError.badRequest('Tu ne peux pas répondre à ta propre demande de transport');
  }
  if (!['REQUESTED', 'OFFERED'].includes(request.status)) {
    throw ApiError.conflict('Cette demande n\'accepte plus d\'offres');
  }

  const offer = await prisma.transportOffer.create({
    data: {
      id: resolveId(),
      requestId,
      transporterOrgId: req.tenant.organizationId,
      price: payload.price,
      currency: payload.currency ?? 'USD',
      etaDays: payload.etaDays ?? null,
    },
  });

  await prisma.transportRequest.update({ where: { id: requestId }, data: { status: 'OFFERED' } });

  const members = await prisma.membership.findMany({
    where: { organizationId: request.requesterOrgId, status: 'ACTIVE' },
    select: { userId: true },
  });
  for (const member of members) {
    // eslint-disable-next-line no-await-in-loop
    await notify({
      userId: member.userId,
      type: 'transport.offer',
      title: 'Nouvelle offre de transport',
      body: `${offer.price} ${offer.currency} — ${offer.etaDays ?? '?'} jour(s)`,
      payload: { requestId, offerId: offer.id },
      dedupeKey: `transport:${offer.id}:${member.userId}`,
    });
  }

  await audit({ actorId: req.user.id, action: 'transport.offer.create', resource: 'transport_offers', resourceId: offer.id, req, newValue: { requestId, price: offer.price } });
  return offer;
};

export const acceptOffer = async (offerId, req) => {
  const offer = await prisma.transportOffer.findUnique({
    where: { id: offerId },
    include: { request: true },
  });
  if (!offer) throw ApiError.notFound('Offre de transport introuvable');
  if (offer.request.requesterOrgId !== req.tenant.organizationId) {
    throw ApiError.forbidden('Seul le demandeur peut accepter une offre');
  }
  if (!['REQUESTED', 'OFFERED'].includes(offer.request.status)) {
    throw ApiError.conflict('Demande déjà pourvue ou annulée');
  }

  const result = await prisma.$transaction(async (tx) => {
    const accepted = await tx.transportOffer.update({ where: { id: offerId }, data: { status: 'ACCEPTED' } });
    await tx.transportOffer.updateMany({
      where: { requestId: offer.requestId, id: { not: offerId }, status: 'PENDING' },
      data: { status: 'REJECTED' },
    });
    const request = await tx.transportRequest.update({
      where: { id: offer.requestId },
      data: { status: 'ASSIGNED', transporterOrgId: offer.transporterOrgId },
    });
    return { offer: accepted, request };
  });

  await audit({ actorId: req.user.id, action: 'transport.offer.accept', resource: 'transport_offers', resourceId: offerId, req });
  return result;
};

/** Transitions autorisées, contrôlées par rôle et par état courant. */
const TRANSPORT_TRANSITIONS = {
  ASSIGNED: { PICKED_UP: ['transporter'], CANCELLED: ['requester'] },
  PICKED_UP: { IN_TRANSIT: ['transporter'], FAILED: ['transporter'] },
  IN_TRANSIT: { DELIVERED: ['transporter'], FAILED: ['transporter'] },
  DELIVERED: {},
  FAILED: {},
  CANCELLED: {},
};

export const updateStatus = async (requestId, { status: target, note }, req) => {
  const request = await prisma.transportRequest.findUnique({ where: { id: requestId } });
  if (!request) throw ApiError.notFound('Demande de transport introuvable');

  const role =
    request.transporterOrgId === req.tenant.organizationId
      ? 'transporter'
      : request.requesterOrgId === req.tenant.organizationId
        ? 'requester'
        : null;
  if (!role) throw ApiError.notFound('Demande de transport introuvable');

  const allowed = TRANSPORT_TRANSITIONS[request.status] ?? {};
  if (!allowed[target] || !allowed[target].includes(role)) {
    throw ApiError.conflict(
      `Transition ${request.status} → ${target} non autorisée pour le rôle ${role}.`,
    );
  }

  // TRA-03 : pas de livraison déclarée sans preuve
  if (target === 'DELIVERED' && !request.proof) {
    throw ApiError.conflict('La preuve de livraison doit être déposée avant de déclarer la livraison');
  }

  const updated = await prisma.transportRequest.update({
    where: { id: requestId },
    data: { status: target, ...(target === 'DELIVERED' ? { proof: { ...(request.proof ?? {}), note: note ?? null } } : {}) },
  });

  await audit({
    actorId: req.user.id,
    action: 'transport.status',
    resource: 'transport_requests',
    resourceId: requestId,
    req,
    oldValue: { status: request.status },
    newValue: { status: target, note: note ?? null },
  });

  return updated;
};

/** TRA-03 — preuve de livraison : photos, réceptionnaire, signature, horodatage. */
export const proofOfDelivery = async (requestId, payload, req) => {
  const request = await prisma.transportRequest.findUnique({ where: { id: requestId } });
  if (!request) throw ApiError.notFound('Demande de transport introuvable');
  if (request.transporterOrgId !== req.tenant.organizationId) {
    throw ApiError.forbidden('Seul le transporteur assigné dépose la preuve de livraison');
  }
  if (!['PICKED_UP', 'IN_TRANSIT', 'ASSIGNED'].includes(request.status)) {
    throw ApiError.conflict(`Preuve non recevable au statut ${request.status}`);
  }

  const proof = {
    photos: payload.photos,
    receiverName: payload.receiverName,
    signatureUrl: payload.signatureUrl ?? null,
    note: payload.note ?? null,
    // Horodatage serveur : le client ne peut pas antidater une livraison
    capturedAt: new Date().toISOString(),
    depositedBy: req.user.id,
    source: 'declared',
  };

  const updated = await prisma.transportRequest.update({
    where: { id: requestId },
    data: { proof },
  });

  await audit({
    actorId: req.user.id,
    action: 'transport.pod',
    resource: 'transport_requests',
    resourceId: requestId,
    req,
    newValue: { photos: payload.photos.length, receiverName: payload.receiverName },
  });

  return { request: updated, proof, nextStep: 'PATCH /transport/requests/:id/status { status: "DELIVERED" }' };
};
