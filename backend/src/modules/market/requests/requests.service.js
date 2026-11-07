/**
 * Exigences CDC couvertes : REQ-01, REQ-02, REQ-03, REQ-05.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../../config/prisma.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { resolveId } from '../../../shared/ids.js';
import { paginationArgs, orderBy } from '../../../shared/pagination.js';
import { matchListingToRequest } from '../../../shared/matching.js';
import { assertOwnership } from '../../../middleware/tenant.js';
import { audit } from '../../../shared/audit.js';
import { notify } from '../../../shared/events.js';
import { logger } from '../../../shared/http/logger.js';

/**
 * REQ-01 → REQ-05 — Demandes d'achat et matching explicable.
 */

export const create = async (payload, req) => {
  const request = await prisma.purchaseRequest.create({
    data: {
      ...payload,
      id: resolveId(payload.id),
      buyerOrgId: req.tenant.organizationId,
      createdBy: req.user.id,
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'purchaseRequest.create',
    resource: 'purchase_requests',
    resourceId: request.id,
    req,
    newValue: { cropId: request.cropId, quantity: request.quantity, unit: request.unit },
  });

  // REQ-03 : notification des producteurs compatibles, avec plafond anti-spam
  const notified = await notifyCompatibleSellers(request).catch((error) => {
    logger.warn('Notification des producteurs compatibles :', error.message);
    return 0;
  });

  return { request, notificationsSent: notified };
};

/**
 * Notification ciblée : on ne diffuse pas à tout le monde, seulement aux
 * organisations ayant une annonce publiée compatible (plafond par utilisateur).
 */
const notifyCompatibleSellers = async (request, limit = 20) => {
  const candidates = await prisma.listing.findMany({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
      cropId: request.cropId,
      quantity: { gte: Number(request.quantity) * 0.25 },
    },
    select: { organizationId: true, id: true, quantity: true, unit: true },
    take: 100,
  });

  const orgIds = [...new Set(candidates.map((c) => c.organizationId))].slice(0, limit);

  for (const organizationId of orgIds) {
    const membership = await prisma.membership.findFirst({
      where: { organizationId, status: 'ACTIVE' },
      select: { userId: true },
    });
    if (!membership) continue;

    // eslint-disable-next-line no-await-in-loop
    await notify({
      userId: membership.userId,
      type: 'purchase_request.match',
      title: 'Une demande d\'achat correspond à votre production',
      body: `${request.title} — ${request.quantity} ${request.unit}`,
      payload: { requestId: request.id },
      dedupeKey: `req:${request.id}:${membership.userId}`,
    });
  }

  await prisma.purchaseRequest.update({
    where: { id: request.id },
    data: { status: 'MATCHED' },
  }).catch(() => {});

  return orgIds.length;
};

/**
 * REQ-02 / REQ-05 — matching déterministe et explicable.
 * Les coordonnées ne sont jamais exposées : seuls le slug public et des
 * indicateurs agrégés le sont (REQ-05).
 */
export const matches = async (requestId, query, req) => {
  const request = await prisma.purchaseRequest.findUnique({
    where: { id: requestId },
    include: { },
  });
  if (!request || request.deletedAt) throw ApiError.notFound('Demande introuvable');
  if (request.buyerOrgId !== req.tenant.organizationId) throw ApiError.notFound('Demande introuvable');

  const limit = Math.min(Number(query.limit ?? 50), 100);

  const listings = await prisma.listing.findMany({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
      ...(request.cropId ? { cropId: request.cropId } : {}),
    },
    take: 300,
  });

  // Vérification du vendeur (critère de tri explicite)
  const orgIds = [...new Set(listings.map((l) => l.organizationId))];
  const orgs = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true, slug: true, type: true, countryCode: true },
  });
  const orgById = new Map(orgs.map((o) => [o.id, o]));

  const evaluated = listings.map((listing) => {
    const org = orgById.get(listing.organizationId);
    const result = matchListingToRequest(
      { ...listing, verifiedSeller: Boolean(org?.type !== 'INDIVIDUAL') },
      request,
      { minVolumeRatio: Number(query.minVolumeRatio ?? 0.25), maxDistanceKm: Number(query.maxDistanceKm ?? 300) },
    );

    return {
      listingId: listing.id,
      title: listing.title,
      // Aucune coordonnée : contact seulement après accord des parties
      seller: { name: org?.name ?? null, type: org?.type ?? null, countryCode: org?.countryCode ?? null },
      quantity: listing.quantity,
      unit: listing.unit,
      indicativePrice: listing.indicativePrice,
      currency: listing.currency,
      ...result,
    };
  });

  const sorted = evaluated
    .filter((m) => m.matched > 0)
    .sort((a, b) => {
      if (b.rank.byCriteria !== a.rank.byCriteria) return b.rank.byCriteria - a.rank.byCriteria;
      if (b.rank.verifiedSeller !== a.rank.verifiedSeller) return Number(b.rank.verifiedSeller) - Number(a.rank.verifiedSeller);
      return new Date(b.rank.freshness ?? 0) - new Date(a.rank.freshness ?? 0);
    })
    .slice(0, limit);

  return {
    request: {
      id: request.id,
      title: request.title,
      cropId: request.cropId,
      quantity: request.quantity,
      unit: request.unit,
      neededBy: request.neededBy,
    },
    results: sorted,
    order: sorted[0]?.explainingOrder ?? null,
    confidentiality:
      'Aucune coordonnée du vendeur n\'est exposée avant accord mutuel (REQ-05).',
  };
};

export const list = async (query, req) => {
  const { page, limit, sort, order, status, cropId } = query;

  const where = {
    buyerOrgId: req.tenant.organizationId,
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(cropId ? { cropId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.purchaseRequest.findMany({
      where,
      ...paginationArgs({ page, limit }),
      orderBy: orderBy(sort, order, ['createdAt', 'neededBy']),
    }),
    prisma.purchaseRequest.count({ where }),
  ]);

  return { items, total, page, limit };
};

export const getOne = async (id, req) => {
  const request = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!request || request.deletedAt) throw ApiError.notFound('Demande introuvable');
  assertOwnership(
    { organizationId: request.buyerOrgId, deletedAt: request.deletedAt },
    req.tenant.organizationId,
    'Demande',
  );
  const offers = await prisma.offer.findMany({ where: { requestId: id }, orderBy: { createdAt: 'desc' } });
  return { request, offers };
};

export const update = async (id, payload, req) => {
  const request = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!request || request.deletedAt) throw ApiError.notFound('Demande introuvable');
  assertOwnership(
    { organizationId: request.buyerOrgId, deletedAt: request.deletedAt },
    req.tenant.organizationId,
    'Demande',
  );
  if (request.status !== 'OPEN' && request.status !== 'MATCHED') {
    throw ApiError.conflict('Une demande clôturée ne peut plus être modifiée');
  }

  const updated = await prisma.purchaseRequest.update({
    where: { id },
    data: { ...payload, version: { increment: 1 } },
  });

  await audit({ actorId: req.user.id, action: 'purchaseRequest.update', resource: 'purchase_requests', resourceId: id, req, newValue: payload });
  return updated;
};
