/**
 * Exigences CDC couvertes : PROF-01, PROF-03.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { supabase, supabaseAdmin } from '../../config/supabase.js';
import { logger } from '../../shared/http/logger.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { PERMISSIONS, can } from '../../shared/permissions.js';
import { audit } from '../../shared/audit.js';
import { publicUser } from '../auth/auth.service.js';

/**
 * PROF-03 — complétude du profil : liste explicite des critères manquants.
 * Aucun « score » opaque : on expose des critères cochés (CDC A4 / VER-05).
 */
const ROLES_PRODUCTION = ['FARMER', 'COOPERATIVE_ADMIN', 'COOPERATIVE_MEMBER', 'AGRICULTURAL_COMPANY'];

/**
 * Rôles dont le métier consiste à intervenir PERSONNELLEMENT auprès d'autres
 * acteurs (recommandation, vérification, analyse, accompagnement de terrain) :
 * leur profil professionnel (poste, domaine, biographie) fonde la confiance
 * qu'on leur accorde. Pour eux seuls, il compte dans la complétude.
 *
 * Les autres rôles n'en dépendent pas : producteurs (critères d'exploitation),
 * acheteurs, fournisseurs et transporteurs (identifiés par leur organisation),
 * investisseurs (profil investisseur dédié). Leur complétude reste inchangée.
 */
export const ROLES_PROFIL_PROFESSIONNEL = ['AGRONOMIST', 'VERIFIER', 'LAB_PARTNER', 'SUPPORT_AGENT'];

/** Exportée pour les tests : critères applicables selon les rôles réellement détenus. */
export const completenessCriteria = ({ profile, farms, plots, productions, roles = [] }) => {
  const criteres = [
  { key: 'identity', label: 'Nom et prénom renseignés', done: Boolean(profile.firstName && profile.lastName) },
  { key: 'phone_verified', label: 'Téléphone vérifié', done: Boolean(profile.phoneVerifiedAt) },
  { key: 'email_verified', label: 'Email vérifié', done: Boolean(profile.emailVerifiedAt) },
  { key: 'avatar', label: 'Photo de profil', done: Boolean(profile.avatarUrl) },
  {
    key: 'professional',
    label: 'Profil professionnel renseigné',
    done: Boolean(
      profile.professionalProfile?.jobTitle &&
        profile.professionalProfile?.activityDomain &&
        profile.professionalProfile?.biography,
    ),
  },
  { key: 'farm', label: 'Au moins une exploitation créée', done: farms > 0 },
  { key: 'plot', label: 'Au moins une parcelle localisée', done: plots > 0 },
  { key: 'production', label: 'Au moins une production déclarée', done: productions > 0 },
  ];
  const horsProduction = new Set(['farm', 'plot', 'production']);
  const producteur = roles.some((r) => ROLES_PRODUCTION.includes(r));
  const intervenant = roles.some((r) => ROLES_PROFIL_PROFESSIONNEL.includes(r));
  return criteres.filter((c) => {
    if (horsProduction.has(c.key)) return producteur;
    if (c.key === 'professional') return intervenant;
    return true;
  });
};

export const getMe = async (req) => {
  const profile = await prisma.profile.findUnique({
    where: { id: req.user.id },
    include: {
      memberships: {
        where: { status: 'ACTIVE' },
        include: { organization: true },
      },
    },
  });

  if (!profile) throw ApiError.notFound('Profil introuvable');

  const organizationIds = profile.memberships.map((m) => m.organizationId);

  const [farms, plots, productions] = await Promise.all([
    prisma.farm.count({ where: { organizationId: { in: organizationIds }, deletedAt: null } }),
    prisma.plot.count({ where: { organizationId: { in: organizationIds }, deletedAt: null } }),
    prisma.production.count({ where: { organizationId: { in: organizationIds }, deletedAt: null } }),
  ]);

  const roles = profile.memberships.flatMap((m) => m.roles ?? []);
  const criteria = completenessCriteria({ profile, farms, plots, productions, roles });
  const done = criteria.filter((c) => c.done).length;

  return {
    user: publicUser(profile, profile.memberships),
    completeness: {
      // Pourcentage indicatif, toujours accompagné de la liste des critères
      percent: Math.round((done / criteria.length) * 100),
      done,
      total: criteria.length,
      criteria,
      missing: criteria.filter((c) => !c.done).map((c) => c.key),
    },
    counts: { farms, plots, productions },
    activeOrganizationId: req.tenant?.organizationId ?? null,
  };
};

export const updateMe = async (payload, req) => {
  const before = await prisma.profile.findUnique({ where: { id: req.user.id } });
  if (!before) throw ApiError.notFound('Profil introuvable');

  const data = { ...payload };

  // Un nouveau numéro doit être re-vérifié : on efface la date de vérification.
  if (payload.phone && payload.phone !== before.phone) {
    data.phoneVerifiedAt = null;
  }

  const updated = await prisma.profile.update({ where: { id: req.user.id }, data });

  await audit({
    actorId: req.user.id,
    action: 'profile.update',
    resource: 'profiles',
    resourceId: req.user.id,
    req,
    oldValue: {
      firstName: before.firstName,
      lastName: before.lastName,
      whatsapp: before.whatsapp,
      locale: before.locale,
      phone: before.phone,
    },
    newValue: payload,
  });

  const memberships = await prisma.membership.findMany({
    where: { userId: req.user.id, status: 'ACTIVE' },
    include: { organization: { select: { id: true, type: true, name: true, slug: true } } },
  });

  return { user: publicUser(updated, memberships) };
};

/** Portabilité RGPD : projection du compte courant, sans secret ni jeton. */
export const exportMe = async (req) => {
  const profile = await prisma.profile.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      whatsapp: true,
      locale: true,
      countryCode: true,
      avatarUrl: true,
      professionalProfile: true,
      accountPreferences: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!profile) throw ApiError.notFound('Profil introuvable');

  const [memberships, investor, notifications, smsConsents] = await Promise.all([
    prisma.membership.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        organizationId: true,
        roles: true,
        status: true,
        joinedAt: true,
        consentScopes: true,
        organization: {
          select: {
            id: true,
            type: true,
            name: true,
            description: true,
            profileDetails: true,
            settings: true,
            countryCode: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.investorProfile.findUnique({
      where: { userId: req.user.id },
      select: {
        displayName: true,
        sectors: true,
        countries: true,
        ticketMin: true,
        ticketMax: true,
        currency: true,
        preferences: true,
        mfaEnabled: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.notificationPreference.findMany({
      where: { userId: req.user.id },
      select: { type: true, channel: true, enabled: true },
    }),
    prisma.smsConsent.findMany({
      where: { userId: req.user.id },
      select: { purpose: true, grantedAt: true, withdrawnAt: true, noticeVersion: true },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  await audit({
    actorId: req.user.id,
    action: 'profile.export',
    resource: 'profiles',
    resourceId: req.user.id,
    req,
    newValue: { format: 'json' },
  });

  return {
    exportedAt: new Date().toISOString(),
    profile,
    memberships,
    investorProfile: investor,
    notificationPreferences: notifications,
    smsConsents,
  };
};

/** Liste des permissions effectives (utile pour masquer/afficher l'UI côté front). */
export const getMyPermissions = async (req) => {
  const roles = req.tenant?.effectiveRoles ?? req.user.roles ?? [];
  const permissions = Object.keys(PERMISSIONS).filter((permission) => can(roles, permission));
  return { roles, permissions };
};

/**
 * Audit H-04 — changement de mot de passe (délégué à Supabase Auth).
 *
 * 1. mot de passe actuel vérifié auprès de Supabase (session de contrôle
 *    aussitôt fermée) ; refus en 422, pas en 401 : la session courante reste
 *    valide, seul le champ est faux ;
 * 2. code de double authentification exigé si elle est active ;
 * 3. mise à jour du mot de passe ;
 * 4. révocation des AUTRES sessions (un voleur de jeton est déconnecté),
 *    la session courante est conservée.
 */
export const changePassword = async ({ currentPassword, newPassword, mfaCode }, req) => {
  const identifiant = req.user.email ? { email: req.user.email } : { phone: req.user.phone };
  const controle = await supabase.auth.signInWithPassword({ ...identifiant, password: currentPassword });
  if (controle.error || !controle.data?.session) {
    await audit({ actorId: req.user.id, action: 'auth.password.change_refused', resource: 'profiles', resourceId: req.user.id, req });
    throw ApiError.badRequest('Mot de passe actuel incorrect', [{ field: 'currentPassword', code: 'invalid' }]);
  }
  // Portée `local` : seule la session de contrôle est fermée (`global`, le défaut, fermerait toutes les sessions).
  await supabaseAdmin?.auth.admin.signOut(controle.data.session.access_token, 'local').catch(() => {});

  if (req.user.profile?.mfaEnabled) {
    const { assertMfa } = await import('../auth/mfa.service.js');
    await assertMfa(req.user.id, mfaCode);
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, { password: newPassword });
  if (error) throw ApiError.badRequest(error.message);

  let autresSessionsRevoquees = false;
  if (req.token) {
    const { error: revocation } = await supabaseAdmin.auth.admin.signOut(req.token, 'others');
    autresSessionsRevoquees = !revocation;
    if (revocation) logger.warn('Révocation des autres sessions après changement de mot de passe :', revocation.message);
  }

  await audit({
    actorId: req.user.id,
    action: 'auth.password.changed',
    resource: 'profiles',
    resourceId: req.user.id,
    req,
    newValue: { otherSessionsRevoked: autresSessionsRevoquees },
  });

  return { updated: true, otherSessionsRevoked: autresSessionsRevoquees };
};

/** AUTH-05 / RGPD — suppression logique du compte (anonymisation à traiter en V2). */
export const deleteMe = async (req) => {
  await prisma.profile.update({
    where: { id: req.user.id },
    data: { status: 'DELETED', deletedAt: new Date(), email: `deleted+${req.user.id}@agrikonnect.local` },
  });

  await prisma.membership.updateMany({
    where: { userId: req.user.id },
    data: { status: 'REMOVED' },
  });

  await audit({
    actorId: req.user.id,
    action: 'profile.delete',
    resource: 'profiles',
    resourceId: req.user.id,
    req,
  });

  return { deleted: true };
};
