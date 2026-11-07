import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { supabase } from '../../config/supabase.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { paginationArgs, orderBy, textFilter } from '../../shared/pagination.js';
import { audit } from '../../shared/audit.js';
import { PERMISSIONS, GOVERNANCE_ROLES } from '../../shared/permissions.js';
import { auditSeverity, severityWhere } from './admin.security.schema.js';
import { assertMfa } from '../auth/mfa.service.js';

/**
 * Administration V1 (CDC §5.12).
 * Toute action d'administration écrit dans le journal d'audit (SEC-09).
 */

/** Tableau de bord : chaque chiffre est une agrégation réelle (P3 / M1 RG-M1-1). */

/**
 * Assemble la réponse du tableau de bord à partir des compteurs bruts.
 * Fonction **pure** : aucune accès base — testée dans tests/adminDashboard.test.mjs.
 */
export const buildDashboard = (raw, filters = {}) => ({
  // ── Comptes (P3 — conservés pour compatibilité) ──
  users: raw.usersTotal,
  farmers: raw.farmers,
  cooperatives: raw.cooperatives,
  farms: raw.farms,
  plots: raw.plots,
  productions: raw.productions,
  soilAssessments: raw.soilAssessments,
  pendingVerifications: raw.pendingVerifications,
  openReports: raw.openReports,
  // ── M1 — Comptes détaillés ──
  usersActive: raw.usersActive,
  usersSuspended: raw.usersSuspended,
  usersUnverifiedEmail: raw.usersUnverifiedEmail,
  usersMfa: raw.usersMfa,
  usersNewInPeriod: raw.usersNewInPeriod,
  // ── M1 — Organisations par type ──
  organizationsIndividual: raw.organizationsIndividual,
  organizationsCooperative: raw.organizationsCooperative,
  organizationsCompany: raw.organizationsCompany,
  // ── M1 — Marché ──
  listingsPublished: raw.listingsPublished,
  ordersInPeriod: raw.ordersInPeriod,
  disputesOpen: raw.disputesOpen,
  // ── M1 — Séries temporelles (RG-M1-1 : calculées, jamais figées) ──
  series: { signups: raw.signups },
  filters,
  generatedAt: new Date().toISOString(),
  note: 'Toutes les valeurs sont des agrégations calculées à la requête (aucune donnée fictive).',
});

/**
 * Sérialisation CSV de la vue — fonction pure (tests/adminDashboard.test.mjs).
 * Format `section,label,value`, en-tête inclus, virgules échappées.
 */
export const dashboardCsv = (kpis) => {
  const lignes = [
    ['COMPTES', 'Comptes crees', kpis.users],
    ['COMPTES', 'Comptes actifs', kpis.usersActive],
    ['COMPTES', 'Comptes suspendus', kpis.usersSuspended],
    ['COMPTES', 'Emails non verifies', kpis.usersUnverifiedEmail],
    ['COMPTES', 'MFA active', kpis.usersMfa],
    ['COMPTES', 'Nouveaux comptes (periode)', kpis.usersNewInPeriod],
    ['ORGANISATIONS', 'Individuelles', kpis.organizationsIndividual],
    ['ORGANISATIONS', 'Cooperatives', kpis.organizationsCooperative],
    ['ORGANISATIONS', 'Societes', kpis.organizationsCompany],
    ['ACTIVITE', 'Exploitations', kpis.farms],
    ['ACTIVITE', 'Parcelles', kpis.plots],
    ['ACTIVITE', 'Productions', kpis.productions],
    ['ACTIVITE', 'Analyses de sol', kpis.soilAssessments],
    ['ACTIVITE', 'Cooperatives actives', kpis.cooperatives],
    ['MARCHE', 'Annonces publiees', kpis.listingsPublished],
    ['MARCHE', 'Commandes (periode)', kpis.ordersInPeriod],
    ['MARCHE', 'Litiges ouverts', kpis.disputesOpen],
    ['QUALITE', 'Verifications en attente', kpis.pendingVerifications],
    ['QUALITE', 'Signalements ouverts', kpis.openReports],
  ];
  for (const point of kpis.series?.signups ?? []) {
    lignes.push(['SERIE', `Inscriptions ${point.month}`, point.count]);
  }
  const csv = (valeur) => `"${String(valeur ?? '').replace(/"/g, '""')}"`;
  return ['section,label,value', ...lignes.map((l) => l.map(csv).join(','))].join('\n');
};

/**
 * M1 — données du tableau de bord, avec filtres pays et période.
 * La période porte sur les « flux » (inscriptions, commandes) ; les stocks
 * (comptes, exploitations) sont filtrés par pays uniquement (RG-M1-1).
 */
export const dashboard = async (filters = {}) => {
  const { country = null, from = null, to = null } = filters;
  const pays = country ? String(country).toUpperCase() : null;
  const debut = from ? new Date(`${from}T00:00:00.000Z`) : null;
  const fin = to ? new Date(`${to}T23:59:59.999Z`) : null;
  const depuis12Mois = new Date();
  depuis12Mois.setUTCMonth(depuis12Mois.getUTCMonth() - 12);

  const userWhere = { deletedAt: null, ...(pays ? { countryCode: pays } : {}) };
  const orgWhere = { deletedAt: null, ...(pays ? { countryCode: pays } : {}) };
  const periodeWhere = {
    ...(debut || fin
      ? { createdAt: { ...(debut ? { gte: debut } : {}), ...(fin ? { lte: fin } : {}) } }
      : {}),
    ...(pays ? { countryCode: pays } : {}),
  };

  const [
    usersTotal, usersActive, usersSuspended, usersUnverifiedEmail, usersMfa, usersNewInPeriod,
    organizationsIndividual, organizationsCooperative, organizationsCompany,
    farmers, cooperatives, farms, plots, productions, soilAssessments,
    pendingVerifications, openReports, listingsPublished, ordersInPeriod, disputesOpen,
    signups,
  ] = await Promise.all([
    prisma.profile.count({ where: userWhere }),
    prisma.profile.count({ where: { ...userWhere, status: 'ACTIVE' } }),
    prisma.profile.count({ where: { ...userWhere, status: 'SUSPENDED' } }),
    prisma.profile.count({ where: { ...userWhere, emailVerifiedAt: null } }),
    prisma.profile.count({ where: { ...userWhere, mfaEnabled: true } }),
    prisma.profile.count({ where: { ...userWhere, ...periodeWhere } }),
    prisma.organization.count({ where: { ...orgWhere, type: 'INDIVIDUAL' } }),
    prisma.organization.count({ where: { ...orgWhere, type: 'COOPERATIVE' } }),
    prisma.organization.count({ where: { ...orgWhere, type: 'COMPANY' } }),
    prisma.membership.count({ where: { status: 'ACTIVE', roles: { has: 'FARMER' } } }),
    prisma.cooperative.count({ where: { deletedAt: null } }),
    prisma.farm.count({ where: { deletedAt: null } }),
    prisma.plot.count({ where: { deletedAt: null } }),
    prisma.production.count({ where: { deletedAt: null } }),
    prisma.soilAssessment.count({ where: { deletedAt: null } }),
    prisma.verification.count({ where: { status: 'PENDING' } }),
    prisma.report.count({ where: { status: 'OPEN' } }),
    prisma.listing.count({ where: { status: 'PUBLISHED' } }),
    prisma.order.count({ where: periodeWhere }),
    prisma.dispute.count({ where: { OR: [{ status: 'OPEN' }, { status: 'UNDER_REVIEW' }] } }),
    // Série d'inscriptions mensuelles (12 derniers mois), calculée en SQL pour
    // éviter de charger les profils en mémoire.
    pays
      ? prisma.$queryRaw`
          SELECT to_char(date_trunc('month', "created_at"), 'YYYY-MM') AS month, COUNT(*)::int AS count
          FROM "profiles"
          WHERE "deleted_at" IS NULL AND "created_at" >= ${depuis12Mois} AND "country_code" = ${pays}
          GROUP BY 1 ORDER BY 1`
      : prisma.$queryRaw`
          SELECT to_char(date_trunc('month', "created_at"), 'YYYY-MM') AS month, COUNT(*)::int AS count
          FROM "profiles"
          WHERE "deleted_at" IS NULL AND "created_at" >= ${depuis12Mois}
          GROUP BY 1 ORDER BY 1`,
  ]);

  return buildDashboard({
    usersTotal, usersActive, usersSuspended, usersUnverifiedEmail, usersMfa, usersNewInPeriod,
    organizationsIndividual, organizationsCooperative, organizationsCompany,
    farmers, cooperatives, farms, plots, productions, soilAssessments,
    pendingVerifications, openReports, listingsPublished, ordersInPeriod, disputesOpen,
    signups,
  }, { country: pays, from, to });
};

/**
 * M1 — export CSV de la vue : tracé dans le journal d'audit (RG-M1-4) puis
 * sérialisé par `dashboardCsv` (pur, testé).
 */
export const exportDashboardCsv = async (filters, req) => {
  const kpis = await dashboard(filters);
  await audit({
    actorId: req.user.id,
    action: 'admin.dashboard.export',
    resource: 'dashboard',
    req,
    newValue: { filters },
  });
  return {
    csv: dashboardCsv(kpis),
    filename: `agrikonnect-dashboard-${new Date().toISOString().slice(0, 10)}.csv`,
    generatedAt: kpis.generatedAt,
  };
};

/**
 * M2 U-M2-1 — constructeur de filtres de la liste utilisateurs (pur, testé).
 *
 * Filtres : terme `q`/`search` (e-mail, nom, téléphone), `role` (adhésion
 * portant ce rôle de gouvernance), `status`, `country`, `mfa`,
 * `emailVerified`/`phoneVerified`, bornes `createdFrom`/`createdTo`.
 */
export const usersWhere = (query = {}) => {
  const {
    q, search, role, status, country,
    mfa, emailVerified, phoneVerified, createdFrom, createdTo,
  } = query;
  const terme = String(q ?? search ?? '').trim();

  const verifie = (champ, valeur) =>
    (valeur === 'true' ? { [champ]: { not: null } } : { [champ]: null });

  return {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(country ? { countryCode: String(country).toUpperCase() } : {}),
    ...(mfa !== undefined ? { mfaEnabled: mfa === 'true' } : {}),
    ...(emailVerified !== undefined ? verifie('emailVerifiedAt', emailVerified) : {}),
    ...(phoneVerified !== undefined ? verifie('phoneVerifiedAt', phoneVerified) : {}),
    ...(createdFrom || createdTo
      ? {
          createdAt: {
            ...(createdFrom ? { gte: new Date(`${createdFrom}T00:00:00.000Z`) } : {}),
            ...(createdTo ? { lte: new Date(`${createdTo}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
    ...(role ? { memberships: { some: { roles: { has: role } } } } : {}),
    ...(terme
      ? {
          OR: [
            { email: textFilter(terme) },
            { firstName: textFilter(terme) },
            { lastName: textFilter(terme) },
            { phone: { contains: terme } },
          ],
        }
      : {}),
  };
};

export const listUsers = async (query) => {
  const { page, limit, sort, order } = query;
  const where = usersWhere(query);

  const [items, total] = await Promise.all([
    prisma.profile.findMany({
      where,
      ...paginationArgs({ page, limit }),
      orderBy: orderBy(sort, order, ['createdAt', 'email']),
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        countryCode: true,
        locale: true,
        status: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        mfaEnabled: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        createdAt: true,
        lastLoginAt: true,
        memberships: {
          select: { organizationId: true, roles: true, status: true, organization: { select: { type: true, name: true } } },
        },
      },
    }),
    prisma.profile.count({ where }),
  ]);

  return { items, total, page, limit };
};

/**
 * SPEC-SUPER-ADMIN RG-M2-2 / RG-G2 — garde d'acteur sur un compte cible.
 *
 *   - jamais d'action sur son propre compte (statut, suppression) — sauf
 *     `allowSelf` pour la révocation de rôle, où RG-G2 prévoit explicitement
 *     qu'un Super Admin peut se révoquer lui-même **s'il n'est pas le dernier** ;
 *   - un `ADMIN` (palier 1) n'atteint jamais un porteur de `SUPER_ADMIN` :
 *     seul un `SUPER_ADMIN` peut agir sur un autre `SUPER_ADMIN`.
 */
export const assertActorMayTouch = (req, target, { allowSelf = false } = {}) => {
  if (!allowSelf && req.user.id === target.id) {
    throw ApiError.badRequest('Tu ne peux pas agir sur ton propre compte');
  }
  return prisma.membership
    .findMany({ where: { userId: target.id }, select: { roles: true } })
    .then((membres) => {
      const cibleSuperAdmin = membres.some((m) => m.roles.includes('SUPER_ADMIN'));
      const acteurSuperAdmin = (req.user.roles ?? []).includes('SUPER_ADMIN');
      if (cibleSuperAdmin && !acteurSuperAdmin) {
        throw ApiError.forbidden('Seul un SUPER_ADMIN peut modifier un SUPER_ADMIN');
      }
    });
};

/**
 * RG-G2 — un refus qui protège la plateforme : aucune opération ne peut
 * laisser la gouvernance **sans aucun** SUPER_ADMIN actif (révocation,
 * suspension ou suppression du dernier titulaire).
 */
export const assertNotLastSuperAdmin = async (userId) => {
  const porteurs = await prisma.membership.findMany({
    where: { status: 'ACTIVE', roles: { has: 'SUPER_ADMIN' } },
    select: { userId: true },
  });
  const actifs = new Set(porteurs.map((m) => m.userId));
  if (actifs.has(userId) && actifs.size <= 1) {
    throw ApiError.conflict(
      'Opération refusée : il s\'agit du dernier SUPER_ADMIN actif (RG-G2)',
    );
  }
};

export const updateUserStatus = async (id, { status, reason }, req) => {
  if (req.user.id === id) throw ApiError.badRequest('Tu ne peux pas modifier ton propre statut');

  const target = await prisma.profile.findUnique({ where: { id } });
  if (!target) throw ApiError.notFound('Utilisateur introuvable');

  // Un ADMIN ne peut pas suspendre un SUPER_ADMIN
  await assertActorMayTouch(req, target);

  // U-M2-4 : motif requis — la mutation porte la justification dans l'audit.
  const motif = String(reason ?? '').trim();
  if (motif.length < 3) {
    throw ApiError.badRequest('Motif requis (3 caractères minimum)');
  }

  // RG-G2 : ne jamais suspendre le dernier SUPER_ADMIN actif.
  if (status === 'SUSPENDED') await assertNotLastSuperAdmin(id);

  const updated = await prisma.profile.update({
    where: { id },
    data: { status },
    select: { id: true, email: true, status: true },
  });

  await audit({
    actorId: req.user.id,
    action: 'admin.user.status',
    resource: 'profiles',
    resourceId: id,
    req,
    oldValue: { status: target.status },
    newValue: { status, reason: motif },
  });

  return updated;
};

export const listAuditLogs = async (query) => {
  const { page, limit, sort, order, resource, actorId, actor, action, from, to, severity } = query;

  const filters = [];
  if (resource) filters.push({ resource });
  if (action) filters.push({ action: { contains: action, mode: 'insensitive' } });

  // U-M6-1 — `actor` = identifiant exact **ou** fragment d'e-mail/nom, résolu
  // ici en identifiants (une seule implémentation de la recherche d'audit).
  const acteurIds = [];
  if (actorId) acteurIds.push(actorId);
  if (actor) {
    acteurIds.push(actor);
    const profils = await prisma.profile.findMany({
      where: {
        OR: [
          { email: { contains: actor, mode: 'insensitive' } },
          { firstName: { contains: actor, mode: 'insensitive' } },
          { lastName: { contains: actor, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
      take: 25,
    });
    acteurIds.push(...profils.map((p) => p.id));
  }
  if (acteurIds.length) filters.push({ actorId: { in: [...new Set(acteurIds)] } });

  if (from || to) {
    filters.push({
      createdAt: {
        ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
        ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
      },
    });
  }
  if (severity) filters.push(severityWhere(severity));

  const where = filters.length ? { AND: filters } : {};

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      ...paginationArgs({ page, limit }),
      orderBy: orderBy(sort, order, ['createdAt']),
      include: { actor: { select: { firstName: true, lastName: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Gravité dérivée de l'action (U-M6-1) — calculée, jamais stockée.
  return {
    items: items.map((row) => ({ ...row, severity: auditSeverity(row.action) })),
    total,
    page,
    limit,
  };
};

export const getSettings = async () => {
  const settings = await prisma.setting.findMany();
  return settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
};

export const updateSetting = async (key, value, req) => {
  const setting = await prisma.setting.upsert({
    where: { key },
    update: { value, updatedBy: req.user.id },
    create: { key, value, updatedBy: req.user.id },
  });

  await audit({
    actorId: req.user.id,
    action: 'admin.setting.update',
    resource: 'settings',
    resourceId: key,
    req,
    newValue: { key, value },
  });

  return setting;
};

/** Export CSV journalisé (CDC §5.12 : export CSV avec journalisation). */
export const exportFarmsCsv = async (req) => {
  const farms = await prisma.farm.findMany({
    where: { deletedAt: null },
    select: {
      slug: true,
      name: true,
      countryCode: true,
      province: true,
      totalAreaHa: true,
      isPublic: true,
      verificationStatus: true,
      createdAt: true,
    },
    take: 5000,
  });

  const header = 'slug,name,country,province,totalAreaHa,isPublic,verification,createdAt';
  const lines = farms.map((f) =>
    [
      f.slug,
      `"${(f.name ?? '').replace(/"/g, '""')}"`,
      f.countryCode,
      `"${(f.province ?? '').replace(/"/g, '""')}"`,
      f.totalAreaHa ?? '',
      f.isPublic,
      f.verificationStatus ?? 'UNVERIFIED',
      f.createdAt.toISOString(),
    ].join(','),
  );

  await audit({
    actorId: req.user.id,
    action: 'admin.export.farms',
    resource: 'farms',
    req,
    newValue: { rows: farms.length },
  });

  return `${header}\n${lines.join('\n')}`;
};

// ═══════════════════════════════════════════════════════════════════════════
// M2 — UTILISATEURS, ADMINISTRATEURS, RÔLES ET PERMISSIONS
// SPEC-SUPER-ADMIN §3.M2 (U-M2-1 → U-M2-6, RG-M2-1 → RG-M2-3, RG-G1 → RG-G5)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * U-M2-2 — fiche utilisateur complète : profil, organisation(s), adhésions et
 * rôles, état de vérification, MFA, dernière connexion, tentatives échouées,
 * verrouillage et historique d'actions auditées.
 */
export const getUser = async (id) => {
  const profile = await prisma.profile.findUnique({ where: { id } });
  if (!profile) throw ApiError.notFound('Utilisateur introuvable');

  // Trois requêtes ciblées (pas de jointure imbriquée, pas de N+1) :
  // adhésions, organisations, journal — composées ci-dessous.
  const membres = await prisma.membership.findMany({ where: { userId: id } });
  const [organisations, auditTrail] = await Promise.all([
    prisma.organization.findMany({
      where: { id: { in: membres.map((m) => m.organizationId) } },
    }),
    // Historique d'actions auditées : les 20 dernières, du plus récent au plus ancien.
    prisma.auditLog.findMany({
      where: { actorId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        action: true,
        resource: true,
        resourceId: true,
        createdAt: true,
        ip: true,
      },
    }),
  ]);
  const orgById = new Map(organisations.map((o) => [o.id, o]));

  return {
    user: profile,
    organizations: membres.map((m) => ({
      membershipId: m.id,
      organizationId: m.organizationId,
      organization: orgById.get(m.organizationId) ?? null,
      roles: m.roles,
      status: m.status,
      joinedAt: m.joinedAt,
    })),
    security: {
      mfaEnabled: Boolean(profile.mfaEnabled),
      failedLoginAttempts: profile.failedLoginAttempts,
      lockedUntil: profile.lockedUntil,
      locked: Boolean(profile.lockedUntil && profile.lockedUntil > new Date()),
    },
    verification: {
      emailVerifiedAt: profile.emailVerifiedAt,
      phoneVerifiedAt: profile.phoneVerifiedAt,
    },
    auditTrail,
  };
};

/** Trouve la cible ou répond 404 — rappelé par chaque action M2. */
const mustFindProfile = async (id) => {
  const target = await prisma.profile.findUnique({ where: { id } });
  if (!target || target.deletedAt) throw ApiError.notFound('Utilisateur introuvable');
  return target;
};

/**
 * U-M2-4 — déverrouillage après blocage anti brute-force (compteur remis à
 * zéro, verrou levé) — motif requis, action auditée (RG-M2-2).
 */
export const unlockUser = async (id, { reason }, req) => {
  const target = await mustFindProfile(id);
  await assertActorMayTouch(req, target);

  await prisma.profile.update({
    where: { id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  await audit({
    actorId: req.user.id,
    action: 'admin.user.unlock',
    resource: 'profiles',
    resourceId: id,
    req,
    oldValue: { failedLoginAttempts: target.failedLoginAttempts, lockedUntil: target.lockedUntil },
    newValue: { reason },
  });

  return { id, failedLoginAttempts: 0, lockedUntil: null };
};

/**
 * Révocation de **toutes** les sessions d'un utilisateur côté GoTrue
 * (`POST /auth/v1/admin/users/:id/logout` — API admin, clé de service).
 *
 * Aucun secret n'est journalisé. Si la passerelle d'authentification est
 * injoignable, l'erreur remonte : une révocation qui « passe » sans rien
 * révoquer serait une fonctionnalité fictive.
 */
export const revokeSessions = async (userId) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw ApiError.internal('Clé de service absente : révocation de session impossible');
  }
  const response = await fetch(
    `${env.SUPABASE_URL}/auth/v1/admin/users/${userId}/logout`,
    {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  ).catch((cause) => {
    throw ApiError.internal(`Passerelle d'authentification injoignable : ${cause?.message ?? cause}`);
  });

  if (!response.ok && response.status !== 404) {
    throw ApiError.internal(`Révocation des sessions refusée (HTTP ${response.status})`);
  }
  return true;
};

/**
 * U-M2-4 — forcer la déconnexion : toutes les sessions du compte sont
 * révoquées (access + refresh tokens détruits), l'action est auditée.
 */
export const forceLogout = async (id, { reason }, req) => {
  const target = await mustFindProfile(id);
  await assertActorMayTouch(req, target);

  await revokeSessions(id);

  await audit({
    actorId: req.user.id,
    action: 'admin.user.force_logout',
    resource: 'profiles',
    resourceId: id,
    req,
    newValue: { reason, sessionsRevoked: true },
  });

  return { id, sessionsRevoked: true };
};

/**
 * U-M2-4 — marquer e-mail ou téléphone vérifié (motif requis, audité).
 * Le canal `email` pose `emailVerifiedAt`, `phone` pose `phoneVerifiedAt`.
 */
export const markVerified = async (id, channel, { reason }, req) => {
  const target = await mustFindProfile(id);
  await assertActorMayTouch(req, target);

  const champ = channel === 'email' ? 'emailVerifiedAt' : 'phoneVerifiedAt';
  const precedent = target[champ];
  await prisma.profile.update({
    where: { id },
    data: { [champ]: new Date() },
  });

  await audit({
    actorId: req.user.id,
    action: channel === 'email' ? 'admin.user.verify_email' : 'admin.user.verify_phone',
    resource: 'profiles',
    resourceId: id,
    req,
    oldValue: { [champ]: precedent },
    newValue: { [champ]: 'now', reason },
  });

  return { id, [champ]: 'now' };
};

/**
 * U-M2-6 — matrice des permissions effective par rôle de gouvernance,
 * lue dans `PERMISSIONS` (aucune valeur en dur, aucune redécouverte).
 */
export const rolesMatrix = () => ({
  roles: GOVERNANCE_ROLES.map((role) => ({
    role,
    permissions: Object.keys(PERMISSIONS).filter(
      (permission) =>
        PERMISSIONS[permission].includes(role) || PERMISSIONS[permission].includes('*'),
    ),
  })),
  permissions: PERMISSIONS,
});

/**
 * U-M2-3 — résout l'adhésion cible d'une mutation de rôle.
 * `organizationId` fourni → l'adhésion à cette organisation, **créée si elle
 * manque** (« créer une adhésion manquante ») ; sinon l'adhésion principale
 * de l'utilisateur (première active, sinon la première).
 */
const resolveTargetMembership = async (req, userId, organizationId) => {
  const memberships = await prisma.membership.findMany({ where: { userId } });

  if (organizationId) {
    const trouvee = memberships.find((m) => m.organizationId === organizationId);
    if (trouvee) return trouvee;
    const organisation = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organisation || organisation.deletedAt) throw ApiError.notFound('Organisation introuvable');
    return prisma.membership.create({
      data: {
        userId,
        organizationId,
        roles: [],
        status: 'ACTIVE',
        createdBy: req.user.id,
      },
    });
  }

  const principale = memberships.find((m) => m.status === 'ACTIVE') ?? memberships[0];
  if (!principale) {
    throw ApiError.badRequest(
      'Aucune organisation rattachée à cet utilisateur — précisez organizationId',
    );
  }
  return principale;
};

/**
 * RG-G3 — « saisie du mot de passe courant » : le mot de passe de l'acteur est
 * vérifié par la passerelle d'authentification (aucun stockage local), puis la
 * session de contrôle créée pour la vérification est immédiatement fermée.
 */
const verifyCurrentPassword = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.session) {
    throw ApiError.unauthorized('Mot de passe courant incorrect (RG-G3)');
  }
  await supabase.auth.admin.signOut(data.session.access_token).catch(() => {});
};

/**
 * U-M2-3 (palier 2) — attribuer un rôle de gouvernance.
 *
 * RG-G1 : le `mfaCode` est vérifié contre la MFA réelle de l'acteur
 * (`assertMfa` — TOTP ou code de secours).
 * RG-G3 : nomination d'un `SUPER_ADMIN` = double validation (mot de passe
 * courant + code MFA) et audit `admin.superadmin.granted` avec les rôles
 * avant/après.
 * RG-M2-2 : toute la mutation est journalisée avec avant/après.
 */
export const grantRole = async (id, { role, organizationId, mfaCode, password, reason }, req) => {
  const target = await mustFindProfile(id);
  await assertActorMayTouch(req, target);

  // RG-G1 — second facteur réellement vérifié, jamais seulement déclaré.
  await assertMfa(req.user.id, mfaCode);

  // RG-G3 — double validation pour les nominations de Super Admin.
  if (role === 'SUPER_ADMIN') {
    await verifyCurrentPassword(req.user.email, password);
  }

  const membership = await resolveTargetMembership(req, id, organizationId);
  const avant = [...(membership.roles ?? [])];
  if (avant.includes(role)) throw ApiError.conflict('Ce rôle est déjà attribué à cet utilisateur');
  const apres = [...new Set([...avant, role])];

  await prisma.membership.update({ where: { id: membership.id }, data: { roles: apres } });

  await audit({
    actorId: req.user.id,
    action: role === 'SUPER_ADMIN' ? 'admin.superadmin.granted' : 'admin.role.granted',
    resource: 'memberships',
    resourceId: membership.id,
    req,
    oldValue: { roles: avant },
    newValue: { roles: apres, reason },
  });

  return { userId: id, organizationId: membership.organizationId, roles: apres };
};

/**
 * U-M2-3 (palier 2) — révoquer un rôle de gouvernance sur **toutes** les
 * adhésions de l'utilisateur qui le portent.
 *
 * RG-G2 : le dernier SUPER_ADMIN actif ne peut pas être révoqué.
 * RG-M2-2 : audit avec avant/après.
 */
export const revokeRole = async (id, role, req) => {
  const target = await mustFindProfile(id);
  // RG-G2 : la révocation de son propre rôle est permise — c'est la règle
  // « dernier SUPER_ADMIN » qui décide, pas un garde générique.
  await assertActorMayTouch(req, target, { allowSelf: true });

  const porteurs = await prisma.membership.findMany({
    where: { userId: id, roles: { has: role } },
  });
  if (porteurs.length === 0) throw ApiError.notFound('Ce rôle n\'est pas attribué à cet utilisateur');

  if (role === 'SUPER_ADMIN') await assertNotLastSuperAdmin(id);

  const resultats = [];
  for (const membership of porteurs) {
    const avant = [...membership.roles];
    const apres = avant.filter((r) => r !== role);
    // eslint-disable-next-line no-await-in-loop
    await prisma.membership.update({ where: { id: membership.id }, data: { roles: apres } });
    resultats.push({ organizationId: membership.organizationId, roles: apres });
    // eslint-disable-next-line no-await-in-loop
    await audit({
      actorId: req.user.id,
      action: role === 'SUPER_ADMIN' ? 'admin.superadmin.revoked' : 'admin.role.revoked',
      resource: 'memberships',
      resourceId: membership.id,
      req,
      oldValue: { roles: avant },
      newValue: { roles: apres },
    });
  }

  return { userId: id, role, memberships: resultats };
};

/**
 * U-M2-5 (palier 2) — suppression **logique** du compte (RG-G5 : jamais
 * physique) + révocation des sessions, le tout audité (RG-M2-2).
 */
export const deleteUser = async (id, { reason }, req) => {
  if (req.user.id === id) throw ApiError.badRequest('Tu ne peux pas supprimer ton propre compte');

  const target = await mustFindProfile(id);
  await assertActorMayTouch(req, target);

  const membres = await prisma.membership.findMany({ where: { userId: id }, select: { roles: true } });
  if (membres.some((m) => m.roles.includes('SUPER_ADMIN'))) {
    await assertNotLastSuperAdmin(id);
  }

  // Sessions fermées d'abord : si la révocation échoue, rien n'est supprimé.
  await revokeSessions(id);

  const updated = await prisma.profile.update({
    where: { id },
    data: { status: 'DELETED', deletedAt: new Date() },
    select: { id: true, email: true, status: true, deletedAt: true },
  });

  await audit({
    actorId: req.user.id,
    action: 'admin.user.deleted',
    resource: 'profiles',
    resourceId: id,
    req,
    oldValue: { status: target.status },
    newValue: { status: 'DELETED', reason },
  });

  return updated;
};

/**
 * U-M2-5 (palier 2) — export de portabilité des données personnelles de la
 * personne : profil, adhésions/organisations, vérifications, historique
 * d'actions. **Aucun secret** (jamais de hash, jeton ou code) — export audité.
 */
export const exportUserData = async (id, req) => {
  const target = await mustFindProfile(id);

  const [membres, verifications, activite] = await Promise.all([
    prisma.membership.findMany({ where: { userId: id } }),
    prisma.verification.findMany({
      where: { reviewedBy: id },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }).catch(() => []),
    prisma.auditLog.findMany({
      where: { actorId: id },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { id: true, action: true, resource: true, resourceId: true, createdAt: true, ip: true },
    }),
  ]);
  const organisations = await prisma.organization.findMany({
    where: { id: { in: membres.map((m) => m.organizationId) } },
    select: { id: true, type: true, name: true, slug: true, countryCode: true },
  });
  const orgById = new Map(organisations.map((o) => [o.id, o]));
  const adhésions = membres.map((m) => ({ ...m, organization: orgById.get(m.organizationId) ?? null }));

  const payload = {
    exportedAt: new Date().toISOString(),
    subject: { id: target.id, email: target.email },
    profile: target,
    memberships: adhésions,
    verifications,
    activity: activite,
    note: 'Export de portabilité (U-M2-5) — ne contient aucun secret (mot de passe, jeton, code).',
  };

  await audit({
    actorId: req.user.id,
    action: 'admin.user.export',
    resource: 'profiles',
    resourceId: id,
    req,
    newValue: { rows: 1 + membres.length + verifications.length + activite.length },
  });

  return payload;
};
