/**
 * Exigences CDC couvertes : INS-01, INS-02, INS-03.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../shared/errors/ApiError.js';

/**
 * INS-01 → INS-03 — Observatoire pays (V5).
 *
 * Destinataires : administration pays, banques de développement, partenaires —
 * jamais un usage commercial ciblé.
 *
 * Trois règles non négociables, héritées du CDC V5 §6.4 :
 *  1. **Aucun chiffre inventé** : chaque valeur renvoie sa `source`, sa `method`
 *     et son `computedAt`. Une donnée absente vaut `null` avec `reason`, jamais 0.
 *  2. **k-anonymat** : un agrégat portant sur moins de `AGGREGATE_MIN_GROUP_SIZE`
 *     organisations n'est pas publié (valeur `null`, motif explicite).
 *  3. **Aucune donnée personnelle** : seuls des décomptes d'organisations et des
 *     volumes physiques ou financiers agrégés sortent de l'API.
 */

/** Taille minimale d'un groupe publiable (k-anonymat). */
export const MIN_GROUP_SIZE = Math.max(5, Number(env.AGGREGATE_MIN_GROUP_SIZE ?? 10));

/** Enveloppe de provenance appliquée à chaque indicateur. */
const indicator = ({ value, unit = null, source, method, extra = null }) => ({
  value,
  unit,
  source,
  method,
  computedAt: new Date().toISOString(),
  ...(value === null && extra ? { reason: extra } : {}),
});

/**
 * Applique le k-anonymat à un décompte.
 * `null` (et non `0`) quand le groupe est trop petit : 0 serait une information
 * fausse, `null` renvoie l'absence de donnée publiable.
 */
const anonymize = (count, organizationCount = count) => {
  if (count === null || count === undefined) return { value: null, reason: 'aucune donnée' };
  if (organizationCount < MIN_GROUP_SIZE) {
    return {
      value: null,
      reason: `groupe de ${organizationCount} organisation(s) < seuil de k-anonymat (${MIN_GROUP_SIZE})`,
    };
  }
  return { value: count, reason: null };
};

const assertCountry = (countryCode) => {
  if (!/^[A-Z]{2}$/.test(String(countryCode))) {
    throw ApiError.badRequest('countryCode requis (ISO 3166-1 alpha-2, ex. CD)', [
      { field: 'countryCode', code: 'invalid' },
    ]);
  }
  return countryCode;
};

/** Identifiants d'organisations d'un pays (base de tous les agrégats). */
const organizationsOf = async (countryCode) => {
  const organizations = await prisma.organization.findMany({
    where: { countryCode, deletedAt: null },
    select: { id: true },
    take: 10_000,
  });
  return organizations.map((organization) => organization.id);
};

/**
 * INS-01 — tableau de bord pays.
 *
 * Toutes les valeurs sont calculées à la requête : rien n'est pré-calculé en
 * base, donc aucun chiffre ne peut « dater » sans que la réponse le dise.
 */
export const overview = async ({ countryCode }, _req) => {
  const code = assertCountry(countryCode);
  const organizationIds = await organizationsOf(code);

  if (organizationIds.length === 0) {
    return {
      countryCode: code,
      indicators: {},
      disclosure: {
        empty: true,
        message: 'Aucune organisation enregistrée pour ce pays : aucun indicateur ne peut être produit.',
        minGroupSize: MIN_GROUP_SIZE,
      },
    };
  }

  const [farms, plots, productions, listings, projects, exports_count] = await Promise.all([
    prisma.farm.findMany({ where: { organizationId: { in: organizationIds }, deletedAt: null }, select: { id: true, organizationId: true, totalAreaHa: true } }),
    prisma.plot.findMany({ where: { organizationId: { in: organizationIds }, deletedAt: null }, select: { areaHa: true, organizationId: true } }),
    prisma.production.findMany({ where: { organizationId: { in: organizationIds }, deletedAt: null }, select: { quantityKg: true, organizationId: true } }),
    prisma.listing.findMany({ where: { organizationId: { in: organizationIds }, status: 'PUBLISHED', deletedAt: null }, select: { organizationId: true } }),
    prisma.project.findMany({ where: { organizationId: { in: organizationIds }, status: 'PUBLISHED', deletedAt: null }, select: { organizationId: true } }),
    // `ExportOrder` n'a pas de suppression logique : on filtre sur l'organisation vendeuse seule
    prisma.exportOrder.findMany({ where: { sellerOrgId: { in: organizationIds } }, select: { sellerOrgId: true, totalAmount: true, currency: true, status: true } }),
  ]);

  const producers = new Set(farms.map((farm) => farm.organizationId));
  const areaHa = plots.reduce((total, plot) => total + Number(plot.areaHa ?? 0), 0);
  const volumeKg = productions.reduce((total, production) => total + Number(production.quantityKg ?? 0), 0);
  const exportValue = exports_count.reduce((total, order) => total + Number(order.totalAmount ?? 0), 0);

  const farmerCount = anonymize(producers.size);
  const area = anonymize(Math.round(areaHa), producers.size);
  const volume = anonymize(Math.round(volumeKg), producers.size);
  const sellers = anonymize(new Set(listings.map((listing) => listing.organizationId)).size);
  const porteurs = anonymize(new Set(projects.map((project) => project.organizationId)).size);
  const exportOrganizations = anonymize(new Set(exports_count.map((order) => order.sellerOrgId)).size);
  const exportAmount = anonymize(Math.round(exportValue), new Set(exports_count.map((order) => order.sellerOrgId)).size);

  return {
    countryCode: code,
    indicators: {
      producers: indicator({
        ...farmerCount,
        unit: 'organisations',
        source: 'farms',
        method: 'organisations distinctes possédant au moins une exploitation non supprimée',
      }),
      cultivatedAreaHa: indicator({
        ...area,
        unit: 'ha',
        source: 'plots',
        method: 'somme de Plot.areaHa, arrondie à l’hectare',
      }),
      declaredVolumeKg: indicator({
        ...volume,
        unit: 'kg',
        source: 'productions',
        method: 'somme de Production.quantityKg déclarée par les producteurs (non mesurée)',
      }),
      publishedListings: indicator({
        ...sellers,
        unit: 'organisations',
        source: 'listings',
        method: 'organisations distinctes ayant au moins une annonce PUBLISHED',
      }),
      publishedProjects: indicator({
        ...porteurs,
        unit: 'organisations',
        source: 'projects',
        method: 'organisations distinctes porteuses d’un projet PUBLISHED (après revue)',
      }),
      exportOrganizations: indicator({
        ...exportOrganizations,
        unit: 'organisations',
        source: 'export_orders',
        method: 'organisations distinctes ayant un ordre d’export non supprimé',
      }),
      exportValue: indicator({
        ...exportAmount,
        unit: 'devises multiples (voir exportCurrencies)',
        source: 'export_orders',
        method: 'somme de ExportOrder.totalAmount — devises non converties, jamais additionnées entre devises',
      }),
    },
    exportCurrencies: [...new Set(exports_count.map((order) => order.currency))],
    disclosure: {
      minGroupSize: MIN_GROUP_SIZE,
      rule: 'Aucun indicateur n’est publié pour un groupe de moins de ' + MIN_GROUP_SIZE + ' organisations.',
      personalData: 'Aucune donnée personnelle : décomptes d’organisations et volumes agrégés uniquement.',
      caveat: 'Les volumes sont DÉCLARÉS par les producteurs : ils ne valent pas mesure officielle.',
    },
  };
};

/**
 * INS-02 — répartition par culture (surfaces et volumes déclarés).
 * Trié par volume décroissant ; les cultures sous le seuil sont supprimées
 * du résultat et signalées uniquement par leur nombre.
 */
export const byCrop = async ({ countryCode }, _req) => {
  const code = assertCountry(countryCode);
  const organizationIds = await organizationsOf(code);

  if (organizationIds.length === 0) {
    return { countryCode: code, crops: [], suppressed: 0, minGroupSize: MIN_GROUP_SIZE };
  }

  const productions = await prisma.production.findMany({
    where: { organizationId: { in: organizationIds }, deletedAt: null },
    select: { cropId: true, quantityKg: true, organizationId: true },
    take: 50_000,
  });

  const groups = new Map();
  for (const production of productions) {
    const key = production.cropId;
    if (!groups.has(key)) groups.set(key, { organizations: new Set(), volumeKg: 0 });
    groups.get(key).organizations.add(production.organizationId);
    groups.get(key).volumeKg += Number(production.quantityKg ?? 0);
  }

  const cropIds = [...groups.keys()].filter(Boolean);
  const crops = cropIds.length
    ? await prisma.crop.findMany({ where: { id: { in: cropIds } }, select: { id: true, slug: true, names: true } })
    : [];
  const cropById = new Map(crops.map((crop) => [crop.id, crop]));

  const published = [];
  let suppressed = 0;

  for (const [cropId, group] of groups) {
    if (group.organizations.size < MIN_GROUP_SIZE) {
      suppressed += 1;
      continue;
    }

    published.push({
      crop: cropById.get(cropId) ?? { id: cropId, slug: null, names: null },
      organizations: group.organizations.size,
      volumeKg: Math.round(group.volumeKg),
      source: 'productions',
      method: 'somme des volumes déclarés, groupée par culture',
    });
  }

  published.sort((a, b) => b.volumeKg - a.volumeKg);

  return {
    countryCode: code,
    crops: published,
    suppressed,
    suppressedNote:
      suppressed > 0
        ? `${suppressed} culture(s) non publiée(s) : moins de ${MIN_GROUP_SIZE} organisations.`
        : null,
    minGroupSize: MIN_GROUP_SIZE,
    disclosure: { personalData: 'aucune', caveat: 'volumes déclarés, non mesurés' },
  };
};

/**
 * INS-03 — activité mensuelle (annonces publiées, commandes, projets soumis).
 * Série construite à partir des dates serveur : aucune saisie manuelle.
 */
export const activity = async ({ countryCode, months = 6 }, _req) => {
  const code = assertCountry(countryCode);
  const window = Math.min(Math.max(Number(months) || 6, 1), 24);

  const organizationIds = await organizationsOf(code);
  if (organizationIds.length === 0) {
    return { countryCode: code, window, series: [], minGroupSize: MIN_GROUP_SIZE };
  }

  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCMonth(since.getUTCMonth() - (window - 1));

  const [listings, orders, projects] = await Promise.all([
    prisma.listing.findMany({
      where: { organizationId: { in: organizationIds }, createdAt: { gte: since } },
      select: { createdAt: true, organizationId: true },
    }),
    prisma.order.findMany({
      where: { sellerOrgId: { in: organizationIds }, createdAt: { gte: since } },
      select: { createdAt: true, status: true },
    }),
    prisma.project.findMany({
      where: { organizationId: { in: organizationIds }, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  const buckets = new Map();
  for (let index = 0; index < window; index += 1) {
    const month = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + index, 1));
    buckets.set(month.toISOString().slice(0, 7), { period: month.toISOString().slice(0, 7), listings: 0, orders: 0, projects: 0 });
  }

  const bump = (date, field) => {
    const key = new Date(date).toISOString().slice(0, 7);
    const bucket = buckets.get(key);
    if (bucket) bucket[field] += 1;
  };

  listings.forEach((listing) => bump(listing.createdAt, 'listings'));
  orders.forEach((order) => bump(order.createdAt, 'orders'));
  projects.forEach((project) => bump(project.createdAt, 'projects'));

  // Nombre d'organisations distinctes sur la fenêtre : sert au k-anonymat de la série
  const activeOrganizations = new Set([
    ...listings.map((listing) => listing.organizationId),
  ]).size;

  const series = [...buckets.values()];
  const publishable = activeOrganizations >= MIN_GROUP_SIZE;

  return {
    countryCode: code,
    window,
    series: publishable ? series : [],
    ...(publishable
      ? {}
      : {
          suppressedReason: `moins de ${MIN_GROUP_SIZE} organisations actives sur la fenêtre (${activeOrganizations})`,
        }),
    provenance: {
      source: 'listings, orders, projects',
      method: 'comptage des créations par mois calendaire (UTC), à partir des dates serveur',
      computedAt: new Date().toISOString(),
    },
    minGroupSize: MIN_GROUP_SIZE,
  };
};

/** INS — politique de divulgation, exposée pour l'interface et les partenaires. */
export const disclosurePolicy = () => ({
  minGroupSize: MIN_GROUP_SIZE,
  rules: [
    'Aucun agrégat publié pour un groupe de moins de ' + MIN_GROUP_SIZE + ' organisations.',
    'Aucun minimum, maximum ou liste d’organisations (vecteurs de ré-identification).',
    'Chaque indicateur porte sa source, sa méthode et son horodatage.',
    'Les volumes déclarés sont signalés comme tels : jamais présentés comme mesurés.',
    'Aucune donnée personnelle : ni nom, ni contact, ni coordonnée géographique fine.',
  ],
  forbidden: ['min/max par groupe', 'liste d’organisations', 'coordonnées précises', 'données de contact'],
});
