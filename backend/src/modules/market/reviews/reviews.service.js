/**
 * Exigences CDC couvertes : REV-01, REV-02, REV-03, MOD-02.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../../config/prisma.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { resolveId } from '../../../shared/ids.js';
import { audit } from '../../../shared/audit.js';

/**
 * Avis et réputation (CDC V2 §5.7).
 * - Un avis uniquement après une commande DELIVERED ou COMPLETED.
 * - Un seul avis par partie et par commande.
 * - Affichage du nombre d'avis en plus de la moyenne (pas de note « sèche »).
 */

export const createForOrder = async (orderId, { rating, comment }, req) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.deletedAt) throw ApiError.notFound('Commande introuvable');

  const isBuyer = order.buyerOrgId === req.tenant.organizationId;
  const isSeller = order.sellerOrgId === req.tenant.organizationId;
  if (!isBuyer && !isSeller) throw ApiError.notFound('Commande introuvable');

  if (!['DELIVERED', 'COMPLETED'].includes(order.status)) {
    throw ApiError.conflict('Un avis ne peut être déposé qu\'après livraison');
  }

  const targetOrgId = isBuyer ? order.sellerOrgId : order.buyerOrgId;

  const existing = await prisma.review.findUnique({
    where: { orderId_authorOrgId: { orderId, authorOrgId: req.tenant.organizationId } },
  });
  if (existing) throw ApiError.conflict('Tu as déjà laissé un avis sur cette commande');

  const review = await prisma.review.create({
    data: {
      id: resolveId(),
      orderId,
      authorOrgId: req.tenant.organizationId,
      targetOrgId,
      rating,
      comment: comment ?? null,
    },
  });

  await audit({ actorId: req.user.id, action: 'review.create', resource: 'reviews', resourceId: review.id, req, newValue: { orderId, rating } });
  return review;
};

/** Droit de réponse de la partie évaluée. */
export const respond = async (reviewId, { response }, req) => {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw ApiError.notFound('Avis introuvable');
  if (review.targetOrgId !== req.tenant.organizationId) {
    throw ApiError.forbidden('Seule la partie évaluée peut répondre');
  }

  const updated = await prisma.review.update({ where: { id: reviewId }, data: { response } });
  await audit({ actorId: req.user.id, action: 'review.respond', resource: 'reviews', resourceId: reviewId, req });
  return updated;
};

export const report = async (reviewId, req) => {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw ApiError.notFound('Avis introuvable');

  const updated = await prisma.review.update({ where: { id: reviewId }, data: { status: 'FLAGGED' } });
  await audit({ actorId: req.user.id, action: 'review.report', resource: 'reviews', resourceId: reviewId, req });
  return updated;
};

/** Réputation publique d'une organisation : moyenne ET volume d'avis. */
export const reputation = async (organizationId) => {
  const [aggregate, distribution] = await Promise.all([
    prisma.review.aggregate({
      where: { targetOrgId: organizationId, status: 'PUBLISHED' },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.review.groupBy({
      by: ['rating'],
      where: { targetOrgId: organizationId, status: 'PUBLISHED' },
      _count: { _all: true },
    }),
  ]);

  return {
    average: aggregate._avg.rating ? Math.round(aggregate._avg.rating * 10) / 10 : null,
    count: aggregate._count._all,
    distribution: distribution.reduce((acc, d) => ({ ...acc, [d.rating]: d._count._all }), {}),
    // Sans avis, on affiche null — jamais une note inventée
    note: aggregate._count._all === 0 ? 'Aucun avis pour le moment' : undefined,
  };
};

/**
 * MOD-02 — décision de modération sur un avis signalé.
 *
 * Un avis n'est jamais supprimé : il est masqué (`HIDDEN`) ou remis en ligne
 * (`PUBLISHED`), la trace restant en base et dans le journal d'audit.
 */
export const moderate = async (reviewId, { decision, reason }, req) => {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw ApiError.notFound('Avis introuvable');

  const status = decision === 'REMOVE' ? 'HIDDEN' : 'PUBLISHED';
  const updated = await prisma.review.update({ where: { id: reviewId }, data: { status } });

  await audit({
    actorId: req.user.id,
    action: 'review.moderate',
    resource: 'reviews',
    resourceId: reviewId,
    req,
    oldValue: { status: review.status },
    newValue: { status, decision, reason },
  });

  return {
    review: updated,
    decision,
    retention: 'Avis conservé : masqué côté public, jamais supprimé.',
  };
};
