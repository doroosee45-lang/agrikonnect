/**
 * SPEC-SUPER-ADMIN M4 — modération unifiée des flux métier (§3 U-M4-2).
 *
 * RG-M4-1 : **aucune écriture métier directe** — chaque décision est déléguée
 * au service existant (`listings.moderate`, `reviews.moderate`,
 * `verification.review`) qui porte ses propres règles (statuts, transitions,
 * audit `listing.moderate` / `review.moderate` / `verification.*`).
 *
 * RG-M4-2 : toute action de modération **notifie l'acteur concerné** (le
 * propriétaire de l'élément) via `shared/events.notify`, en plus de l'audit
 * métier déjà assuré par le service délégué.
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { logger } from '../../shared/http/logger.js';
import { notify } from '../../shared/events.js';
import { paginationArgs, orderBy } from '../../shared/pagination.js';
import { moderate as moderateListing } from '../market/listings/listings.service.js';
import { moderate as moderateReview } from '../market/reviews/reviews.service.js';
import { review as reviewVerification } from '../verification/verification.service.js';

/**
 * Table de routage : entité → service métier + propriétaire notifié.
 * `proprietaire` renvoie l'utilisateur à prévenir (RG-M4-2).
 */
const ROUTES = {
  listing: {
    resource: 'listings',
    model: () => prisma.listing,
    libelle: (item) => item.title ?? item.id,
    base: { deletedAt: null },
    proprietaire: (item) => item.createdBy ?? null,
    appliquer: (id, decision, reason, req) => {
      const status = decision === 'approve' ? 'PUBLISHED' : decision === 'reject' ? 'HIDDEN' : 'ARCHIVED';
      return moderateListing(id, { status, reason }, req);
    },
  },
  review: {
    resource: 'reviews',
    model: () => prisma.review,
    libelle: (item) => `Avis ${String(item.rating ?? '')}`.trim(),
    base: {},
    proprietaire: async (item) => {
      const org = await prisma.organization.findUnique({
        where: { id: item.authorOrgId },
        select: { createdBy: true },
      });
      return org?.createdBy ?? null;
    },
    appliquer: (id, decision, reason, req) =>
      moderateReview(id, { decision: decision === 'approve' ? 'KEEP' : 'REMOVE', reason }, req),
  },
  verification: {
    resource: 'verifications',
    model: () => prisma.verification,
    libelle: (item) => `${item.subjectType} ${item.subjectId}`,
    base: {},
    proprietaire: async (item) => {
      const org = await prisma.organization.findUnique({
        where: { id: item.organizationId },
        select: { createdBy: true },
      });
      return org?.createdBy ?? null;
    },
    appliquer: (id, decision, reason, req) => {
      if (decision === 'suspend') {
        throw ApiError.badRequest(
          'La suspension ne s applique pas aux demandes de vérification (statuts : PENDING, APPROVED, REJECTED)',
          [{ field: 'decision', code: 'unsupported' }],
        );
      }
      return reviewVerification(id, { status: decision === 'approve' ? 'APPROVED' : 'REJECTED', reason }, req);
    },
  },
};

const routeDe = (entity) => {
  const route = ROUTES[entity];
  if (!route) throw ApiError.badRequest(`Entité de modération inconnue : ${entity}`);
  return route;
};

/** U-M4-2 — file de modération : liste filtrable, paginée, lue en direct. */
export const file = async (entity, query) => {
  const route = routeDe(entity);
  const { page, limit, status } = query;
  const where = { ...route.base, ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([
    route.model().findMany({ where, orderBy: orderBy('createdAt', 'desc', ['createdAt']), ...paginationArgs({ page, limit }) }),
    route.model().count({ where }),
  ]);
  return {
    items: items.map((item) => ({
      id: item.id,
      entity,
      label: route.libelle(item),
      status: item.status ?? null,
      createdAt: item.createdAt ?? null,
      raw: item,
    })),
    total,
    page: Number(page),
    limit: Number(limit),
  };
};

/** U-M4-2 — fiche détail d'un élément à modérer. */
export const detail = async (entity, id) => {
  const route = routeDe(entity);
  const item = await route.model().findUnique({ where: { id } });
  if (!item) throw ApiError.notFound('Élément introuvable');
  return { id: item.id, entity, label: route.libelle(item), status: item.status ?? null, raw: item };
};

/**
 * U-M4-2 / RG-M4-1 / RG-M4-2 — décision motivée : délégation au service
 * métier, notification du propriétaire, retour de l'état final.
 */
export const moderate = async (entity, id, { decision, reason }, req) => {
  const route = routeDe(entity);
  const avant = await route.model().findUnique({ where: { id } });
  if (!avant) throw ApiError.notFound('Élément introuvable');

  const resultat = await route.appliquer(id, decision, reason, req);

  // RG-M4-2 — l'acteur concerné est prévenu ; l'audit métier est déjà écrit
  // par le service délégué (jamais d'écriture directe ici).
  const destinataire = await route.proprietaire(avant);
  if (destinataire) {
    try {
      await notify({
        userId: destinataire,
        type: `moderation.${entity}`,
        title: `Décision de modération : ${route.libelle(avant)}`,
        body: `Décision « ${decision} » — motif : ${reason}`,
        channels: ['IN_APP'],
        payload: { entity, id, decision, reason },
      });
    } catch (error) {
      logger.warn('Notification de modération non remise :', error.message);
    }
  }

  const apres = await route.model().findUnique({ where: { id } });
  return {
    entity,
    id,
    decision,
    notified: Boolean(destinataire),
    before: { status: avant.status ?? null },
    after: { status: apres?.status ?? null },
    result: resultat,
  };
};
