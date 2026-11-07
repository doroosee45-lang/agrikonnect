/**
 * Exigences CDC couvertes : PRC-10.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { audit } from '../../shared/audit.js';
import { notify } from '../../shared/events.js';

/**
 * TEN-01 → TEN-03 — Appels d'offres (V5).
 *
 * Un appel d'offres est public ; les réponses sont confidentielles et ne sont
 * visibles que par l'acheteur émetteur et leur auteur. Aucune réponse n'est
 * modifiable après la date limite.
 */

export const create = async (payload, req) => {
  if (payload.cropId) {
    const crop = await prisma.crop.findFirst({ where: { id: payload.cropId, deletedAt: null } });
    if (!crop) throw ApiError.badRequest('Culture inconnue dans le référentiel');
  }

  const tender = await prisma.tender.create({
    data: {
      ...payload,
      id: resolveId(payload.id),
      buyerOrgId: req.tenant.organizationId,
      status: 'OPEN',
      createdBy: req.user.id,
    },
  });

  await audit({ actorId: req.user.id, action: 'tender.create', resource: 'tenders', resourceId: tender.id, req, newValue: { title: tender.title, quantity: tender.quantity, deadline: tender.deadline } });
  return tender;
};

export const list = async (query) => {
  const { page, limit, cropId, countryCode, status } = query;

  const where = {
    ...(cropId ? { cropId } : {}),
    ...(countryCode ? { destinationCountry: countryCode } : {}),
    ...(status ? { status } : { status: 'OPEN' }),
  };

  const [items, total] = await Promise.all([
    prisma.tender.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { responses: true } } },
    }),
    prisma.tender.count({ where }),
  ]);

  return { items, total, page, limit };
};

export const getOne = async (id, req) => {
  const tender = await prisma.tender.findUnique({ where: { id } });
  if (!tender) throw ApiError.notFound('Appel d\'offres introuvable');

  const isOwner = tender.buyerOrgId === req.tenant.organizationId;
  const isAdmin = (req.user?.roles ?? []).some((r) => ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'].includes(r));

  const responses = isOwner || isAdmin
    ? await prisma.tenderResponse.findMany({ where: { tenderId: id }, orderBy: { createdAt: 'desc' } })
    : await prisma.tenderResponse.findMany({
        where: { tenderId: id, sellerOrgId: req.tenant.organizationId },
      });

  return {
    tender,
    responses,
    visibility: isOwner || isAdmin ? 'buyer_full' : 'own_responses_only',
    // Confiance : les réponses des concurrents ne sont jamais exposées
  };
};

/** TEN-02 — réponse à un appel d'offres (scellée, non modifiable après dépôt). */
export const respond = async (tenderId, payload, req) => {
  const tender = await prisma.tender.findUnique({ where: { id: tenderId } });
  if (!tender) throw ApiError.notFound('Appel d\'offres introuvable');
  if (tender.buyerOrgId === req.tenant.organizationId) {
    throw ApiError.badRequest('Tu ne peux pas répondre à ton propre appel d\'offres');
  }
  if (tender.status !== 'OPEN') throw ApiError.conflict(`Appel d'offres ${tender.status}`);
  if (tender.deadline && tender.deadline.getTime() < Date.now()) {
    throw ApiError.conflict('Date limite dépassée : aucune réponse supplémentaire n\'est acceptée');
  }

  const existing = await prisma.tenderResponse.findFirst({
    where: { tenderId, sellerOrgId: req.tenant.organizationId },
  });
  if (existing) throw ApiError.conflict('Tu as déjà répondu à cet appel d\'offres');

  const response = await prisma.tenderResponse.create({
    data: {
      id: resolveId(payload.id),
      tenderId,
      sellerOrgId: req.tenant.organizationId,
      quantity: payload.quantity,
      unit: payload.unit,
      price: payload.price,
      currency: payload.currency ?? 'USD',
      conditions: payload.conditions ?? null,
    },
  });

  await notify({
    userId: tender.createdBy ?? req.user.id,
    type: 'tender.response',
    title: 'Nouvelle réponse à votre appel d\'offres',
    body: `${tender.title} — ${payload.quantity} ${payload.unit} à ${payload.price} ${response.currency}`,
    payload: { tenderId, responseId: response.id },
    dedupeKey: `tender:${tenderId}:${response.id}`,
  }).catch(() => null);

  await audit({ actorId: req.user.id, action: 'tender.respond', resource: 'tender_responses', resourceId: response.id, req, newValue: { tenderId, price: response.price } });
  return response;
};

/** TEN-03 — adjudication : une réponse retenue, les autres rejetées. */
export const award = async (tenderId, { responseId, note }, req) => {
  const tender = await prisma.tender.findUnique({ where: { id: tenderId } });
  if (!tender) throw ApiError.notFound('Appel d\'offres introuvable');
  if (tender.buyerOrgId !== req.tenant.organizationId) {
    throw ApiError.forbidden('Seul l\'acheteur émetteur peut adjuger');
  }
  if (tender.status !== 'OPEN') throw ApiError.conflict(`Appel d'offres ${tender.status}`);

  const response = await prisma.tenderResponse.findUnique({ where: { id: responseId } });
  if (!response || response.tenderId !== tenderId) throw ApiError.notFound('Réponse introuvable');

  const result = await prisma.$transaction(async (tx) => {
    await tx.tenderResponse.update({ where: { id: responseId }, data: { status: 'ACCEPTED' } });
    await tx.tenderResponse.updateMany({
      where: { tenderId, id: { not: responseId }, status: 'PENDING' },
      data: { status: 'REJECTED' },
    });
    return tx.tender.update({ where: { id: tenderId }, data: { status: 'AWARDED' } });
  });

  await audit({ actorId: req.user.id, action: 'tender.award', resource: 'tenders', resourceId: tenderId, req, newValue: { responseId, note: note ?? null } });
  return { tender: result, awardedResponseId: responseId };
};

export const close = async (tenderId, req) => {
  const tender = await prisma.tender.findUnique({ where: { id: tenderId } });
  if (!tender) throw ApiError.notFound('Appel d\'offres introuvable');
  if (tender.buyerOrgId !== req.tenant.organizationId) {
    throw ApiError.forbidden('Seul l\'acheteur émetteur peut clôturer');
  }

  const updated = await prisma.tender.update({ where: { id: tenderId }, data: { status: 'CLOSED' } });
  await audit({ actorId: req.user.id, action: 'tender.close', resource: 'tenders', resourceId: tenderId, req });
  return updated;
};
