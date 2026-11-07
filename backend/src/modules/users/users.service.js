/**
 * Exigences CDC couvertes : PROF-01, PROF-03.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { PERMISSIONS, can } from '../../shared/permissions.js';
import { audit } from '../../shared/audit.js';
import { publicUser } from '../auth/auth.service.js';

/**
 * PROF-03 — complétude du profil : liste explicite des critères manquants.
 * Aucun « score » opaque : on expose des critères cochés (CDC A4 / VER-05).
 */
const ROLES_PRODUCTION = ['FARMER', 'COOPERATIVE_ADMIN', 'COOPERATIVE_MEMBER', 'AGRICULTURAL_COMPANY'];

const completenessCriteria = ({ profile, farms, plots, productions, roles = [] }) => {
  const criteres = [
  { key: 'identity', label: 'Nom et prénom renseignés', done: Boolean(profile.firstName && profile.lastName) },
  { key: 'phone_verified', label: 'Téléphone vérifié', done: Boolean(profile.phoneVerifiedAt) },
  { key: 'email_verified', label: 'Email vérifié', done: Boolean(profile.emailVerifiedAt) },
  { key: 'avatar', label: 'Photo de profil', done: Boolean(profile.avatarUrl) },
  { key: 'farm', label: 'Au moins une exploitation créée', done: farms > 0 },
  { key: 'plot', label: 'Au moins une parcelle localisée', done: plots > 0 },
  { key: 'production', label: 'Au moins une production déclarée', done: productions > 0 },
  ];
  const horsProduction = new Set(['farm', 'plot', 'production']);
  return roles.some((r) => ROLES_PRODUCTION.includes(r))
    ? criteres
    : criteres.filter((c) => !horsProduction.has(c.key));
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

/** Liste des permissions effectives (utile pour masquer/afficher l'UI côté front). */
export const getMyPermissions = async (req) => {
  const roles = req.tenant?.effectiveRoles ?? req.user.roles ?? [];
  const permissions = Object.keys(PERMISSIONS).filter((permission) => can(roles, permission));
  return { roles, permissions };
};

/** Changement de mot de passe (délégué à Supabase Auth). */
export const changePassword = async ({ newPassword }, req) => {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, { password: newPassword });
  if (error) throw ApiError.badRequest(error.message);

  await audit({
    actorId: req.user.id,
    action: 'auth.password.changed',
    resource: 'profiles',
    resourceId: req.user.id,
    req,
  });

  return { updated: true };
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
