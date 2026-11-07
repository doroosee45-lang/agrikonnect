/**
 * Exigences CDC couvertes : TRC-01, TRC-02.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { slugify } from '../../shared/slug.js';
import { audit } from '../../shared/audit.js';

/**
 * TRA-LOT — Traçabilité des lots (CDC V3 §9).
 *
 * Deux garanties :
 *  1. Le journal d'événements est APPEND-ONLY : aucun endpoint de mise à jour
 *     ou de suppression n'existe, seule l'ajout est possible.
 *  2. La vue publique (QR) ne renvoie QUE les champs listés dans
 *     `publicFields`. Aucune coordonnée, aucun prix, aucun nom de client
 *     ne peut sortir si le producteur ne l'a pas explicitement publié.
 */

/**
 * TRC-01 — format de code **imposé** par le CDC : `AK-{PAYS}-{ANNÉE}-{SÉQUENCE}`.
 *
 * La séquence est propre à l'organisation et à l'année, sans trou : deux lots
 * créés simultanément ne peuvent pas obtenir le même code (contrainte unique en
 * base + reprise sur collision).
 */
export const LOT_CODE_PATTERN = /^AK-[A-Z]{2}-\d{4}-\d{5}$/;

const buildLotCode = (countryCode, year, sequence) =>
  `AK-${countryCode}-${year}-${String(sequence).padStart(5, '0')}`;

/** Prochain numéro disponible pour cette organisation et cette année. */
const nextLotSequence = async (organizationId, prefix) => {
  const existing = await prisma.traceabilityLot.findMany({
    where: { organizationId, code: { startsWith: prefix } },
    select: { code: true },
  });
  return existing.reduce((max, lot) => {
    const value = Number(String(lot.code).slice(prefix.length));
    return Number.isFinite(value) && value > max ? value : max;
  }, 0) + 1;
};

export const create = async (payload, req) => {
  const organizationId = req.tenant.organizationId;

  const crop = await prisma.crop.findFirst({ where: { id: payload.cropId, deletedAt: null } });
  if (!crop) throw ApiError.badRequest('Culture inconnue dans le référentiel');

  if (payload.plotId) {
    const plot = await prisma.plot.findFirst({
      where: { id: payload.plotId, organizationId, deletedAt: null },
    });
    if (!plot) throw ApiError.notFound('Parcelle introuvable');
  }

  if (payload.productionId) {
    const production = await prisma.production.findFirst({
      where: { id: payload.productionId, organizationId, deletedAt: null },
    });
    if (!production) throw ApiError.notFound('Production introuvable');
  }

  // Le pays vient de l'organisation (tenant) : jamais d'un défaut inventé.
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { countryCode: true },
  });
  if (!organization?.countryCode) {
    throw ApiError.conflict('Pays de l’organisation non renseigné : code de lot impossible');
  }

  const year = new Date().getUTCFullYear();
  const prefix = `AK-${organization.countryCode}-${year}-`;

  if (payload.code && !LOT_CODE_PATTERN.test(payload.code)) {
    throw ApiError.badRequest('Code de lot invalide : format attendu AK-{PAYS}-{ANNÉE}-{SÉQUENCE}');
  }

  let lot;
  let attempt = 0;
  const lotId = resolveId(payload.id);

  // Reprise en cas de collision de séquence (deux créations concurrentes).
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const sequence = payload.code ? null : await nextLotSequence(organizationId, prefix);
    try {
      // eslint-disable-next-line no-await-in-loop
      lot = await prisma.traceabilityLot.create({
        data: {
          id: attempt === 0 ? lotId : resolveId(),
          code: payload.code ?? buildLotCode(organization.countryCode, year, sequence),
          organizationId,
          plotId: payload.plotId ?? null,
          cropId: payload.cropId,
          productionId: payload.productionId ?? null,
          quantityKg: payload.quantityKg ?? null,
          status: 'OPEN',
          publicFields: payload.publicFields ?? {
            crop: crop.slug,
            quantityKg: payload.quantityKg ?? null,
            origin: null,
          },
          createdBy: req.user.id,
        },
      });
      break;
    } catch (error) {
      if (error?.code !== 'P2002' || payload.code || attempt >= 4) throw error;
      attempt += 1;
    }
  }

  await prisma.lotEvent.create({
    data: {
      id: resolveId(),
      lotId: lot.id,
      type: 'HARVEST',
      actorId: req.user.id,
      location: payload.location ?? undefined,
      details: 'Création du lot',
      source: 'declared',
    },
  });

  await audit({ actorId: req.user.id, action: 'lot.create', resource: 'traceability_lots', resourceId: lot.id, req, newValue: { code: lot.code, cropId: lot.cropId } });
  return lot;
};

/** Ajout d'un événement — seule écriture possible après création. */
export const addEvent = async (lotId, payload, req) => {
  const lot = await prisma.traceabilityLot.findFirst({
    where: { id: lotId, organizationId: req.tenant.organizationId },
  });
  if (!lot) throw ApiError.notFound('Lot introuvable');
  if (lot.status === 'RECALLED') {
    throw ApiError.conflict('Lot rappelé : plus aucun événement ne peut être ajouté');
  }

  const event = await prisma.lotEvent.create({
    data: {
      id: resolveId(payload.id),
      lotId,
      type: payload.type,
      actorId: req.user.id,
      location: payload.location ?? undefined,
      details: payload.details ?? null,
      // La provenance est déclarée ; `measured_sensor` est réservée aux
      // événements produits automatiquement par un appareil (IoT).
      source: payload.source ?? 'declared',
    },
  });

  // Une livraison clôt le lot
  if (payload.type === 'DELIVERY' && payload.closeLot) {
    await prisma.traceabilityLot.update({ where: { id: lotId }, data: { status: 'CLOSED' } });
  }

  await audit({ actorId: req.user.id, action: 'lot.event', resource: 'lot_events', resourceId: event.id, req, newValue: { lotId, type: payload.type, source: event.source } });
  return event;
};

export const list = async (query, req) => {
  const where = {
    organizationId: req.tenant.organizationId,
    ...(query.cropId ? { cropId: query.cropId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.traceabilityLot.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      include: { events: { orderBy: { at: 'asc' } } },
    }),
    prisma.traceabilityLot.count({ where }),
  ]);

  return { items, total, page: query.page, limit: query.limit };
};

export const getOne = async (id, req) => {
  const lot = await prisma.traceabilityLot.findFirst({
    where: { id, organizationId: req.tenant.organizationId },
    include: { events: { orderBy: { at: 'asc' } } },
  });
  if (!lot) throw ApiError.notFound('Lot introuvable');

  return {
    lot,
    appendOnly: true,
    eventCount: lot.events.length,
    publicProjection: lot.publicFields,
  };
};

/**
 * Vue publique (QR) : projection stricte sur `publicFields`.
 * Aucune donnée interne n'est atteignable par ce chemin.
 */
export const publicView = async (code) => {
  const lot = await prisma.traceabilityLot.findUnique({
    where: { code },
    include: { events: { orderBy: { at: 'asc' } } },
  });

  if (!lot) throw ApiError.notFound('Lot introuvable');

  const publicFields = lot.publicFields ?? {};
  const allowed = new Set(Object.keys(publicFields));
  const crop = lot.cropId ? await prisma.crop.findUnique({ where: { id: lot.cropId } }) : null;

  return {
    code: lot.code,
    status: lot.status,
    createdAt: lot.createdAt,
    published: Object.fromEntries(
      Object.entries(publicFields).filter(([, value]) => value !== null && value !== undefined),
    ),
    // Les événements publics sont limités au type et à la date : pas d'acteur,
    // pas de coordonnée, pas de détail interne.
    timeline: lot.events.map((e) => ({ type: e.type, at: e.at })),
    crop: crop ? { slug: crop.slug, name: crop.names?.fr ?? crop.slug } : null,
    // La fiche publique n'est jamais une certification : le dire explicitement.
    verification: {
      certification: false,
      note: 'Fiche publique déclarative — elle n’est pas une certification et ne vaut pas preuve d’origine.',
    },
    disclosure: {
      rule: 'Seuls les champs publiés par le producteur sont visibles.',
      hiddenFields: [
        'organizationId', 'plotId', 'productionId', 'createdBy',
        'event.actorId', 'event.location', 'event.details',
      ].filter((f) => !allowed.has(f)),
    },
  };
};

/** Mise à jour de la projection publique (contrôlée par le producteur). */
export const updatePublicFields = async (id, publicFields, req) => {
  const lot = await prisma.traceabilityLot.findFirst({
    where: { id, organizationId: req.tenant.organizationId },
  });
  if (!lot) throw ApiError.notFound('Lot introuvable');

  const forbidden = ['organizationId', 'plotId', 'productionId', 'createdBy', 'customerName', 'price'];
  const rejected = Object.keys(publicFields).filter((k) => forbidden.includes(k));
  if (rejected.length > 0) {
    throw ApiError.badRequest(`Champs non publiables : ${rejected.join(', ')}`);
  }

  const updated = await prisma.traceabilityLot.update({ where: { id }, data: { publicFields } });
  await audit({ actorId: req.user.id, action: 'lot.publish', resource: 'traceability_lots', resourceId: id, req, newValue: publicFields });
  return updated;
};

/** Rappel de lot — statut terminal, journalisé. */
export const recall = async (id, { reason }, req) => {
  const lot = await prisma.traceabilityLot.findFirst({
    where: { id, organizationId: req.tenant.organizationId },
  });
  if (!lot) throw ApiError.notFound('Lot introuvable');

  const updated = await prisma.traceabilityLot.update({ where: { id }, data: { status: 'RECALLED' } });
  await prisma.lotEvent.create({
    data: {
      id: resolveId(),
      lotId: id,
      // TRC-02 — le rappel est un événement typé et motivé du journal.
      type: 'RECALL',
      actorId: req.user.id,
      details: `Rappel de lot : ${reason}`,
      source: 'declared',
    },
  });

  await audit({ actorId: req.user.id, action: 'lot.recall', resource: 'traceability_lots', resourceId: id, req, newValue: { reason } });
  return updated;
};
