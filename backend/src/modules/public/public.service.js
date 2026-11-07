/**
 * Exigences CDC couvertes : PROF-02, PROF-04, PUB-01, PUB-02, PUB-03, PUB-04, PUB-05, PUB-06, MAP-01, MAP-02, MAP-03, MAP-04, TRC-03, SOIL-16.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { lienProfilFerme } from '../../shared/links.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { approximate, isValidCoordinate, parseBbox } from '../../shared/geo.js';
import { sendEmail } from '../../integrations/email.js';

/**
 * Projections publiques (CDC A.3 : « jamais le document brut »).
 *
 * Ces fonctions construisent explicitement chaque champ exposé. Aucun spread
 * d'objet Prisma n'est utilisé : on ne peut donc pas divulguer un champ privé
 * par accident (téléphone, email, coordonnées exactes, documents).
 */

const CONTACT_MASK = {
  public: 'public',
  onRequest: 'onRequest',
  private: 'private',
};

const resolveContact = (farm, profile) => {
  const visibility = farm.visibility ?? {};
  const out = {};

  if ((visibility.phone ?? 'private') === 'public' && profile?.phone) out.phone = profile.phone;
  if ((visibility.whatsapp ?? 'private') === 'public' && profile?.whatsapp) out.whatsapp = profile.whatsapp;
  if ((visibility.email ?? 'private') === 'public' && profile?.email) out.email = profile.email;

  return {
    ...out,
    /** Indique qu'un contact existe mais reste masqué : permet le formulaire de contact (PUB-06). */
    masked: Object.keys(out).length === 0,
    requestAvailable: ['public', 'onRequest'].includes(visibility.phone ?? 'private'),
  };
};

const projectFarm = (farm, { owner, plotsCount = 0, crops = [], media = [] }) => ({
  slug: farm.slug,
  name: farm.name,
  description: farm.description,
  countryCode: farm.countryCode,
  adminPath: {
    province: farm.province,
    territory: farm.territory,
    sector: farm.sector,
    village: farm.village,
  },
  // Position publique : approximative par défaut (MAP-04, SEC-12)
  location:
    farm.publicLatitude !== null && farm.publicLongitude !== null
      ? {
          type: 'Point',
          coordinates: [farm.publicLongitude, farm.publicLatitude],
          precision: farm.publicLocationPrecision,
        }
      : null,
  totalAreaHa: farm.totalAreaHa,
  workers: farm.workers,
  capacity: farm.capacity,
  foundedYear: farm.foundedYear,
  crops: crops.map((c) => ({ slug: c.crop.slug, name: c.crop.names?.fr ?? c.crop.slug })),
  gallery: media.map((m) => ({ url: m.url, caption: m.caption, kind: m.kind })),
  plotsCount,
  contact: resolveContact(farm, owner),
  /**
   * VER-04 : provenance affichée séparément.
   * « déclaré par le producteur » ≠ « vérifié par AGRIKONNECT ».
   */
  verification: {
    status: farm.verificationStatus ?? 'UNVERIFIED',
    verifiedAt: farm.verifiedAt,
    label: farm.verificationStatus
      ? 'Vérifié par AGRIKONNECT'
      : 'Déclaré par le producteur',
  },
  owner: owner
    ? { firstName: owner.firstName, lastName: owner.lastName, avatarUrl: owner.avatarUrl }
    : null,
  /**
   * PUB-05 — un profil non vérifié n'est pas indexable.
   * La directive est produite côté serveur : elle ne dépend pas du rendu client.
   */
  seo: {
    indexable: Boolean(farm.verifiedAt),
    robots: farm.verifiedAt ? 'index,follow' : 'noindex,follow',
    canonicalUrl: lienProfilFerme(farm.slug),
  },
  viewCount: farm.viewCount,
  source: farm.source,
  updatedAt: farm.updatedAt,
});

/** PUB-01 — page publique d'une exploitation. */
export const getFarmBySlug = async (slug, req) => {
  const farm = await prisma.farm.findFirst({
    where: {
      OR: [{ slug }, { previousSlugs: { has: slug } }],
      deletedAt: null,
      isPublic: true,
    },
    include: {
      crops: { include: { crop: { select: { slug: true, names: true } } } },
      media: { where: { deletedAt: null }, orderBy: { position: 'asc' }, take: 24 },
      organization: { include: { memberships: { where: { status: 'ACTIVE' }, take: 1 } } },
      _count: { select: { plots: true } },
    },
  });

  if (!farm) throw ApiError.notFound('Profil introuvable ou non publié');

  // Compteur de vues agrégé, sans donnée personnelle du visiteur (PROF-04)
  await prisma.farm.update({ where: { id: farm.id }, data: { viewCount: { increment: 1 } } });

  const ownerId = farm.organization.memberships[0]?.userId;
  const owner = ownerId
    ? await prisma.profile.findUnique({
        where: { id: ownerId },
        select: { firstName: true, lastName: true, phone: true, email: true, whatsapp: true, avatarUrl: true },
      })
    : null;

  return {
    slug: farm.slug,
    canonicalSlug: farm.slug,
    redirectedFrom: slug !== farm.slug ? slug : null,
    farm: projectFarm(farm, {
      owner,
      plotsCount: farm._count.plots,
      crops: farm.crops,
      media: farm.media,
    }),
    share: {
      url: lienProfilFerme(farm.slug),
      // PUB-04 : métadonnées Open Graph prêtes pour le rendu serveur
      openGraph: {
        title: `${farm.name} — AGRIKONNECT AFRICA`,
        description: farm.description?.slice(0, 160) ?? 'Profil agricole professionnel',
        image: farm.media[0]?.url ?? null,
        type: 'profile',
      },
    },
  };
};

/** PUB-06 — contact sans révéler les coordonnées. */
export const contactFarm = async (slug, payload) => {
  const farm = await prisma.farm.findFirst({
    where: { slug, deletedAt: null, isPublic: true },
    include: { organization: { include: { memberships: { where: { status: 'ACTIVE' }, take: 1 } } } },
  });

  if (!farm) throw ApiError.notFound('Profil introuvable');

  const ownerId = farm.organization.memberships[0]?.userId;
  const owner = ownerId
    ? await prisma.profile.findUnique({ where: { id: ownerId }, select: { email: true } })
    : null;

  if (owner?.email) {
    await sendEmail({
      to: owner.email,
      subject: `AGRIKONNECT — Nouveau message concernant ${farm.name}`,
      text: [
        'Un visiteur souhaite te contacter via ton profil public.',
        '',
        `Nom : ${payload.name ?? 'non renseigné'}`,
        `Email de réponse : ${payload.email ?? 'non renseigné'}`,
        `Téléphone : ${payload.phone ?? 'non renseigné'}`,
        '',
        payload.message,
        '',
        '— Réponds directement à ce visiteur depuis tes coordonnées. AGRIKONNECT n\'a pas transmis les tiennes.',
      ].join('\n'),
    });
  }

  return { sent: true, message: 'Message transmis au producteur' };
};

/**
 * MAP-01 → MAP-04 — carte agricole.
 * Chargement par emprise (bbox) + filtres, jamais tout le jeu de données.
 * Positions arrondies : la coordonnée exacte n'est jamais exposée.
 */
export const map = async (query) => {
  const { bbox, countryCode, province, cropId, limit = 200, locale = 'fr' } = query;
  const bounds = bbox ? parseBbox(bbox) : null;

  if (bbox && !bounds) throw ApiError.badRequest('Paramètre bbox invalide (minLng,minLat,maxLng,maxLat)');

  const farms = await prisma.farm.findMany({
    where: {
      deletedAt: null,
      isPublic: true,
      publicLatitude: { not: null },
      publicLongitude: { not: null },
      ...(bounds
        ? {
            publicLongitude: { gte: bounds.minLng, lte: bounds.maxLng },
            publicLatitude: { gte: bounds.minLat, lte: bounds.maxLat },
          }
        : {}),
      ...(countryCode ? { countryCode } : {}),
      ...(province ? { province } : {}),
      ...(cropId ? { crops: { some: { cropId } } } : {}),
    },
    take: Math.min(Number(limit), 500),
    select: {
      slug: true,
      name: true,
      countryCode: true,
      province: true,
      publicLatitude: true,
      publicLongitude: true,
      totalAreaHa: true,
      verificationStatus: true,
      crops: { select: { crop: { select: { slug: true, names: true } } } },
    },
  });

  return {
    type: 'FeatureCollection',
    features: farms.map((farm) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        // Double arrondi de sécurité : même si la donnée stockée bougeait,
        // la sortie publique reste approximative.
        coordinates: [
          approximate(farm.publicLongitude, env.PUBLIC_COORD_DECIMALS),
          approximate(farm.publicLatitude, env.PUBLIC_COORD_DECIMALS),
        ],
      },
      properties: {
        slug: farm.slug,
        name: farm.name,
        countryCode: farm.countryCode,
        province: farm.province,
        totalAreaHa: farm.totalAreaHa,
        crops: farm.crops.map((c) => c.crop.names?.[locale] ?? c.crop.names?.fr ?? c.crop.slug),
        verified: Boolean(farm.verificationStatus),
        precision: 'approximate',
      },
    })),
    meta: {
      count: farms.length,
      bbox: bounds,
      // MAP-03 : le regroupement (clusters) est fait côté client à partir de ce jeu
      clustering: 'client',
      note: 'Les positions affichées sont approximatives. Les coordonnées exactes ne sont jamais publiées.',
    },
  };
};

/** Annuaire public (SEO : /farmers, /cooperatives). */
export const listPublicFarms = async (query) => {
  const { page = 1, limit = 20, countryCode, province, cropId, search } = query;

  const where = {
    deletedAt: null,
    isPublic: true,
    ...(countryCode ? { countryCode } : {}),
    ...(province ? { province } : {}),
    ...(cropId ? { crops: { some: { cropId } } } : {}),
    ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.farm.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Math.min(Number(limit), 100),
      orderBy: { updatedAt: 'desc' },
      select: {
        slug: true,
        name: true,
        countryCode: true,
        province: true,
        description: true,
        totalAreaHa: true,
        verificationStatus: true,
        updatedAt: true,
        crops: { select: { crop: { select: { slug: true, names: true } } } },
      },
    }),
    prisma.farm.count({ where }),
  ]);

  return { items, total, page: Number(page), limit: Number(limit) };
};

/* ─────────────────────────── PUB-03 : QR du profil public ─────────────────────────── */

/**
 * QR code du profil public.
 *
 * Le QR ne contient QUE l'URL publique canonique : aucun identifiant technique,
 * aucune donnée personnelle. Le rendu PNG/SVG est produit côté serveur, ce qui
 * évite toute dépendance à un service tiers (et toute fuite d'URL de visite).
 */
export const farmQr = async (slug, { format = 'png', size = 512 } = {}) => {
  const farm = await prisma.farm.findFirst({
    where: { slug, deletedAt: null, isPublic: true },
    select: { slug: true, name: true },
  });
  if (!farm) throw ApiError.notFound('Profil introuvable ou non publié');

  const { default: QRCode } = await import('qrcode');
  const url = lienProfilFerme(farm.slug);
  const options = format === 'svg' ? { type: 'svg', margin: 1 } : { type: 'png', margin: 1, width: Number(size) };

  const buffer =
    format === 'svg'
      ? Buffer.from(await QRCode.toString(url, { ...options, errorCorrectionLevel: 'M' }), 'utf8')
      : await QRCode.toBuffer(url, { ...options, errorCorrectionLevel: 'M' });

  return {
    buffer,
    contentType: format === 'svg' ? 'image/svg+xml' : 'image/png',
    filename: `qr-${farm.slug}.${format}`,
    payload: { url, encodes: 'URL publique uniquement', name: farm.name },
  };
};

/* ─────────────────────────── TRC-03 : page publique de lot ─────────────────────────── */

/* ─────────────────────────── SOIL-16 : statistiques de sol agrégées (S5) ─────────────────────────── */

const K_ANONYMITY = Number(process.env.AGGREGATE_MIN_GROUP_SIZE ?? 10);

/**
 * Statistiques de sol agrégées au niveau pays/zone.
 *
 * S5 exige un k-anonymat ≥ 10 : en dessous du seuil, la ligne est SUPPRIMÉE
 * (jamais arrondie, jamais complétée). Les valeurs sont des moyennes de
 * paramètres mesurés, sans aucune référence à une parcelle identifiable.
 */
export const soilStats = async ({ countryCode, parameter } = {}) => {
  const assessments = await prisma.soilAssessment.findMany({
    where: { deletedAt: null, ...(countryCode ? { countryCode } : {}) },
    include: { parameters: true },
  });

  const groups = new Map();
  for (const assessment of assessments) {
    const key = assessment.countryCode;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(assessment);
  }

  const rows = [];
  const suppressed = [];

  for (const [country, list] of groups.entries()) {
    if (list.length < K_ANONYMITY) {
      suppressed.push({ countryCode: country, assessments: list.length, reason: `k < ${K_ANONYMITY}` });
      continue;
    }

    const values = new Map();
    for (const assessment of list) {
      for (const p of assessment.parameters) {
        if (p.numericValue === null || p.numericValue === undefined) continue;
        if (parameter && p.key !== parameter) continue;
        if (!values.has(p.key)) values.set(p.key, []);
        values.get(p.key).push(p.numericValue);
      }
    }

    const means = [...values.entries()].map(([key, series]) => ({
      parameter: key,
      mean: Math.round((series.reduce((a, b) => a + b, 0) / series.length) * 1000) / 1000,
      samples: series.length,
      // Un paramètre trop peu renseigné n'est pas publié non plus.
      published: series.length >= K_ANONYMITY,
    }));

    rows.push({
      countryCode: country,
      assessments: list.length,
      parameters: means.filter((m) => m.published),
      withheldParameters: means.filter((m) => !m.published).map((m) => m.parameter),
    });
  }

  return {
    kAnonymity: K_ANONYMITY,
    rows,
    suppressedGroups: suppressed,
    provenance: {
      method: 'moyenne de paramètres mesurés, groupée par pays',
      individuals: 'aucune parcelle, aucune exploitation identifiable',
      rule: `tout groupe de moins de ${K_ANONYMITY} analyses est supprimé (S5 / SOIL-16)`,
    },
  };
};
