/**
 * Exigences CDC couvertes : API-01, API-02, API-03, API-04.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { sha256, generateToken } from '../../shared/crypto.js';
import { audit } from '../../shared/audit.js';

/**
 * API-01 → API-04 — Clients API et clés (V5).
 *
 * - Une clé n'est visible qu'à sa création : elle est ensuite stockée hachée.
 * - Un client ne peut consommer l'API publique que si son CONTRAT DE FINALITÉ
 *   est approuvé (`purposeApprovedAt`). C'est une condition dure, vérifiée
 *   dans `apiKeyAuth`, pas seulement ici.
 * - Chaque appel est journalisé et un quota journalier s'applique.
 */

export const createClient = async (payload, req) => {
  const client = await prisma.apiClient.create({
    data: {
      id: resolveId(payload.id) ?? resolveId(),
      organizationId: payload.organizationId ?? req.tenant.organizationId,
      name: payload.name,
      contactEmail: payload.contactEmail ?? null,
      scopes: payload.scopes,
      status: 'ACTIVE',
      dataPurpose: payload.dataPurpose,
      // La finalité doit être APPROUVÉE par un administrateur pour être utilisée
      purposeApprovedAt: null,
    },
  });

  await audit({ actorId: req.user.id, action: 'apiclient.create', resource: 'api_clients', resourceId: client.id, req, newValue: { name: client.name, scopes: client.scopes, dataPurpose: client.dataPurpose } });
  return client;
};

/** API-03 — approbation (ou refus) de la finalité déclarée. */
export const approvePurpose = async (clientId, { decision, comment }, req) => {
  const client = await prisma.apiClient.findUnique({ where: { id: clientId } });
  if (!client) throw ApiError.notFound('Client API introuvable');
  if (!client.dataPurpose) {
    throw ApiError.badRequest('Aucune finalité déclarée : impossible d\'approuver un usage indéfini');
  }

  const approved = decision === 'APPROVED';

  const updated = await prisma.apiClient.update({
    where: { id: clientId },
    data: {
      purposeApprovedAt: approved ? new Date() : null,
      approvedBy: approved ? req.user.id : null,
      status: approved ? 'ACTIVE' : client.status,
    },
  });

  await audit({ actorId: req.user.id, action: 'apiclient.purpose', resource: 'api_clients', resourceId: clientId, req, newValue: { decision, purpose: client.dataPurpose, comment: comment ?? null } });
  return { client: updated, approved, message: approved ? 'Finalité approuvée — clé utilisable' : 'Finalité refusée — aucune clé ne peut être utilisée' };
};

/** API-02 — émission d'une clé (affichée une seule fois). */
export const issueKey = async (clientId, payload, req) => {
  const client = await prisma.apiClient.findUnique({ where: { id: clientId }, include: { keys: true } });
  if (!client) throw ApiError.notFound('Client API introuvable');
  if (!client.purposeApprovedAt) {
    throw ApiError.forbidden('Finalité non approuvée : aucune clé ne peut être émise pour un usage non défini (API-03)');
  }
  if (client.keys.filter((k) => k.status === 'ACTIVE').length >= 5) {
    throw ApiError.conflict('Limite de 5 clés actives atteinte pour ce client');
  }

  const raw = `ak_${generateToken(24)}`;
  const prefix = raw.slice(0, 12);

  const key = await prisma.apiKey.create({
    data: {
      id: resolveId(),
      clientId,
      label: payload.label,
      prefix,
      keyHash: sha256(raw),
      status: 'ACTIVE',
      expiresAt: payload.expiresAt ?? null,
    },
  });

  await audit({ actorId: req.user.id, action: 'apikey.issue', resource: 'api_keys', resourceId: key.id, req, newValue: { clientId, prefix, label: key.label } });

  return {
    key: { id: key.id, label: key.label, prefix: key.prefix, expiresAt: key.expiresAt },
    // Seule occurrence de la clé en clair
    apiKey: raw,
    warning: 'Clé affichée une seule fois. Elle est stockée hachée (SHA-256) et ne peut pas être relue.',
  };
};

export const revokeKey = async (keyId, { reason }, req) => {
  const key = await prisma.apiKey.findUnique({ where: { id: keyId } });
  if (!key) throw ApiError.notFound('Clé introuvable');

  const updated = await prisma.apiKey.update({
    where: { id: keyId },
    data: { status: 'REVOKED', revokedAt: new Date() },
  });

  await audit({ actorId: req.user.id, action: 'apikey.revoke', resource: 'api_keys', resourceId: keyId, req, newValue: { reason: reason ?? null } });
  return { key: { id: updated.id, prefix: updated.prefix, status: updated.status }, revoked: true };
};

/** API-04 — suivi d'usage et de quota. */
export const usage = async (clientId, query, req) => {
  const client = await prisma.apiClient.findUnique({ where: { id: clientId }, include: { keys: true } });
  if (!client) throw ApiError.notFound('Client API introuvable');

  const days = Number(query.days ?? 7);
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);

  const [total, byRoute, last24h] = await Promise.all([
    prisma.apiUsage.count({ where: { clientId, at: { gte: since } } }),
    prisma.apiUsage.groupBy({
      by: ['route'],
      where: { clientId, at: { gte: since } },
      _count: { _all: true },
    }),
    prisma.apiUsage.count({ where: { clientId, at: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
  ]);

  const quota = Number(process.env.API_DAILY_QUOTA ?? 1000);

  return {
    client: { id: client.id, name: client.name, status: client.status, purposeApproved: Boolean(client.purposeApprovedAt) },
    window: { since, days },
    calls: total,
    last24h,
    quota: { limit: quota, used: last24h, remaining: Math.max(quota - last24h, 0) },
    byRoute: byRoute.map((r) => ({ route: r.route, calls: r._count._all })),
    keys: client.keys.map((k) => ({
      id: k.id, label: k.label, prefix: k.prefix, status: k.status,
      lastUsedAt: k.lastUsedAt, expiresAt: k.expiresAt,
    })),
  };
};

export const listClients = async (query) => {
  const clients = await prisma.apiClient.findMany({
    where: { ...(query.status ? { status: query.status } : {}) },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { keys: true } } },
    take: 200,
  });

  return {
    items: clients.map((c) => ({
      id: c.id,
      name: c.name,
      contactEmail: c.contactEmail,
      scopes: c.scopes,
      status: c.status,
      dataPurpose: c.dataPurpose,
      purposeApproved: Boolean(c.purposeApprovedAt),
      keys: c._count.keys,
    })),
    total: clients.length,
  };
};
