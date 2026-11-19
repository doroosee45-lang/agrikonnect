/**
 * ACADEMIA — lot L1 « Fondations » (CDC-ACADEMIA-01 §2, §11.3, §11.4, §13).
 *
 * Établissements (= organisations), unités internes, profils académiques et
 * affiliations. Les droits accordés passent par Membership.roles : une
 * affiliation VERIFIED est la SEULE voie qui ajoute un rôle académique.
 * Les règles sont dans academia.policy.js (pures et testées).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { audit } from '../../shared/audit.js';
import { notify, notifyMany } from '../../shared/events.js';
import { resolveId } from '../../shared/ids.js';
import { paginationArgs } from '../../shared/pagination.js';
import { uniqueSlug } from '../../shared/slug.js';
import { ACADEMIC_ORG_TYPES } from '../../shared/permissions.js';
import {
  OPEN_AFFILIATION_STATUSES,
  estGouvernanceAcademia,
  membershipApresDecision,
  orgTypePourEtablissement,
  peutAdministrerEtablissement,
  peutDeciderAffiliation,
  peutTransitionner,
} from './academia.policy.js';

// ─── Sérialisation publique ────────────────────────────────────

const ORG_PUBLIC = { id: true, name: true, slug: true, description: true, countryCode: true, type: true };

const etablissementPublic = (inst, { units = null, membres = null } = {}) => ({
  id: inst.id,
  organizationId: inst.organizationId,
  name: inst.organization?.name,
  slug: inst.organization?.slug,
  description: inst.organization?.description ?? null,
  countryCode: inst.organization?.countryCode,
  kind: inst.kind,
  shortName: inst.shortName,
  website: inst.website,
  contactEmail: inst.contactEmail,
  contactPhone: inst.contactPhone,
  address: inst.address,
  city: inst.city,
  latitude: inst.latitude,
  longitude: inst.longitude,
  logoUrl: inst.logoUrl,
  disciplines: inst.disciplines ?? [],
  isPublished: inst.isPublished,
  ...(units ? { units } : {}),
  ...(membres ? { stats: membres } : {}),
});

const unitePublique = (u) => ({
  id: u.id,
  kind: u.kind,
  name: u.name,
  code: u.code,
  description: u.description,
  parentId: u.parentId,
});

// ─── Chargements gardés ────────────────────────────────────────

/** Établissement par id d'établissement, id d'organisation ou slug. */
const chargerEtablissement = async (ref, { inclurePrives = false } = {}) => {
  const inst = await prisma.academicInstitution.findFirst({
    where: {
      deletedAt: null,
      organization: { deletedAt: null },
      OR: [{ id: ref }, { organizationId: ref }, { organization: { slug: ref } }],
      ...(inclurePrives ? {} : { isPublished: true }),
    },
    include: { organization: { select: ORG_PUBLIC } },
  });
  if (!inst) throw ApiError.notFound('Établissement introuvable');
  return inst;
};

/** Établissement que l'utilisateur administre ; 404 sinon (on ne confirme pas l'existence). */
const chargerEtablissementAdministre = async (ref, user) => {
  const inst = await chargerEtablissement(ref, { inclurePrives: true });
  if (!peutAdministrerEtablissement(user, inst.organizationId)) {
    // Un établissement publié est visible de tous : 403 explicite.
    if (inst.isPublished) throw ApiError.forbidden('Tu n\'administres pas cet établissement');
    throw ApiError.notFound('Établissement introuvable');
  }
  return inst;
};

// ─── Établissements (lecture publique) ─────────────────────────

export const listInstitutions = async (query) => {
  const { q, country, city, kind, discipline } = query;
  const where = {
    deletedAt: null,
    isPublished: true,
    organization: {
      deletedAt: null,
      ...(country ? { countryCode: country } : {}),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    },
    ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
    ...(kind ? { kind } : {}),
    ...(discipline ? { disciplines: { has: discipline } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.academicInstitution.findMany({
      where,
      include: { organization: { select: ORG_PUBLIC } },
      orderBy: { organization: { name: 'asc' } },
      ...paginationArgs(query),
    }),
    prisma.academicInstitution.count({ where }),
  ]);
  return { items: rows.map((r) => etablissementPublic(r)), total, page: query.page, limit: query.limit };
};

export const getInstitution = async (ref, user = null) => {
  const peutVoirPrive = Boolean(user) && estGouvernanceAcademia(user);
  const inst = await chargerEtablissement(ref, { inclurePrives: peutVoirPrive });
  const [units, verifies] = await Promise.all([
    prisma.academicUnit.findMany({
      where: { institutionId: inst.id, deletedAt: null },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    }),
    // Statistiques agrégées uniquement : aucune donnée personnelle (§13.3).
    prisma.academicAffiliation.groupBy({
      by: ['role'],
      where: { organizationId: inst.organizationId, status: 'VERIFIED' },
      _count: { _all: true },
    }),
  ]);
  const stats = Object.fromEntries(verifies.map((v) => [v.role, v._count._all]));
  return etablissementPublic(inst, { units: units.map(unitePublique), membres: stats });
};

// ─── Établissements (administration) ───────────────────────────

/** §11.4 — création réservée à la gouvernance ACADEMIA (décision validée). */
export const createInstitution = async (input, req) => {
  const { name, kind, countryCode, description, ...details } = input;
  const slug = await uniqueSlug(name, async (s) =>
    Boolean(await prisma.organization.findUnique({ where: { slug: s }, select: { id: true } })));

  const result = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        id: resolveId(),
        type: orgTypePourEtablissement(kind),
        name,
        slug,
        description: description ?? null,
        countryCode,
        createdBy: req.user.id,
      },
    });
    return tx.academicInstitution.create({
      data: {
        id: resolveId(),
        organizationId: organization.id,
        kind,
        createdBy: req.user.id,
        ...details,
        disciplines: details.disciplines ?? [],
      },
      include: { organization: { select: ORG_PUBLIC } },
    });
  });

  await audit({
    actorId: req.user.id,
    action: 'academia.institution.create',
    resource: 'academic_institution',
    resourceId: result.id,
    newValue: { organizationId: result.organizationId, name, kind, countryCode },
    req,
  });
  return etablissementPublic(result);
};

export const updateInstitution = async (ref, input, req) => {
  const inst = await chargerEtablissementAdministre(ref, req.user);
  const { name, description, ...details } = input;

  const updated = await prisma.$transaction(async (tx) => {
    if (name !== undefined || description !== undefined) {
      await tx.organization.update({
        where: { id: inst.organizationId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
          version: { increment: 1 },
        },
      });
    }
    return tx.academicInstitution.update({
      where: { id: inst.id },
      data: details,
      include: { organization: { select: ORG_PUBLIC } },
    });
  });

  await audit({
    actorId: req.user.id,
    action: 'academia.institution.update',
    resource: 'academic_institution',
    resourceId: inst.id,
    oldValue: etablissementPublic(inst),
    newValue: input,
    req,
  });
  return etablissementPublic(updated);
};

// ─── Unités (facultés, départements, laboratoires) ─────────────

const verifierParent = async (institutionId, parentId, unitId = null) => {
  if (!parentId) return;
  if (parentId === unitId) throw ApiError.badRequest('Une unité ne peut pas être son propre parent');
  const parent = await prisma.academicUnit.findFirst({ where: { id: parentId, institutionId, deletedAt: null } });
  if (!parent) throw ApiError.badRequest('Unité parente introuvable dans cet établissement');
};

export const createUnit = async (ref, input, req) => {
  const inst = await chargerEtablissementAdministre(ref, req.user);
  await verifierParent(inst.id, input.parentId);
  const unit = await prisma.academicUnit.create({
    data: { id: resolveId(), institutionId: inst.id, ...input, parentId: input.parentId ?? null },
  });
  await audit({
    actorId: req.user.id,
    action: 'academia.unit.create',
    resource: 'academic_unit',
    resourceId: unit.id,
    newValue: { institutionId: inst.id, kind: unit.kind, name: unit.name },
    req,
  });
  return unitePublique(unit);
};

export const updateUnit = async (ref, unitId, input, req) => {
  const inst = await chargerEtablissementAdministre(ref, req.user);
  const unit = await prisma.academicUnit.findFirst({ where: { id: unitId, institutionId: inst.id, deletedAt: null } });
  if (!unit) throw ApiError.notFound('Unité introuvable');
  await verifierParent(inst.id, input.parentId, unitId);
  const updated = await prisma.academicUnit.update({ where: { id: unitId }, data: input });
  await audit({
    actorId: req.user.id,
    action: 'academia.unit.update',
    resource: 'academic_unit',
    resourceId: unitId,
    oldValue: unitePublique(unit),
    newValue: input,
    req,
  });
  return unitePublique(updated);
};

export const deleteUnit = async (ref, unitId, req) => {
  const inst = await chargerEtablissementAdministre(ref, req.user);
  const unit = await prisma.academicUnit.findFirst({ where: { id: unitId, institutionId: inst.id, deletedAt: null } });
  if (!unit) throw ApiError.notFound('Unité introuvable');
  // Suppression logique : les affiliations qui y renvoient restent lisibles.
  await prisma.academicUnit.update({ where: { id: unitId }, data: { deletedAt: new Date() } });
  await audit({
    actorId: req.user.id,
    action: 'academia.unit.delete',
    resource: 'academic_unit',
    resourceId: unitId,
    oldValue: unitePublique(unit),
    req,
  });
};

// ─── Responsables d'établissement (§13.4 « modification d'un responsable ») ───

export const designateAdmin = async (ref, input, req) => {
  const inst = await chargerEtablissement(ref, { inclurePrives: true });
  const cible = await prisma.profile.findFirst({
    where: input.userId ? { id: input.userId } : { email: input.email.toLowerCase() },
    select: { id: true, status: true, deletedAt: true },
  });
  if (!cible || cible.deletedAt || cible.status !== 'ACTIVE') throw ApiError.notFound('Utilisateur introuvable');

  const existant = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: cible.id, organizationId: inst.organizationId } },
  });
  const rolesAvant = existant?.status === 'ACTIVE' ? existant.roles : [];
  const roles = [...new Set([...rolesAvant, 'UNIVERSITY_ADMIN'])];

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: cible.id, organizationId: inst.organizationId } },
    create: { userId: cible.id, organizationId: inst.organizationId, roles, status: 'ACTIVE', createdBy: req.user.id },
    update: { roles, status: 'ACTIVE' },
  });

  await audit({
    actorId: req.user.id,
    action: 'academia.institution.admin.add',
    resource: 'academic_institution',
    resourceId: inst.id,
    oldValue: { userId: cible.id, roles: rolesAvant },
    newValue: { userId: cible.id, roles },
    req,
  });
  await notify({
    userId: cible.id,
    type: 'academia.admin.designated',
    title: 'Tu es désormais responsable d\'établissement',
    body: inst.organization?.name ?? null,
    payload: { institutionId: inst.id, organizationId: inst.organizationId },
  });
  return { userId: cible.id, roles };
};

export const revokeAdmin = async (ref, userId, req) => {
  const inst = await chargerEtablissement(ref, { inclurePrives: true });
  const existant = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId: inst.organizationId } },
  });
  if (!existant || !existant.roles.includes('UNIVERSITY_ADMIN')) {
    throw ApiError.notFound('Ce compte n\'est pas responsable de cet établissement');
  }
  const roles = existant.roles.filter((r) => r !== 'UNIVERSITY_ADMIN');
  await prisma.membership.update({
    where: { id: existant.id },
    data: { roles, status: roles.length > 0 ? existant.status : 'REMOVED' },
  });
  await audit({
    actorId: req.user.id,
    action: 'academia.institution.admin.remove',
    resource: 'academic_institution',
    resourceId: inst.id,
    oldValue: { userId, roles: existant.roles },
    newValue: { userId, roles },
    req,
  });
};

// ─── Profil académique ─────────────────────────────────────────

export const getMine = async (req) => {
  const [profile, affiliations] = await Promise.all([
    prisma.academicProfile.findUnique({ where: { userId: req.user.id } }),
    prisma.academicAffiliation.findMany({
      where: { userId: req.user.id },
      include: {
        organization: { select: ORG_PUBLIC },
        unit: { select: { id: true, kind: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  return { profile: profile && !profile.deletedAt ? profile : null, affiliations };
};

export const upsertMyProfile = async (input, req) => {
  const data = { ...input, externalLinks: input.externalLinks ?? undefined };
  const profile = await prisma.academicProfile.upsert({
    where: { userId: req.user.id },
    create: { id: resolveId(), userId: req.user.id, ...data },
    update: { ...data, deletedAt: null },
  });
  return profile;
};

// ─── Affiliations ──────────────────────────────────────────────

const administrateursDe = async (organizationId) => {
  const rows = await prisma.membership.findMany({
    where: { organizationId, status: 'ACTIVE', roles: { has: 'UNIVERSITY_ADMIN' } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
};

/** §2.4 étapes 2 à 5 — demande d'affiliation (aucun droit accordé à ce stade). */
export const requestAffiliation = async (input, req) => {
  const organization = await prisma.organization.findFirst({
    where: { id: input.organizationId, deletedAt: null, type: { in: ACADEMIC_ORG_TYPES } },
    include: { academicInstitution: true },
  });
  if (!organization?.academicInstitution || organization.academicInstitution.deletedAt) {
    throw ApiError.notFound('Établissement introuvable');
  }
  if (input.unitId) {
    const unit = await prisma.academicUnit.findFirst({
      where: { id: input.unitId, institutionId: organization.academicInstitution.id, deletedAt: null },
    });
    if (!unit) throw ApiError.badRequest('Unité introuvable dans cet établissement');
  }

  const ouverte = await prisma.academicAffiliation.findFirst({
    where: {
      userId: req.user.id,
      organizationId: organization.id,
      role: input.role,
      status: { in: OPEN_AFFILIATION_STATUSES },
    },
    select: { id: true, status: true },
  });
  if (ouverte) {
    throw ApiError.conflict('Une affiliation est déjà en cours ou active pour ce rôle dans cet établissement', [
      { field: 'role', code: 'affiliation_exists', value: ouverte.status },
    ]);
  }

  const affiliation = await prisma.academicAffiliation.create({
    data: {
      id: resolveId(),
      userId: req.user.id,
      organizationId: organization.id,
      unitId: input.unitId ?? null,
      role: input.role,
      status: 'PENDING',
      studyLevel: input.studyLevel ?? null,
      program: input.program ?? null,
      academicYear: input.academicYear ?? null,
      position: input.position ?? null,
      message: input.message ?? null,
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'academia.affiliation.request',
    resource: 'academic_affiliation',
    resourceId: affiliation.id,
    newValue: { organizationId: organization.id, role: input.role, unitId: input.unitId ?? null },
    req,
  });
  await notifyMany(await administrateursDe(organization.id), {
    type: 'academia.affiliation.requested',
    title: 'Nouvelle demande d\'affiliation',
    body: organization.name,
    payload: { affiliationId: affiliation.id, organizationId: organization.id, role: input.role },
  });
  return affiliation;
};

export const listInstitutionAffiliations = async (ref, query, req) => {
  const inst = await chargerEtablissementAdministre(ref, req.user);
  const where = { organizationId: inst.organizationId, ...(query.status ? { status: query.status } : {}) };
  const [items, total] = await Promise.all([
    prisma.academicAffiliation.findMany({
      where,
      include: {
        // Le responsable voit l'identité du demandeur pour décider — rien de plus.
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        unit: { select: { id: true, kind: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
      ...paginationArgs(query),
    }),
    prisma.academicAffiliation.count({ where }),
  ]);
  return { items, total, page: query.page, limit: query.limit };
};

/**
 * Applique une transition et synchronise le Membership dans UNE transaction :
 * une affiliation ne peut jamais être VERIFIED sans le rôle correspondant, ni
 * SUSPENDED / ENDED en le laissant actif.
 */
const appliquerTransition = async (affiliation, nouveauStatut, { actorId, reason }) =>
  prisma.$transaction(async (tx) => {
    const autres = await tx.academicAffiliation.findMany({
      where: {
        userId: affiliation.userId,
        organizationId: affiliation.organizationId,
        status: 'VERIFIED',
        id: { not: affiliation.id },
      },
      select: { role: true },
    });
    const existant = await tx.membership.findUnique({
      where: { userId_organizationId: { userId: affiliation.userId, organizationId: affiliation.organizationId } },
    });
    const effet = membershipApresDecision({
      rolesActuels: existant?.roles ?? [],
      statutActuel: existant?.status ?? null,
      role: affiliation.role,
      nouveauStatut,
      rolesCouvertsAilleurs: autres.map((a) => a.role),
    });

    if (effet) {
      await tx.membership.upsert({
        where: { userId_organizationId: { userId: affiliation.userId, organizationId: affiliation.organizationId } },
        create: {
          userId: affiliation.userId,
          organizationId: affiliation.organizationId,
          roles: effet.roles,
          status: effet.status,
          createdBy: actorId,
        },
        update: { roles: effet.roles, status: effet.status },
      });
    }

    const updated = await tx.academicAffiliation.update({
      where: { id: affiliation.id },
      data: { status: nouveauStatut, decisionReason: reason ?? null, decidedBy: actorId, decidedAt: new Date() },
    });
    return { updated, membership: effet };
  });

/** §2.4 étapes 6 à 8 — décision de l'établissement. */
export const decideAffiliation = async (id, input, req) => {
  const affiliation = await prisma.academicAffiliation.findUnique({
    where: { id },
    include: { organization: { select: { name: true } } },
  });
  if (!affiliation) throw ApiError.notFound('Affiliation introuvable');
  if (!peutDeciderAffiliation(req.user, affiliation)) {
    // On ne confirme pas l'existence d'une demande à un tiers.
    if (affiliation.userId === req.user.id) {
      throw ApiError.forbidden('Tu ne peux pas décider de ta propre affiliation');
    }
    throw ApiError.notFound('Affiliation introuvable');
  }
  if (!peutTransitionner(affiliation.status, input.status)) {
    throw ApiError.conflict(`Transition impossible : ${affiliation.status} → ${input.status}`, [
      { field: 'status', code: 'invalid_transition', value: affiliation.status },
    ]);
  }

  const { updated, membership } = await appliquerTransition(affiliation, input.status, {
    actorId: req.user.id,
    reason: input.reason,
  });

  await audit({
    actorId: req.user.id,
    action: `academia.affiliation.${input.status.toLowerCase()}`,
    resource: 'academic_affiliation',
    resourceId: id,
    oldValue: { status: affiliation.status },
    newValue: { status: input.status, reason: input.reason ?? null, membership },
    req,
  });
  await notify({
    userId: affiliation.userId,
    type: 'academia.affiliation.decided',
    title: {
      VERIFIED: 'Ton affiliation a été vérifiée',
      REJECTED: 'Ta demande d\'affiliation a été refusée',
      SUSPENDED: 'Ton affiliation a été suspendue',
      ENDED: 'Ton affiliation a pris fin',
    }[input.status],
    body: affiliation.organization?.name ?? null,
    payload: { affiliationId: id, status: input.status },
  });
  return updated;
};

/** Le demandeur retire sa demande, ou met fin à son affiliation. */
export const withdrawAffiliation = async (id, req) => {
  const affiliation = await prisma.academicAffiliation.findUnique({ where: { id } });
  if (!affiliation || affiliation.userId !== req.user.id) throw ApiError.notFound('Affiliation introuvable');
  if (!peutTransitionner(affiliation.status, 'ENDED')) {
    throw ApiError.conflict(`Transition impossible : ${affiliation.status} → ENDED`, [
      { field: 'status', code: 'invalid_transition', value: affiliation.status },
    ]);
  }
  const { updated, membership } = await appliquerTransition(affiliation, 'ENDED', {
    actorId: req.user.id,
    reason: 'Retrait par le membre',
  });
  await audit({
    actorId: req.user.id,
    action: 'academia.affiliation.withdraw',
    resource: 'academic_affiliation',
    resourceId: id,
    oldValue: { status: affiliation.status },
    newValue: { status: 'ENDED', membership },
    req,
  });
  return updated;
};
