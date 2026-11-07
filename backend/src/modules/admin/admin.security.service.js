/**
 * SPEC-SUPER-ADMIN M6 — Sécurité, accès, journaux d'activité et audits (§3).
 *
 * RG-S2 : `audit_logs` est en **insertion seule** — aucun endpoint de
 * modification ni de suppression n'existe ici ; seule l'exportation (auditée)
 * et la recherche sont offertes.
 * RG-S3 : aucun secret n'apparaît dans les journaux (règle projet maintenue).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { auditAs } from '../../shared/audit.js';
import { GOVERNANCE_ROLES } from '../../shared/permissions.js';
import { auditSeverity } from './admin.security.schema.js';
import { listAuditLogs } from './admin.service.js';
import { getSettingsView, updateSettings } from './admin.settings.service.js';

/** Plafond d'export — au-delà, la pagination s'impose (jamais de dump illimité). */
const EXPORT_CAP = 5000;

/**
 * U-M6-1 — recherche avancée : mêmes filtres que `GET /admin/audit`
 * (délégué à `admin.service.js#listAuditLogs` — une seule implémentation),
 * avec la gravité dérivée de l'action sur chaque ligne.
 */
export const searchAudit = (query) => listAuditLogs(query);

const csvCell = (value) => {
  const texte = value == null ? '' : String(value);
  return /[",;\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
};

/**
 * U-M6-1 — export du journal d'audit (CSV ou JSON), **audité**
 * (`admin.audit.export`, RG-M2-2 le même formalisme avant/après).
 * Le plafond `EXPORT_CAP` borne la sortie : un export est un extrait de
 * travail, pas une sauvegarde.
 */
export const exportAudit = async (query, req) => {
  const format = query.format ?? 'csv';
  const limit = Math.min(query.limit ?? EXPORT_CAP, EXPORT_CAP);

  const { items, total } = await listAuditLogs({ ...query, page: 1, limit });

  await auditAs(req, {
    action: 'admin.audit.export',
    resource: 'audit_logs',
    resourceId: null,
    newValue: {
      format,
      count: items.length,
      totalCorrespondant: total,
      filtres: {
        action: query.action ?? null,
        actor: query.actor ?? query.actorId ?? null,
        resource: query.resource ?? null,
        from: query.from ?? null,
        to: query.to ?? null,
        severity: query.severity ?? null,
      },
    },
  });

  const createdAt = new Date().toISOString().slice(0, 10);
  if (format === 'json') {
    return {
      contentType: 'application/json; charset=utf-8',
      filename: `audit-${createdAt}.json`,
      content: JSON.stringify(items, null, 2),
    };
  }

  const entetes = ['id', 'createdAt', 'actorId', 'actorEmail', 'severity', 'action', 'resource', 'resourceId', 'ip', 'oldValue', 'newValue'];
  const lignes = items.map((row) =>
    [
      row.id,
      row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      row.actorId,
      row.actor?.email ?? '',
      row.severity ?? auditSeverity(row.action),
      row.action,
      row.resource,
      row.resourceId,
      row.ip,
      row.oldValue == null ? '' : JSON.stringify(row.oldValue),
      row.newValue == null ? '' : JSON.stringify(row.newValue),
    ]
      .map(csvCell)
      .join(','),
  );
  return {
    contentType: 'text/csv; charset=utf-8',
    filename: `audit-${createdAt}.csv`,
    content: [entetes.join(','), ...lignes].join('\n'),
  };
};

/** Colonnes exposées pour un compte (jamais de hash ni de secret — RG-S3). */
const comptePublic = (p) => ({
  id: p.id,
  email: p.email,
  firstName: p.firstName,
  lastName: p.lastName,
  mfaEnabled: Boolean(p.mfaEnabled),
  failedLoginAttempts: p.failedLoginAttempts ?? 0,
  lockedUntil: p.lockedUntil ?? null,
  lastLoginAt: p.lastLoginAt ?? null,
});

/**
 * U-M6-2 — vue « sécurité » : connexions récentes et échecs, comptes
 * verrouillés, sessions actives (estimation — voir `sessions.note`), état MFA
 * des comptes de gouvernance (alerte si absent), clés API actives/expirées.
 *
 * Tout est calculé à la volée : aucune vue matérialisée, aucune donnée figée
 * (RG-M5-1 s'applique par cohérence).
 */
export const securityOverview = async () => {
  const maintenant = new Date();
  const jourAvant = new Date(maintenant.getTime() - 24 * 3600 * 1000);

  const [
    connexions,
    echecsRecents,
    echecs24h,
    verrouilles,
    adhesions,
    cles,
    clesExpirees,
    clesRecentes,
    jetons,
    revocations,
    signIns,
  ] = await Promise.all([
    prisma.auditLog.findMany({
      where: { action: 'auth.login' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { actor: { select: { firstName: true, lastName: true, email: true } } },
    }),
    prisma.auditLog.findMany({
      where: { action: { in: ['auth.login.failed', 'auth.login.locked', 'auth.login.mfa_failed'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { actor: { select: { firstName: true, lastName: true, email: true } } },
    }),
    prisma.auditLog.count({
      where: {
        action: { in: ['auth.login.failed', 'auth.login.locked', 'auth.login.mfa_failed'] },
        createdAt: { gte: jourAvant },
      },
    }),
    prisma.profile.findMany({
      where: { lockedUntil: { gt: maintenant }, deletedAt: null },
      take: 50,
    }),
    prisma.membership.findMany({
      where: { status: 'ACTIVE', roles: { hasSome: GOVERNANCE_ROLES } },
      take: 500,
    }),
    prisma.apiKey.count({
      where: {
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gte: maintenant } }],
      },
    }),
    prisma.apiKey.count({
      where: { status: 'ACTIVE', expiresAt: { lt: maintenant } },
    }),
    prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.token.findMany({
      where: { consumedAt: null, expiresAt: { gt: maintenant } },
      take: 500,
    }),
    prisma.auditLog.findMany({
      where: { action: 'admin.user.force_logout' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.profile.findMany({
      where: { lastLoginAt: { not: null }, deletedAt: null },
      orderBy: { lastLoginAt: 'desc' },
      take: 50,
    }),
  ]);

  // ── MFA des comptes de gouvernance (alerte si un compte n'a pas la MFA) ──
  const ids = [...new Set(adhesions.map((m) => m.userId))];
  const profils = ids.length
    ? await prisma.profile.findMany({ where: { id: { in: ids } }, take: 500 })
    : [];
  const profilById = new Map(profils.map((p) => [p.id, p]));
  const gouvernants = adhesions.map((m) => {
    const p = profilById.get(m.userId);
    return {
      userId: m.userId,
      organizationId: m.organizationId,
      roles: m.roles,
      email: p?.email ?? null,
      firstName: p?.firstName ?? null,
      lastName: p?.lastName ?? null,
      mfaEnabled: Boolean(p?.mfaEnabled),
      deletedAt: p?.deletedAt ?? null,
    };
  });
  const sansMfa = gouvernants.filter((g) => !g.mfaEnabled && !g.deletedAt);

  // ── Sessions actives : fenêtre = `security.sessionTtlHours` (politique) ──
  // Les jetons de session vivent côté Supabase GoTrue : la liste ci-dessous est
  // une **estimation** issue des journaux (dernière connexion dans la fenêtre
  // de validité, sans révocation ultérieure) — jamais présentée comme la liste
  // exhaustive des refresh tokens.
  const view = await getSettingsView();
  const ttlHeures = Number(view.values?.['security.sessionTtlHours'] ?? 12);
  const fenetre = new Date(maintenant.getTime() - ttlHeures * 3600 * 1000);
  const revocationParUtilisateur = new Map();
  for (const r of revocations) {
    const cible = r.resourceId ?? r.actorId;
    if (cible && !revocationParUtilisateur.has(cible)) revocationParUtilisateur.set(cible, r.createdAt);
  }
  const sessionsActives = signIns
    .filter((p) => p.lastLoginAt && p.lastLoginAt >= fenetre)
    .filter((p) => !(revocationParUtilisateur.get(p.id) > p.lastLoginAt))
    .map((p) => ({
      userId: p.id,
      email: p.email,
      firstName: p.firstName,
      lastName: p.lastName,
      lastLoginAt: p.lastLoginAt,
    }));

  const jetonsParUsage = {};
  for (const t of jetons) jetonsParUsage[t.purpose] = (jetonsParUsage[t.purpose] ?? 0) + 1;

  return {
    generatedAt: maintenant.toISOString(),
    connections: {
      note: 'Connexions réussies issues de `audit_logs` (`auth.login`), du plus récent au plus ancien.',
      recent: connexions.map((row) => ({
        at: row.createdAt,
        userId: row.actorId,
        email: row.actor?.email ?? null,
        firstName: row.actor?.firstName ?? null,
        lastName: row.actor?.lastName ?? null,
        ip: row.ip ?? null,
      })),
    },
    failures: {
      note: 'Échecs de connexion (`auth.login.failed`), verrouillements (`auth.login.locked`) et codes MFA invalides (`auth.login.mfa_failed`).',
      last24h: echecs24h,
      recent: echecsRecents.map((row) => ({
        at: row.createdAt,
        action: row.action,
        userId: row.actorId,
        email: row.actor?.email ?? null,
        ip: row.ip ?? null,
      })),
    },
    lockedAccounts: verrouilles.map((p) => ({
      ...comptePublic(p),
      lockedUntil: p.lockedUntil,
    })),
    governanceMfa: {
      note: 'Comptes portant un rôle de gouvernance (RG-S1 : la MFA est obligatoire).',
      total: gouvernants.length,
      withoutMfa: sansMfa.map((g) => ({
        userId: g.userId,
        email: g.email,
        roles: g.roles,
      })),
      members: gouvernants,
    },
    apiKeys: {
      active: cles,
      expiredStillActive: clesExpirees,
      recent: clesRecentes.map((k) => ({
        id: k.id,
        label: k.label,
        prefix: k.prefix,
        status: k.status,
        expiresAt: k.expiresAt ?? null,
        lastUsedAt: k.lastUsedAt ?? null,
        createdAt: k.createdAt,
      })),
      note:
        '`active` = clés utilisables (statut ACTIVE, non périmées) ; `expiredStillActive` = clés '
        + 'encore marquées ACTIVE mais périmées, révoquées par la tâche `apikeys.expire`. '
        + 'Aucun hash de clé n’est exposé (RG-S3).',
    },
    sessions: {
      note:
        'Estimation issue des journaux (dernière connexion dans la fenêtre `security.sessionTtlHours`, '
        + 'hors comptes révoqués depuis) : les jetons réels (access/refresh) vivent côté Supabase GoTrue '
        + 'et se révoquent via `POST /admin/users/:id/force-logout`.',
      ttlHours: ttlHeures,
      active: sessionsActives,
      pendingTokens: { byPurpose: jetonsParUsage, total: jetons.length },
      revocations: revocations.map((row) => ({ at: row.createdAt, userId: row.resourceId })),
    },
  };
};

/**
 * U-M6-3 — politique de sécurité (palier 2) : lecture et mise à jour des
 * clés `security.*` du catalogue M3. La validation (type, plage), la révision
 * et l'audit sont **celles du service de paramètres** — une seule source de
 * vérité, jamais une copie parallèle.
 */
export const getPolicy = async () => {
  const view = await getSettingsView();
  return {
    section: 'security',
    tier: 2,
    ...view.sections.security,
    updatedAt: view.updatedAt ?? null,
  };
};

export const updatePolicy = async ({ values, reason }, req) => {
  if (!values || typeof values !== 'object' || Array.isArray(values) || !Object.keys(values).length) {
    throw ApiError.badRequest('`values` doit contenir au moins un paramètre `security.*`');
  }
  for (const key of Object.keys(values)) {
    if (!key.startsWith('security.')) {
      throw ApiError.badRequest(`La politique de sécurité ne couvre que les clés « security.* » (reçu : « ${key} »)`);
    }
  }
  await updateSettings({ section: 'security', values }, req);
  const policy = await getPolicy();
  return { ...policy, lastReason: reason ?? null };
};
