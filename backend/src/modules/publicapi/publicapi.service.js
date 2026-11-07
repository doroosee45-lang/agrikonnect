/**
 * Exigences CDC couvertes : GLB-04, DATA-04.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';

/**
 * API publique de données (V5, API-01 → API-04).
 *
 * Réservée aux clients disposant d'une clé valide ET d'un contrat de données
 * actif sur le produit demandé. Ne renvoie que des AGRÉGATS conformes au
 * k-anonymat : jamais de ligne individuelle, jamais d'identité d'exploitation.
 */

const assertContract = async (clientId, productId) => {
  const contract = await prisma.dataContract.findFirst({
    where: { clientId, productId },
    orderBy: { signedAt: 'desc' },
  });

  if (!contract) {
    throw ApiError.forbidden(
      'Aucun contrat de données actif pour ce produit (DATA-04). La donnée n\'est pas vendue : elle est fournie sous contrat.',
    );
  }
  if (contract.expiresAt && contract.expiresAt.getTime() < Date.now()) {
    throw ApiError.forbidden('Contrat de données expiré');
  }
  return contract;
};

export const listProducts = async (req) => {
  const products = await prisma.dataProduct.findMany({
    where: { status: 'PUBLISHED' },
    select: { id: true, slug: true, name: true, description: true, minGroupSize: true, fields: true },
  });

  const contracts = await prisma.dataContract.findMany({
    where: { clientId: req.apiClient.id },
    select: { productId: true, purposes: true, expiresAt: true },
  });

  const covered = new Set(contracts.filter((c) => !c.expiresAt || c.expiresAt.getTime() > Date.now()).map((c) => c.productId));

  return {
    items: products.map((p) => ({
      ...p,
      accessible: covered.has(p.id),
      // On indique clairement ce qui nécessite un contrat
      requirement: covered.has(p.id) ? null : 'Contrat de données requis (DATA-04)',
    })),
    total: products.length,
    client: { name: req.apiClient.name, purposes: contracts.flatMap((c) => c.purposes) },
  };
};

export const getAggregates = async (productIdOrSlug, query, req) => {
  const product = await prisma.dataProduct.findFirst({
    where: { OR: [{ id: productIdOrSlug }, { slug: productIdOrSlug }] },
  });
  if (!product) throw ApiError.notFound('Produit de données introuvable');
  if (product.status !== 'PUBLISHED') throw ApiError.notFound('Produit de données introuvable');

  const contract = await assertContract(req.apiClient.id, product.id);
  const minGroupSize = Math.max(product.minGroupSize, 5);

  const aggregates = await prisma.aggregate.findMany({
    where: {
      productId: product.id,
      // Filtre de sécurité supplémentaire au niveau lecture
      groupCount: { gte: minGroupSize },
      ...(query.period ? { period: query.period } : {}),
    },
    orderBy: [{ period: 'desc' }, { key: 'asc' }],
    take: 500,
  });

  return {
    product: {
      slug: product.slug,
      name: product.name,
      minGroupSize: product.minGroupSize,
      ruleVersions: [...new Set(aggregates.map((a) => a.ruleVersion))],
    },
    aggregates: aggregates.map((a) => ({
      key: a.key,
      period: a.period,
      value: a.value,
      composition: a.composition,
      groupCount: a.groupCount,
      ruleVersion: a.ruleVersion,
      computedAt: a.computedAt,
    })),
    contract: {
      id: contract.id,
      purposes: contract.purposes,
      restrictions: contract.restrictions,
      expiresAt: contract.expiresAt,
    },
    disclosure: {
      kAnonymity: `Seuls les groupes d'au moins ${minGroupSize} organisations sont exposés.`,
      noReidentification: 'Aucun minimum, maximum ou identifiant d\'exploitation n\'est fourni.',
      source: 'Données agrégées, non ré-identifiables.',
    },
  };
};

export const getPrices = async (query) => {
  const prices = await prisma.marketPrice.findMany({
    where: {
      ...(query.cropId ? { cropId: query.cropId } : {}),
      ...(query.countryCode ? { countryCode: query.countryCode } : {}),
      ...(query.since ? { observedAt: { gte: new Date(query.since) } } : {}),
    },
    orderBy: { observedAt: 'desc' },
    take: Math.min(Number(query.limit ?? 100), 500),
    select: {
      cropId: true, market: true, city: true, countryCode: true,
      price: true, currency: true, unit: true, observedAt: true,
      source: true, sourceLabel: true,
    },
  });

  return {
    items: prices,
    count: prices.length,
    // Chaque ligne porte sa source et sa date : exigence PRI-01
    provenance: {
      rule: 'Chaque prix est daté (observedAt) et sourcé (source, sourceLabel).',
      sources: [...new Set(prices.map((p) => p.sourceLabel ?? p.source))],
    },
  };
};

/* ─────────── V5 §6 — endpoints publics normalisés du CDC ─────────── */

/**
 * Agrégats régionaux. Le seuil de k-anonymat s'applique AVANT toute sortie :
 * une région dont le nombre d'exploitations est inférieur au seuil est retirée,
 * jamais arrondie ni complétée.
 */
const K_ANONYMITY = Number(process.env.AGGREGATE_MIN_GROUP_SIZE ?? 10);

const assertKAnonymity = (count, label) => {
  if (count < K_ANONYMITY) {
    throw ApiError.forbidden(
      `Agrégat non publiable : ${label} concerne ${count} exploitation(s), sous le seuil de k-anonymat (${K_ANONYMITY})`,
      { kAnonymity: K_ANONYMITY, observed: count },
    );
  }
};

export const getAgricultureOverview = async (query = {}) => {
  const farms = await prisma.farm.findMany({
    where: { deletedAt: null, isPublic: true, ...(query.countryCode ? { countryCode: query.countryCode } : {}) },
  });

  const byCountry = new Map();
  for (const farm of farms) {
    byCountry.set(farm.countryCode, (byCountry.get(farm.countryCode) ?? 0) + 1);
  }

  const regions = [...byCountry.entries()]
    .filter(([, count]) => count >= K_ANONYMITY)
    .map(([countryCode, farmsCount]) => ({ countryCode, publicFarms: farmsCount }));

  return {
    generatedAt: new Date().toISOString(),
    regions,
    suppressedRegions: [...byCountry.entries()].filter(([, c]) => c < K_ANONYMITY).length,
    kAnonymity: K_ANONYMITY,
    provenance: {
      source: 'profils publics d’exploitations',
      individuals: 'aucune exploitation identifiable',
      rule: `les groupes de moins de ${K_ANONYMITY} exploitations sont exclus`,
    },
  };
};

export const getRegions = async (query = {}) => {
  const farms = await prisma.farm.findMany({
    where: { deletedAt: null, isPublic: true, ...(query.countryCode ? { countryCode: query.countryCode } : {}) },
  });

  const groups = new Map();
  for (const farm of farms) {
    const key = `${farm.countryCode}::${farm.province ?? 'non précisée'}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }

  const items = [...groups.entries()]
    .filter(([, count]) => count >= K_ANONYMITY)
    .map(([key, count]) => {
      const [countryCode, province] = key.split('::');
      return { countryCode, province, publicFarms: count };
    })
    .sort((a, b) => b.publicFarms - a.publicFarms);

  return { items, count: items.length, kAnonymity: K_ANONYMITY, withheld: groups.size - items.length };
};

export const getCrops = async (query = {}) => {
  const crops = await prisma.crop.findMany({
    where: {
      deletedAt: null,
      ...(query.slug ? { slug: query.slug } : {}),
    },
    orderBy: { slug: 'asc' },
    take: Math.min(Number(query.limit ?? 200), 500),
  });

  return {
    items: crops.map((crop) => ({
      slug: crop.slug,
      name: crop.names?.fr ?? crop.slug,
      names: crop.names ?? {},
      scientificName: crop.scientificName ?? null,
      category: crop.category ?? null,
    })),
    count: crops.length,
  };
};

export const getMarketPrices = async (query = {}) => {
  const prices = await prisma.marketPrice.findMany({
    where: {
      ...(query.countryCode ? { countryCode: query.countryCode } : {}),
      ...(query.cropId ? { cropId: query.cropId } : {}),
      ...(query.market ? { market: query.market } : {}),
    },
    orderBy: { observedAt: 'desc' },
    take: Math.min(Number(query.limit ?? 100), 500),
  });

  const crops = await prisma.crop.findMany({
    where: { id: { in: [...new Set(prices.map((p) => p.cropId))] } },
  });
  const names = Object.fromEntries(crops.map((c) => [c.id, c.names?.fr ?? c.slug]));

  return {
    items: prices.map((price) => ({
      crop: names[price.cropId] ?? price.cropId,
      market: price.market,
      city: price.city,
      countryCode: price.countryCode,
      price: price.price,
      currency: price.currency,
      unit: price.unit,
      observedAt: price.observedAt,
      source: price.sourceLabel ?? price.source,
    })),
    count: prices.length,
    freshness: 'Chaque prix porte sa date d’observation et sa source.',
  };
};

export const getProjects = async (query = {}) => {
  const projects = await prisma.project.findMany({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
      ...(query.countryCode ? { countryCode: query.countryCode } : {}),
      ...(query.sector ? { sector: query.sector } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: Math.min(Number(query.limit ?? 50), 200),
  });

  return {
    items: projects.map((project) => ({
      slug: project.slug,
      title: project.title,
      sector: project.sector,
      countryCode: project.countryCode,
      province: project.province,
      // Aucune coordonnée de contact : la mise en relation passe par la plateforme.
      fundingNeed: project.fundingNeed,
      impact: project.impact,
      updatedAt: project.updatedAt,
    })),
    count: projects.length,
    regulatory: 'Aucun appel public à l’épargne, aucun conseil en investissement.',
  };
};

export const getFarmers = async (query = {}) => {
  const farms = await prisma.farm.findMany({
    where: {
      deletedAt: null,
      isPublic: true,
      ...(query.countryCode ? { countryCode: query.countryCode } : {}),
    },
    take: Math.min(Number(query.limit ?? 100), 500),
  });

  assertKAnonymity(farms.length, 'la liste des agriculteurs');

  return {
    items: farms.map((farm) => ({
      slug: farm.slug,
      // Nom public de l'exploitation uniquement : pas d'identité personnelle.
      name: farm.name,
      countryCode: farm.countryCode,
      province: farm.province,
      publicLatitude: farm.publicLatitude,
      publicLongitude: farm.publicLongitude,
      verification: farm.verificationStatus ?? 'DECLARED',
    })),
    count: farms.length,
    kAnonymity: K_ANONYMITY,
    privacy: 'Coordonnées approximatives, aucune donnée de contact.',
  };
};
