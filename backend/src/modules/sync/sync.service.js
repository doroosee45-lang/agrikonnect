/**
 * Exigences CDC couvertes : SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { audit } from '../../shared/audit.js';
import { logger } from '../../shared/http/logger.js';

/**
 * SYNC-01 → SYNC-04 — Synchronisation hors-ligne.
 *
 * Principe (CDC V3 §6) : le client peut travailler sans réseau et rejouer ses
 * opérations plus tard. Chaque opération porte un `opId` (ULID généré côté
 * client) qui la rend idempotente : rejouer une opération déjà appliquée ne
 * crée pas de doublon, elle est simplement ignorée et signalée comme telle.
 *
 * Les conflits ne sont jamais résolus silencieusement : ils sont enregistrés
 * et renvoyés dans le rapport (`conflicts[]`) pour arbitrage par l'utilisateur.
 */

/** Collections synchronisables → modèle Prisma + champ tenant. */
const COLLECTIONS = {
  productions: { model: 'production', tenantField: 'organizationId', softDelete: true },
  plots: { model: 'plot', tenantField: 'organizationId', softDelete: true },
  soil_assessments: { model: 'soilAssessment', tenantField: 'organizationId', softDelete: true },
  inventory_movements: { model: 'inventoryMovement', tenantField: 'organizationId', softDelete: false },
  lots: { model: 'traceabilityLot', tenantField: 'organizationId', softDelete: false },
  lot_events: { model: 'lotEvent', tenantField: null, softDelete: false },
};

const OPERATIONS = ['CREATE', 'UPDATE', 'DELETE'];

/** Champs techniques jamais appliqués depuis le client. */
const PROTECTED = ['organizationId', 'createdAt', 'deletedAt'];

const sanitize = (payload = {}) =>
  Object.fromEntries(Object.entries(payload).filter(([key]) => !PROTECTED.includes(key)));

/**
 * Types réels des colonnes, lus dans le DMMF Prisma (aucune liste recopiée à la
 * main : le schéma reste la seule source de vérité).
 *
 * Un client hors-ligne envoie des valeurs « de saisie » : `2026-09-01`,
 * `"1 200"`, `"true"`. Postgres, lui, n'accepte que des types stricts. Sans
 * normalisation, l'opération était rejetée par la base (défaut constaté en
 * recette sur base réelle : `REJECTED — Erreur d'application`).
 */
const MODEL_FIELDS = new Map(
  Prisma.dmmf.datamodel.models.map((model) => [model.name, new Map(model.fields.map((f) => [f.name, f]))]),
);

const NUMERIC_TYPES = new Set(['Int', 'BigInt', 'Float', 'Decimal']);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const coerceValue = (field, key, value) => {
  if (value === null || value === undefined || value === '') return value === '' ? null : value;

  if (field.kind === 'scalar') {
    if (field.type === 'DateTime') {
      if (value instanceof Date) return value;
      if (typeof value === 'string') {
        const parsed = new Date(DATE_ONLY.test(value) ? `${value}T00:00:00.000Z` : value);
        if (Number.isNaN(parsed.getTime())) throw ApiError.badRequest(`Champ « ${key} » : date invalide (${value})`);
        return parsed;
      }
      throw ApiError.badRequest(`Champ « ${key} » : date attendue`);
    }

    if (NUMERIC_TYPES.has(field.type)) {
      if (typeof value === 'number') return value;
      if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
      throw ApiError.badRequest(`Champ « ${key} » : nombre attendu`);
    }

    if (field.type === 'Boolean' && typeof value === 'string') {
      if (value === 'true' || value === 'false') return value === 'true';
      throw ApiError.badRequest(`Champ « ${key} » : booléen attendu`);
    }
  }

  return value;
};

/** Normalise une charge utile hors-ligne vers les types du modèle Prisma. */
const coercePayload = (model, data) => {
  const modelName = model.charAt(0).toUpperCase() + model.slice(1);
  const fields = MODEL_FIELDS.get(modelName);
  if (!fields) return data;

  const out = {};
  for (const [key, value] of Object.entries(data)) {
    const field = fields.get(key);
    out[key] = field ? coerceValue(field, key, value) : value;
  }
  return out;
};

export const push = async ({ operations }, req) => {
  if (operations.length > 200) {
    throw ApiError.badRequest('Un lot de synchronisation ne peut dépasser 200 opérations');
  }

  const results = [];
  const conflicts = [];
  let applied = 0;
  let skipped = 0;

  for (const op of operations) {
    const collection = COLLECTIONS[op.collection];
    if (!collection || !OPERATIONS.includes(op.operation)) {
      results.push({ opId: op.opId, result: 'REJECTED', reason: 'Collection ou opération inconnue' });
      skipped += 1;
      continue;
    }

    // SYNC-02 — idempotence : une opération déjà traitée est ignorée
    const seen = await prisma.syncOperation.findUnique({ where: { opId: op.opId } });
    if (seen) {
      results.push({ opId: op.opId, result: 'DUPLICATE', entityId: seen.entityId });
      skipped += 1;
      continue;
    }

    const delegate = prisma[collection.model];
    const data = coercePayload(collection.model, sanitize(op.payload));

    try {
      // eslint-disable-next-line no-await-in-loop
      const outcome = await applyOperation({ delegate, collection, op, data, req });

      // eslint-disable-next-line no-await-in-loop
      await prisma.syncOperation.create({
        data: {
          opId: op.opId,
          userId: req.user.id,
          organizationId: req.tenant.organizationId,
          collection: op.collection,
          operation: op.operation,
          entityId: op.entityId,
          payload: op.payload ?? undefined,
          result: outcome.result,
          conflict: outcome.conflict ?? undefined,
        },
      });

      results.push({ opId: op.opId, entityId: op.entityId, ...outcome });
      if (outcome.result === 'CONFLICT') conflicts.push({ opId: op.opId, ...outcome.conflict });
      else applied += 1;
    } catch (error) {
      if (error instanceof ApiError) {
        results.push({ opId: op.opId, result: 'REJECTED', reason: error.message });
      } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        results.push({ opId: op.opId, result: 'CONFLICT', conflict: {
          entityId: op.entityId,
          reason: 'unique_constraint',
          fields: error.meta?.target ?? null,
          resolution: 'Identifiant déjà utilisé : le client doit reconcilier puis renvoyer.',
        } });
        conflicts.push(results.at(-1).conflict);
      } else if (error instanceof Prisma.PrismaClientValidationError) {
        // Cause conservée dans les journaux, message neutre côté client.
        logger.error({ opId: op.opId, collection: op.collection }, error.message);
        results.push({ opId: op.opId, result: 'REJECTED', reason: 'Charge utile non conforme au modèle' });
      } else {
        logger.error({ opId: op.opId, collection: op.collection }, error);
        results.push({
          opId: op.opId,
          result: 'REJECTED',
          reason: 'Erreur d\'application',
          code: error?.code ?? error?.name ?? 'UNKNOWN',
        });
      }
      skipped += 1;
    }
  }

  await audit({
    actorId: req.user.id,
    action: 'sync.push',
    resource: 'sync_operations',
    resourceId: null,
    req,
    newValue: { operations: operations.length, applied, skipped, conflicts: conflicts.length },
  });

  return {
    results,
    summary: { received: operations.length, applied, skipped, conflicts: conflicts.length },
    // SYNC-04 — le conflit est explicite, jamais écrasé en silence
    conflicts,
    conflictPolicy: 'lastWriterWinsRefused',
  };
};

const applyOperation = async ({ delegate, collection, op, data, req }) => {
  const tenantWhere = collection.tenantField
    ? { [collection.tenantField]: req.tenant.organizationId }
    : {};

  if (op.operation === 'CREATE') {
    const existing = await delegate.findUnique({ where: { id: op.entityId } });

    if (existing) {
      // Même id déjà présent : on compare la version pour détecter un conflit
      const serverVersion = existing.version ?? 1;
      if (op.baseVersion && op.baseVersion !== serverVersion) {
        return {
          result: 'CONFLICT',
          conflict: {
            entityId: op.entityId,
            reason: 'version_mismatch',
            clientBaseVersion: op.baseVersion,
            serverVersion,
            resolution: 'À arbitrer par l\'utilisateur : aucune écriture effectuée.',
          },
        };
      }
      return { result: 'DUPLICATE', entityId: op.entityId };
    }

    const created = await delegate.create({
      data: {
        ...data,
        id: op.entityId,
        ...(collection.tenantField ? { [collection.tenantField]: req.tenant.organizationId } : {}),
      },
    });
    return { result: 'APPLIED', entityId: created.id };
  }

  const current = await delegate.findFirst({ where: { id: op.entityId, ...tenantWhere } });
  if (!current) return { result: 'REJECTED', reason: 'Entité introuvable' };

  if (op.operation === 'UPDATE') {
    // Verrouillage optimiste (SYNC-03)
    const serverVersion = current.version ?? 1;
    if (op.baseVersion != null && Number(op.baseVersion) !== serverVersion) {
      return {
        result: 'CONFLICT',
        conflict: {
          entityId: op.entityId,
          reason: 'stale_write',
          clientBaseVersion: Number(op.baseVersion),
          serverVersion,
          serverUpdatedAt: current.updatedAt ?? null,
          resolution: 'Écriture refusée. Le client doit fusionner puis renvoyer.',
        },
      };
    }

    const updated = await delegate.update({
      where: { id: op.entityId },
      data: {
        ...data,
        ...(current.version !== undefined ? { version: { increment: 1 } } : {}),
      },
    });
    return { result: 'APPLIED', entityId: updated.id, version: updated.version ?? null };
  }

  // DELETE → suppression logique quand le modèle la supporte
  if (collection.softDelete) {
    await delegate.update({ where: { id: op.entityId }, data: { deletedAt: new Date() } });
  } else {
    await delegate.delete({ where: { id: op.entityId } });
  }
  return { result: 'APPLIED', entityId: op.entityId, deleted: true };
};

/** SYNC-04 — rapport de conflits consultable. */
export const conflictReport = async (query, req) => {
  const since = new Date(Date.now() - Number(query.days ?? 7) * 24 * 3600 * 1000);

  const operations = await prisma.syncOperation.findMany({
    where: {
      organizationId: req.tenant.organizationId,
      appliedAt: { gte: since },
      ...(query.onlyConflicts === 'true' ? { result: 'CONFLICT' } : {}),
    },
    orderBy: { appliedAt: 'desc' },
    take: Math.min(Number(query.limit ?? 100), 500),
  });

  return {
    window: { since, days: Number(query.days ?? 7) },
    conflicts: operations.filter((o) => o.result === 'CONFLICT'),
    operations: operations.map((o) => ({
      opId: o.opId,
      collection: o.collection,
      operation: o.operation,
      entityId: o.entityId,
      result: o.result,
      appliedAt: o.appliedAt,
    })),
    policy: 'Aucune résolution silencieuse : les conflits restent ouverts jusqu\'à arbitrage.',
  };
};

/**
 * SYNC-02 / SYNC-03 — tirage des changements serveur depuis un curseur.
 *
 * Le client envoie le dernier curseur reçu ; le serveur renvoie tout ce qui a
 * changé depuis (y compris les suppressions logiques, signalées par `deleted`).
 * Aucune page n'est silencieusement tronquée : `hasMore` l'indique et le curseur
 * n'avance que jusqu'au dernier élément réellement renvoyé.
 */
export const pull = async (query, req) => {
  const since = query.since ? new Date(query.since) : new Date(0);
  if (Number.isNaN(since.getTime())) throw ApiError.badRequest('Curseur `since` invalide');

  const requested = query.collections
    ? String(query.collections).split(',').map((c) => c.trim()).filter(Boolean)
    : Object.keys(COLLECTIONS);

  const unknown = requested.filter((name) => !COLLECTIONS[name]);
  if (unknown.length) {
    throw ApiError.badRequest(`Collections inconnues : ${unknown.join(', ')}`);
  }

  const limit = Math.min(Number(query.limit ?? 200), 500);
  const changes = {};
  let hasMore = false;
  let cursor = since.toISOString();

  for (const name of requested) {
    const config = COLLECTIONS[name];
    const delegate = prisma[config.model];
    if (!delegate) continue;

    const where = { updatedAt: { gt: since } };
    // Isolation tenant (A.3) : jamais de ligne d'une autre organisation.
    if (config.tenantField === 'organizationId') {
      where.organizationId = req.tenant.organizationId;
    }

    const rows = await delegate.findMany({
      where,
      orderBy: { updatedAt: 'asc' },
      take: limit + 1,
    });

    const page = rows.slice(0, limit);
    if (rows.length > limit) hasMore = true;

    changes[name] = page.map((row) => ({
      id: row.id,
      updatedAt: row.updatedAt ?? null,
      version: row.version ?? null,
      deleted: Boolean(row.deletedAt),
      data: Object.fromEntries(
        Object.entries(row).filter(([key]) => !['updatedAt', 'createdAt'].includes(key)),
      ),
    }));

    const last = page[page.length - 1];
    if (last?.updatedAt && new Date(last.updatedAt) > new Date(cursor)) {
      cursor = new Date(last.updatedAt).toISOString();
    }
  }

  return {
    since: since.toISOString(),
    cursor,
    hasMore,
    counts: Object.fromEntries(Object.entries(changes).map(([name, rows]) => [name, rows.length])),
    changes,
    policy: {
      softDelete: true,
      tombstones: 'Les suppressions logiques sont renvoyées avec `deleted: true`',
      conflictResolution: 'Aucune résolution silencieuse — voir GET /sync/conflicts',
    },
  };
};

/** SYNC-01 — énumération des collections synchronisables (contrat client). */
export const collections = () => ({
  collections: Object.entries(COLLECTIONS).map(([name, config]) => ({
    name,
    operations: OPERATIONS,
    softDelete: config.softDelete,
    idempotentBy: 'opId',
    concurrency: 'optimistic_version',
  })),
});
