/**
 * Exigences CDC couvertes : COOP-10.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { audit } from '../../shared/audit.js';

/**
 * COOP-10 — offre groupée construite à partir de la disponibilité DÉCLARÉE
 * des membres.
 *
 * Règles :
 *  - seules les productions des membres ayant consenti à la portée
 *    « productions » sont agrégées (consentement vérifiable, révocable) ;
 *  - aucune quantité n'est inventée : les unités non convertibles en kg sont
 *    écartées et listées comme telles ;
 *  - la répartition est figée au moment du calcul et stockée avec l'offre :
 *    elle est auditable et reproductible ;
 *  - l'offre ne devient une annonce qu'après confirmation explicite.
 */

const assertCooperative = async (cooperativeId, organizationId) => {
  const cooperative = await prisma.cooperative.findUnique({ where: { id: cooperativeId } });
  if (!cooperative || cooperative.organizationId !== organizationId || cooperative.deletedAt) {
    throw ApiError.notFound('Coopérative introuvable');
  }
  return cooperative;
};

const toKg = (production) => {
  if (production.quantityKg !== null && production.quantityKg !== undefined) return production.quantityKg;
  if (production.unit === 'kg') return production.quantity;
  if (production.unit === 't') return production.quantity * 1000;
  return null;
};

/**
 * Calcule le pool disponible par membre, sans rien décider à leur place.
 */
export const previewPool = async (cooperativeId, { cropId, season }, req) => {
  await assertCooperative(cooperativeId, req.tenant.organizationId);

  const members = await prisma.cooperativeMember.findMany({
    where: { cooperativeId, status: 'ACTIVE' },
  });

  const consented = members.filter((m) => m.consentScopes.includes('productions'));
  const excluded = members
    .filter((m) => !m.consentScopes.includes('productions'))
    .map((m) => ({ memberUserId: m.memberUserId, reason: 'consentement « productions » absent' }));

  const memberships = consented.length
    ? await prisma.membership.findMany({
        where: { userId: { in: consented.map((m) => m.memberUserId) }, status: 'ACTIVE' },
      })
    : [];

  const orgByUser = new Map(memberships.map((m) => [m.userId, m.organizationId]));
  const userByOrg = new Map(memberships.map((m) => [m.organizationId, m.userId]));

  const organizations = [...new Set(consented.map((m) => orgByUser.get(m.memberUserId)).filter(Boolean))];

  const productions = organizations.length
    ? await prisma.production.findMany({
        where: {
          organizationId: { in: organizations },
          cropId,
          deletedAt: null,
          ...(season ? { season } : {}),
        },
      })
    : [];

  const lines = [];
  const unconvertible = [];

  for (const production of productions) {
    const kg = toKg(production);
    if (kg === null) {
      unconvertible.push({
        productionId: production.id,
        unit: production.unit,
        reason: 'unité non convertible en kg — quantité non agrégée',
      });
      continue;
    }
    const userId = userByOrg.get(production.organizationId) ?? null;
    lines.push({
      memberUserId: userId,
      memberOrganizationId: production.organizationId,
      productionId: production.id,
      quantity: production.quantity,
      unit: production.unit,
      quantityKg: kg,
      harvestedAt: production.harvestedAt,
      quality: production.quality ?? null,
      source: production.source,
    });
  }

  const totalKg = lines.reduce((sum, line) => sum + line.quantityKg, 0);

  const split = Object.values(
    lines.reduce((acc, line) => {
      const key = line.memberOrganizationId;
      acc[key] = acc[key] ?? {
        memberUserId: line.memberUserId,
        memberOrganizationId: key,
        quantityKg: 0,
        productionIds: [],
        quality: null,
      };
      acc[key].quantityKg += line.quantityKg;
      acc[key].productionIds.push(line.productionId);
      acc[key].quality = acc[key].quality ?? line.quality;
      return acc;
    }, {}),
  )
    .map((entry) => ({
      ...entry,
      quantityKg: Math.round(entry.quantityKg * 1000) / 1000,
      share: totalKg > 0 ? Math.round((entry.quantityKg / totalKg) * 10000) / 10000 : 0,
    }))
    .sort((a, b) => b.quantityKg - a.quantityKg);

  return {
    cooperativeId,
    cropId,
    season: season ?? null,
    totalKg: Math.round(totalKg * 1000) / 1000,
    memberCount: split.length,
    split,
    lines,
    unconvertible,
    excludedMembers: excluded,
    policy: {
      consent: 'Seules les productions des membres ayant consenti sont agrégées.',
      noInvention: 'Les unités non convertibles ne sont jamais converties arbitrairement.',
      splitFrozen: 'La répartition est figée au moment de la création de l’offre.',
    },
  };
};

export const createGroupOffer = async (cooperativeId, payload, req) => {
  const cooperative = await assertCooperative(cooperativeId, req.tenant.organizationId);
  const pool = await previewPool(cooperativeId, payload, req);

  if (!pool.split.length || pool.totalKg <= 0) {
    throw ApiError.conflict(
      'Aucune disponibilité déclarée et consentie pour cette culture : aucune offre groupée ne peut être créée',
      { cropId: payload.cropId, season: payload.season ?? null },
    );
  }

  const organization = await prisma.organization.findUnique({
    where: { id: cooperative.organizationId },
  });

  const offer = await prisma.groupOffer.create({
    data: {
      id: resolveId(payload.id),
      cooperativeId,
      cropId: payload.cropId,
      title: payload.title,
      quantity: pool.totalKg,
      unit: 'kg',
      quality: payload.quality ?? null,
      pricePerUnit: payload.pricePerUnit ?? null,
      currency: payload.currency ?? 'USD',
      countryCode: payload.countryCode ?? organization?.countryCode ?? 'CD',
      status: 'PROPOSED',
      split: { members: pool.split, totalKg: pool.totalKg, unconvertible: pool.unconvertible },
      basis: {
        membersConsented: pool.memberCount,
        excludedMembers: pool.excludedMembers,
        season: payload.season ?? null,
        computedAt: new Date().toISOString(),
      },
      createdBy: req.user.id,
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'coop.groupoffer.create',
    resource: 'group_offers',
    resourceId: offer.id,
    req,
    newValue: { cooperativeId, cropId: payload.cropId, totalKg: pool.totalKg, members: pool.memberCount },
  });

  return { offer, pool };
};

export const listGroupOffers = async (cooperativeId, query, req) => {
  await assertCooperative(cooperativeId, req.tenant.organizationId);
  const items = await prisma.groupOffer.findMany({
    where: { cooperativeId, ...(query.status ? { status: query.status } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  return { items, count: items.length };
};

/**
 * Confirmation : l'offre groupée devient une annonce (DRAFT), jamais publiée
 * automatiquement — la coopérative garde la main sur la mise en marché.
 */
export const confirmGroupOffer = async (cooperativeId, offerId, req) => {
  const cooperative = await assertCooperative(cooperativeId, req.tenant.organizationId);
  const offer = await prisma.groupOffer.findUnique({ where: { id: offerId } });
  if (!offer || offer.cooperativeId !== cooperativeId) {
    throw ApiError.notFound('Offre groupée introuvable');
  }
  if (offer.status !== 'PROPOSED') throw ApiError.conflict('Cette offre a déjà été statuée');

  const listing = await prisma.listing.create({
    data: {
      id: resolveId(),
      organizationId: cooperative.organizationId,
      type: 'PRODUCE',
      cropId: offer.cropId,
      title: offer.title,
      description:
        `Offre groupée de ${offer.quantity} ${offer.unit} — ${(offer.split?.members ?? []).length} membre(s) contributeur(s).`,
      quantity: offer.quantity,
      unit: offer.unit,
      quality: offer.quality ?? null,
      indicativePrice: offer.pricePerUnit ?? null,
      currency: offer.currency,
      countryCode: offer.countryCode,
      certifications: [],
      status: 'DRAFT',
      source: 'third_party_verified',
      createdBy: req.user.id,
    },
  });

  const updated = await prisma.groupOffer.update({
    where: { id: offerId },
    data: { status: 'CONFIRMED', listingId: listing.id },
  });

  await audit({
    actorId: req.user.id,
    action: 'coop.groupoffer.confirm',
    resource: 'group_offers',
    resourceId: offerId,
    req,
    oldValue: { status: offer.status },
    newValue: { status: 'CONFIRMED', listingId: listing.id },
  });

  return { offer: updated, listing, next: 'L’annonce est en brouillon : publiez-la après vérification.' };
};

export const cancelGroupOffer = async (cooperativeId, offerId, reason, req) => {
  await assertCooperative(cooperativeId, req.tenant.organizationId);
  const offer = await prisma.groupOffer.findUnique({ where: { id: offerId } });
  if (!offer || offer.cooperativeId !== cooperativeId) {
    throw ApiError.notFound('Offre groupée introuvable');
  }
  if (offer.status === 'CONFIRMED') {
    throw ApiError.conflict('Une offre confirmée ne peut pas être annulée');
  }

  const updated = await prisma.groupOffer.update({
    where: { id: offerId },
    data: { status: 'CANCELLED' },
  });

  await audit({
    actorId: req.user.id,
    action: 'coop.groupoffer.cancel',
    resource: 'group_offers',
    resourceId: offerId,
    req,
    oldValue: { status: offer.status },
    newValue: { status: 'CANCELLED', reason: reason ?? null },
  });

  return updated;
};
