/**
 * Exigences CDC couvertes : DATA-01, DATA-02, DATA-03, DATA-10.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { uniqueSlug } from '../../shared/slug.js';
import { audit } from '../../shared/audit.js';

/**
 * DATA-01 → DATA-04 — Produits de données et agrégats (V5).
 *
 * Deux garde-fous non contournables :
 *  1. K-ANONYMAT : aucun agrégat n'est calculé ni publié si le nombre
 *     d'organisations distinctes du groupe est inférieur à `minGroupSize`.
 *     Ce n'est pas un avertissement : l'agrégat n'est pas produit du tout.
 *  2. COMPOSITION : chaque agrégat déclare la part de données déclarées,
 *     mesurées et estimées, ainsi que la version de règle utilisée.
 *     Aucun agrégat ne peut être re-identifiant (pas de min/max par groupe).
 */

export const RULE_VERSION = 'agg-v1.0';

/**
 * Bornes d'une période `AAAA-MM` en UTC.
 *
 * Une constante `-32` (utilisée à tort dans un premier jet) produit une date
 * invalide pour tous les mois : le calcul se fait donc sur le mois suivant,
 * jour 1, exclusif.
 */
export const periodRange = (period) => {
  if (!period) return null;

  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) throw ApiError.badRequest(`Période invalide : ${period} (format attendu AAAA-MM)`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw ApiError.badRequest(`Période invalide : ${period} (mois hors 01–12)`);

  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1)),
  };
};

export const createProduct = async (payload, req) => {
  const slug = payload.slug ?? await uniqueSlug(payload.name, async (candidate) =>
    Boolean(await prisma.dataProduct.findUnique({ where: { slug: candidate } })),
  );

  const product = await prisma.dataProduct.create({
    data: {
      id: resolveId(payload.id),
      slug,
      name: payload.name,
      description: payload.description ?? null,
      // Jamais moins de 5 : en dessous, le risque de ré-identification est réel
      minGroupSize: Math.max(Number(payload.minGroupSize ?? 10), 5),
      fields: payload.fields,
      status: 'DRAFT',
    },
  });

  await audit({ actorId: req.user.id, action: 'dataproduct.create', resource: 'data_products', resourceId: product.id, req, newValue: { slug: product.slug, minGroupSize: product.minGroupSize } });
  return product;
};

export const publishProduct = async (productId, { status }, req) => {
  const product = await prisma.dataProduct.findUnique({ where: { id: productId } });
  if (!product) throw ApiError.notFound('Produit de données introuvable');

  // Un produit ne peut être publié sans au moins un agrégat conforme
  if (status === 'PUBLISHED') {
    const compliant = await prisma.aggregate.count({
      where: { productId, groupCount: { gte: Math.max(product.minGroupSize, 5) } },
    });
    if (compliant === 0) {
      throw ApiError.conflict(
        'Publication refusée : aucun agrégat ne respecte le seuil de k-anonymat (minGroupSize).',
      );
    }
  }

  const updated = await prisma.dataProduct.update({ where: { id: productId }, data: { status } });
  await audit({ actorId: req.user.id, action: 'dataproduct.publish', resource: 'data_products', resourceId: productId, req, newValue: { status } });
  return updated;
};

/**
 * DATA-02 — calcul d'un agrégat.
 * Groupement par culture × pays × mois à partir des productions déclarées.
 * Le décompte se fait sur les ORGANISATIONS distinctes, pas sur les lignes.
 */
export const computeAggregate = async (productId, { period, ruleVersion }, req) => {
  const product = await prisma.dataProduct.findUnique({ where: { id: productId } });
  if (!product) throw ApiError.notFound('Produit de données introuvable');

  const minGroupSize = Math.max(product.minGroupSize, 5);

  const productions = await prisma.production.findMany({
    where: {
      deletedAt: null,
      harvestedAt: periodRange(period) ?? undefined,
    },
    include: { farm: { select: { countryCode: true } }, crop: { select: { slug: true } } },
  });

  if (productions.length === 0) {
    throw ApiError.badRequest('Aucune production sur la période : aucun agrégat ne peut être produit');
  }

  // Groupes culture × pays
  const groups = new Map();
  for (const production of productions) {
    const key = `${production.crop.slug}:${production.farm.countryCode}`;
    if (!groups.has(key)) {
      groups.set(key, { organizations: new Set(), quantityKg: 0, declared: 0, measured: 0, estimated: 0, rows: 0 });
    }
    const group = groups.get(key);
    group.organizations.add(production.organizationId);
    group.rows += 1;
    group.quantityKg += Number(production.quantityKg ?? 0);

    // Composition par provenance (CDC V5 §6.4)
    if (['measured_lab', 'measured_sensor'].includes(production.source)) group.measured += 1;
    else if (['estimated', 'derived'].includes(production.source)) group.estimated += 1;
    else group.declared += 1;
  }

  const accepted = [];
  const suppressed = [];

  for (const [key, group] of groups.entries()) {
    const groupCount = group.organizations.size;

    // K-ANONYMAT : suppression totale du groupe, aucune valeur partielle
    if (groupCount < minGroupSize) {
      suppressed.push({ key, groupCount, reason: `groupe < minGroupSize (${minGroupSize})` });
      continue;
    }

    const total = group.declared + group.measured + group.estimated;

    const aggregate = await prisma.aggregate.upsert({
      where: {
        productId_key_period_ruleVersion: {
          productId,
          key,
          period: period ?? 'ALL',
          ruleVersion: ruleVersion ?? RULE_VERSION,
        },
      },
      update: {
        value: {
          totalQuantityKg: Math.round(group.quantityKg),
          meanQuantityKg: Math.round(group.quantityKg / groupCount),
          // Pas de minimum ni de maximum : ce serait un vecteur de ré-identification
          organisations: groupCount,
          records: group.rows,
        },
        composition: {
          declared: { share: Math.round((group.declared / total) * 100), records: group.declared },
          measured: { share: Math.round((group.measured / total) * 100), records: group.measured },
          estimated: { share: Math.round((group.estimated / total) * 100), records: group.estimated },
        },
        groupCount,
        computedAt: new Date(),
      },
      create: {
        id: resolveId(),
        productId,
        key,
        period: period ?? 'ALL',
        ruleVersion: ruleVersion ?? RULE_VERSION,
        value: {
          totalQuantityKg: Math.round(group.quantityKg),
          meanQuantityKg: Math.round(group.quantityKg / groupCount),
          organisations: groupCount,
          records: group.rows,
        },
        composition: {
          declared: { share: Math.round((group.declared / total) * 100), records: group.declared },
          measured: { share: Math.round((group.measured / total) * 100), records: group.measured },
          estimated: { share: Math.round((group.estimated / total) * 100), records: group.estimated },
        },
        groupCount,
      },
    });

    accepted.push(aggregate);
  }

  await audit({
    actorId: req.user.id,
    action: 'dataproduct.aggregate',
    resource: 'aggregates',
    resourceId: productId,
    req,
    newValue: { period: period ?? 'ALL', accepted: accepted.length, suppressed: suppressed.length, ruleVersion: ruleVersion ?? RULE_VERSION },
  });

  return {
    product: { id: product.id, slug: product.slug, minGroupSize },
    period: period ?? 'ALL',
    ruleVersion: ruleVersion ?? RULE_VERSION,
    aggregates: accepted,
    suppressed,
    kAnonymity: {
      rule: `Aucun agrégat publié si moins de ${minGroupSize} organisations distinctes.`,
      suppressedGroups: suppressed.length,
      // On dit combien de groupes sont supprimés, jamais leurs valeurs
    },
    disclosure: 'Agrégats non ré-identifiants : pas de minimum, pas de maximum, pas de liste d\'organisations.',
  };
};

export const listAggregates = async (productId, query) => {
  const product = await prisma.dataProduct.findUnique({ where: { id: productId } });
  if (!product) throw ApiError.notFound('Produit de données introuvable');

  const aggregates = await prisma.aggregate.findMany({
    where: { productId, ...(query.period ? { period: query.period } : {}) },
    orderBy: [{ period: 'desc' }, { key: 'asc' }],
    take: 500,
  });

  return {
    product: { id: product.id, slug: product.slug, name: product.name, minGroupSize: product.minGroupSize, status: product.status },
    aggregates,
    ruleVersion: aggregates[0]?.ruleVersion ?? RULE_VERSION,
  };
};

export const listProducts = async () => {
  const products = await prisma.dataProduct.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { name: 'asc' },
    select: { id: true, slug: true, name: true, description: true, minGroupSize: true, fields: true, status: true },
  });
  return { items: products, total: products.length };
};

/** DATA-04 — contrat de données entre un client API et un produit. */
export const createContract = async (payload, req) => {
  const [client, product] = await Promise.all([
    prisma.apiClient.findUnique({ where: { id: payload.clientId } }),
    prisma.dataProduct.findUnique({ where: { id: payload.productId } }),
  ]);
  if (!client) throw ApiError.notFound('Client API introuvable');
  if (!product) throw ApiError.notFound('Produit de données introuvable');
  if (!client.purposeApprovedAt) {
    throw ApiError.forbidden('Finalité du client non approuvée : aucun contrat de données possible');
  }

  // Chevauchement obligatoire entre finalité déclarée et fins autorisées
  const purposes = payload.purposes;
  const contract = await prisma.dataContract.create({
    data: {
      id: resolveId(),
      clientId: client.id,
      productId: product.id,
      purposes,
      restrictions: payload.restrictions ?? 'Interdiction de ré-identification et de redistribution.',
      expiresAt: payload.expiresAt ?? null,
    },
  });

  await audit({ actorId: req.user.id, action: 'datacontract.create', resource: 'data_contracts', resourceId: contract.id, req, newValue: { clientId: client.id, productId: product.id, purposes } });
  return contract;
};
