/**
 * Exigences CDC couvertes : MKT-01, MKT-02, MKT-03, MKT-04, MKT-05, MOD-01.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../../config/prisma.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { resolveId } from '../../../shared/ids.js';
import { paginationArgs, orderBy } from '../../../shared/pagination.js';
import { assertOwnership } from '../../../middleware/tenant.js';
import { audit } from '../../../shared/audit.js';

/**
 * MKT-01 → MKT-06 — Annonces marketplace.
 * Cycle de vie : DRAFT → PUBLISHED → RESERVED → SOLD_OUT → EXPIRED / ARCHIVED.
 */

/** Nombre maximal de photos par annonce. */
export const MAX_PHOTOS = 10;

/**
 * `Listing` ne porte pas de relation Prisma vers `Crop` (découplage volontaire
 * des modules V2+). Les cultures et les photos sont donc jointes explicitement.
 */
const attachRelations = async (listings) => {
  if (listings.length === 0) return listings;

  const cropIds = [...new Set(listings.map((l) => l.cropId).filter(Boolean))];
  const listingIds = listings.map((l) => l.id);

  const [crops, photos] = await Promise.all([
    cropIds.length
      ? prisma.crop.findMany({
          where: { id: { in: cropIds } },
          select: { id: true, slug: true, names: true },
        })
      : [],
    prisma.media.findMany({
      where: { listingId: { in: listingIds }, deletedAt: null },
      orderBy: { position: 'asc' },
      select: { id: true, listingId: true, url: true, storageKey: true, caption: true, position: true, width: true, height: true },
    }),
  ]);

  const cropById = new Map(crops.map((c) => [c.id, c]));
  const photosByListing = new Map();
  for (const photo of photos) {
    if (!photosByListing.has(photo.listingId)) photosByListing.set(photo.listingId, []);
    photosByListing.get(photo.listingId).push(photo);
  }

  return listings.map((listing) => ({
    ...listing,
    crop: listing.cropId ? cropById.get(listing.cropId) ?? null : null,
    photos: photosByListing.get(listing.id) ?? [],
  }));
};

/** Expiration automatique (MKT-04) : appelée avant chaque lecture publique. */
export const expireStale = async () => {
  await prisma.listing.updateMany({
    where: {
      status: { in: ['PUBLISHED', 'RESERVED'] },
      expiresAt: { lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  });
};

/**
 * MKT-03 — recherche avancée. Seules les annonces PUBLISHED sont visibles,
 * sauf pour le propriétaire (`mine=true`).
 */
export const search = async (query, req) => {
  const {
    page, limit, sort, order, q, cropId, type, countryCode, province,
    minQuantity, maxQuantity, minPrice, maxPrice, certification, sellerType, mine,
  } = query;

  await expireStale();

  const isMine = mine === 'true';

  // Filtre « type de vendeur » résolu en amont pour rester dans la requête SQL
  // (sinon la pagination et le total seraient faux).
  let allowedOrgIds = null;
  if (sellerType) {
    const orgs = await prisma.organization.findMany({
      where: { type: sellerType },
      select: { id: true },
      take: 5000,
    });
    allowedOrgIds = orgs.map((o) => o.id);
    if (allowedOrgIds.length === 0) {
      return { items: [], total: 0, page, limit, filtersApplied: { sellerType } };
    }
  }

  const where = {
    deletedAt: null,
    ...(isMine ? { organizationId: req.tenant.organizationId } : { status: 'PUBLISHED' }),
    ...(allowedOrgIds ? { organizationId: { in: allowedOrgIds } } : {}),
    ...(cropId ? { cropId } : {}),
    ...(type ? { type } : {}),
    ...(countryCode ? { countryCode } : {}),
    ...(province ? { province } : {}),
    ...(minQuantity || maxQuantity
      ? { quantity: { ...(minQuantity ? { gte: minQuantity } : {}), ...(maxQuantity ? { lte: maxQuantity } : {}) } }
      : {}),
    ...(minPrice || maxPrice
      ? { indicativePrice: { ...(minPrice ? { gte: minPrice } : {}), ...(maxPrice ? { lte: maxPrice } : {}) } }
      : {}),
    ...(certification ? { certifications: { has: certification } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      ...paginationArgs({ page, limit }),
      orderBy: orderBy(sort, order, ['createdAt', 'updatedAt', 'indicativePrice', 'quantity']),
    }),
    prisma.listing.count({ where }),
  ]);

  return {
    items: await attachRelations(rows),
    total,
    page,
    limit,
    filtersApplied: Object.fromEntries(
      Object.entries({ q, cropId, type, countryCode, province, minQuantity, maxQuantity, minPrice, maxPrice, certification, sellerType })
        .filter(([, v]) => v !== undefined),
    ),
  };
};

const isAdmin = (req) =>
  (req.user?.roles ?? []).some((r) => ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'].includes(r));

export const getOne = async (id, req) => {
  const raw = await prisma.listing.findUnique({ where: { id } });
  if (!raw || raw.deletedAt) throw ApiError.notFound('Annonce introuvable');

  const [listing] = await attachRelations([raw]);

  const isOwner = req.user?.memberships?.some((m) => m.organizationId === listing.organizationId);
  // Un brouillon n'est JAMAIS public (critère d'acceptation MKT)
  if (listing.status !== 'PUBLISHED' && !isOwner && !isAdmin(req)) {
    throw ApiError.notFound('Annonce introuvable');
  }

  const [reviewAggregate, ordersCount] = await Promise.all([
    prisma.review.aggregate({
      where: { targetOrgId: listing.organizationId, status: 'PUBLISHED' },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.order.count({ where: { sellerOrgId: listing.organizationId } }),
  ]);

  return {
    ...listing,
    seller: {
      organizationId: listing.organizationId,
      // Réputation affichée avec son volume : une moyenne seule serait trompeuse
      rating: reviewAggregate._avg.rating ? Math.round(reviewAggregate._avg.rating * 10) / 10 : null,
      reviewsCount: reviewAggregate._count._all,
      completedOrders: ordersCount,
    },
    contactPolicy:
      'Les coordonnées ne sont pas exposées. Utilise POST /listings/:id/contact pour ouvrir un fil de discussion.',
  };
};

export const create = async (payload, req) => {
  if (payload.cropId) {
    const crop = await prisma.crop.findFirst({ where: { id: payload.cropId, deletedAt: null } });
    if (!crop) throw ApiError.badRequest('Culture inconnue dans le référentiel');
  }

  const created = await prisma.listing.create({
    data: {
      ...payload,
      id: resolveId(payload.id),
      organizationId: req.tenant.organizationId,
      status: 'DRAFT',
      createdBy: req.user.id,
    },
  });
  const [listing] = await attachRelations([created]);

  await audit({
    actorId: req.user.id,
    action: 'listing.create',
    resource: 'listings',
    resourceId: listing.id,
    req,
    newValue: { title: listing.title, quantity: listing.quantity, unit: listing.unit },
  });

  return listing;
};

export const update = async (id, payload, req) => {
  const listing = assertOwnership(
    await prisma.listing.findUnique({ where: { id } }),
    req.tenant.organizationId,
    'Annonce',
  );

  // Une annonce vendue ou archivée ne se modifie plus
  if (['SOLD_OUT', 'ARCHIVED', 'EXPIRED'].includes(listing.status)) {
    throw ApiError.conflict(`Annonce non modifiable (statut ${listing.status})`);
  }

  const raw = await prisma.listing.update({
    where: { id },
    data: { ...payload, version: { increment: 1 } },
  });
  const [updated] = await attachRelations([raw]);

  await audit({
    actorId: req.user.id,
    action: 'listing.update',
    resource: 'listings',
    resourceId: id,
    req,
    oldValue: { title: listing.title, status: listing.status },
    newValue: payload,
  });

  return updated;
};

/** MKT-04 — transitions de statut contrôlées côté serveur. */
const STATUS_TRANSITIONS = {
  DRAFT: ['PUBLISHED', 'ARCHIVED'],
  PUBLISHED: ['ARCHIVED', 'DRAFT'],
  RESERVED: ['PUBLISHED', 'SOLD_OUT', 'ARCHIVED'],
  SOLD_OUT: ['ARCHIVED'],
  EXPIRED: ['PUBLISHED', 'DRAFT', 'ARCHIVED'],
  HIDDEN: ['PUBLISHED', 'ARCHIVED'],
  ARCHIVED: [],
};

export const changeStatus = async (id, status, req) => {
  const listing = assertOwnership(
    await prisma.listing.findUnique({ where: { id } }),
    req.tenant.organizationId,
    'Annonce',
  );

  if (!(STATUS_TRANSITIONS[listing.status] ?? []).includes(status)) {
    throw ApiError.conflict(`Transition interdite : ${listing.status} → ${status}`);
  }

  const warnings = [];

  // Une annonce sans quantité ne peut pas être publiée (donnée incohérente).
  if (status === 'PUBLISHED') {
    const fresh = await prisma.listing.findUnique({ where: { id }, select: { quantity: true } });
    if (Number(fresh?.quantity ?? 0) <= 0) {
      throw ApiError.badRequest('Publication impossible : quantité nulle ou négative');
    }

    // Les photos ne sont pas bloquantes (le producteur peut publier depuis le
    // terrain avec une connexion faible) mais l'absence est signalée : une
    // annonce sans visuel convertit nettement moins (MKT-01).
    const photoCount = await prisma.media.count({ where: { listingId: id, deletedAt: null } });
    if (photoCount === 0) {
      warnings.push({
        field: 'photos',
        code: 'recommended',
        message: 'Aucune photo : ajoute-en via POST /media/upload-url avec listingId pour être visible.',
      });
    }
  }

  const updated = await prisma.listing.update({
    where: { id },
    data: { status, version: { increment: 1 } },
  });

  await audit({
    actorId: req.user.id,
    action: 'listing.status',
    resource: 'listings',
    resourceId: id,
    req,
    oldValue: { status: listing.status },
    newValue: { status },
  });

  return { listing: updated, warnings };
};

/** MKT-05 — modération : masquage motivé et tracé. */
/** États qu'une décision de modération peut imposer (jamais un état métier). */
export const MODERATION_STATUSES = ['HIDDEN', 'PUBLISHED', 'ARCHIVED'];

export const moderate = async (id, { status: target, reason }, req) => {
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) throw ApiError.notFound('Annonce introuvable');

  // MKT-05 — aucune décision de modération sans motif écrit : le producteur
  // doit savoir quoi corriger, et la trace d'audit doit être exploitable même
  // si l'appel ne passe pas par la validation HTTP (tâche, script, service).
  if (!String(reason ?? '').trim()) {
    throw ApiError.badRequest(
      'Un motif écrit est obligatoire pour toute décision de modération',
      [{ field: 'reason', code: 'required' }],
    );
  }

  if (!MODERATION_STATUSES.includes(target)) {
    throw ApiError.badRequest(
      `Décision de modération invalide : ${target}. Valeurs acceptées : ${MODERATION_STATUSES.join(', ')}`,
      [{ field: 'status', code: 'invalid' }],
    );
  }

  const updated = await prisma.listing.update({ where: { id }, data: { status: target } });

  await audit({
    actorId: req.user.id,
    action: 'listing.moderate',
    resource: 'listings',
    resourceId: id,
    req,
    oldValue: { status: listing.status },
    newValue: { status: target, reason },
  });

  return updated;
};

/**
 * MKT-06 — contacter le vendeur sans divulguer ses coordonnées (REQ-05).
 * Crée (ou réutilise) le fil rattaché à l'annonce via le module messagerie.
 */
export const contactSeller = async (id, { message }, req) => {
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing || listing.deletedAt) throw ApiError.notFound('Annonce introuvable');
  if (listing.status !== 'PUBLISHED') throw ApiError.conflict('Cette annonce n\'est pas publiée');
  if (listing.organizationId === req.tenant.organizationId) {
    throw ApiError.badRequest('Tu ne peux pas contacter ta propre annonce');
  }

  const { startConversation } = await import('../../messaging/messaging.service.js');

  const result = await startConversation(
    {
      subjectType: 'LISTING',
      subjectId: id,
      participantOrgIds: [listing.organizationId],
      firstMessage: message,
    },
    req,
  );

  await audit({
    actorId: req.user.id,
    action: 'listing.contact',
    resource: 'listings',
    resourceId: id,
    req,
    newValue: { conversationId: result.conversation.id },
  });

  return result;
};

export const archive = async (id, req) => {
  assertOwnership(await prisma.listing.findUnique({ where: { id } }), req.tenant.organizationId, 'Annonce');
  await prisma.listing.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });
  await audit({ actorId: req.user.id, action: 'listing.archive', resource: 'listings', resourceId: id, req });
  return { archived: true };
};

/**
 * MKT-02 — rattachement de médias déjà téléversés à une annonce.
 *
 * Les fichiers sont d'abord envoyés via `/media/upload-url` (propriété de
 * l'organisation vérifiée), puis rattachés ici : une annonce ne peut donc
 * jamais pointer vers le visuel d'une autre exploitation.
 *
 * `MAX_PHOTOS` s'applique au total, pas à l'appel : l'ajout au-delà est refusé.
 */
export const attachPhotos = async (listingId, { mediaIds }, req) => {
  const listing = assertOwnership(
    await prisma.listing.findUnique({ where: { id: listingId } }),
    req.tenant.organizationId,
    'Annonce',
  );

  const unique = [...new Set(mediaIds)];
  const medias = await prisma.media.findMany({
    where: { id: { in: unique }, organizationId: req.tenant.organizationId, deletedAt: null },
  });

  if (medias.length !== unique.length) {
    throw ApiError.badRequest('Un ou plusieurs médias sont introuvables ou ne t\'appartiennent pas', [
      { field: 'mediaIds', code: 'not_found' },
    ]);
  }

  const existing = await prisma.media.findMany({
    where: { listingId, deletedAt: null },
    orderBy: { position: 'asc' },
    select: { id: true, position: true },
  });

  const alreadyAttached = new Set(existing.map((m) => m.id));
  const toAttach = unique.filter((id) => !alreadyAttached.has(id));

  if (existing.length + toAttach.length > MAX_PHOTOS) {
    throw ApiError.badRequest(`Maximum ${MAX_PHOTOS} photos par annonce`, [
      { field: 'mediaIds', code: 'too_many' },
    ]);
  }

  const startPosition = existing.length === 0 ? 0 : Math.max(...existing.map((m) => m.position)) + 1;

  await prisma.$transaction(async (tx) => {
    for (const [index, id] of toAttach.entries()) {
      await tx.media.update({ where: { id }, data: { listingId, position: startPosition + index } });
    }
  });

  const photos = await prisma.media.findMany({
    where: { listingId, deletedAt: null },
    orderBy: { position: 'asc' },
  });

  await audit({
    actorId: req.user.id,
    action: 'listing.photos',
    resource: 'listings',
    resourceId: listing.id,
    req,
    newValue: { added: toAttach.length, total: photos.length },
  });

  return {
    listing: { id: listing.id, title: listing.title, status: listing.status },
    photos,
    added: toAttach.length,
    skipped: unique.length - toAttach.length,
  };
};
