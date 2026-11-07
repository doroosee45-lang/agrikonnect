/**
 * Exigences CDC couvertes : PRJ-01, PRJ-02, PRJ-03, PRJ-04, PRJ-05.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { uniqueSlug } from '../../shared/slug.js';
import { assertOwnership } from '../../middleware/tenant.js';
import { audit } from '../../shared/audit.js';
import { notifyMany } from '../../shared/events.js';

/**
 * PRJ-01 → PRJ-05 — Projets d'investissement agricole.
 *
 * Deux règles structurantes :
 *  1. PROVENANCE PAR CHAMP (`fieldStatus`) : chaque champ chiffré porte sa
 *     source (`declared`, `platform_verified`, `estimated`…). Un investisseur
 *     voit immédiatement ce qui est déclaré et ce qui a été vérifié.
 *  2. Aucune promesse de rendement : la plateforme ne présente ni rendement
 *     garanti ni produit financier (CDC V4 §2 — activité non régulée).
 */

const SOURCES = [
  'declared', 'platform_verified', 'third_party_verified',
  'measured_lab', 'measured_sensor', 'estimated', 'derived',
];

/** Champs soumis à provenance obligatoire. */
const TRACKED_FIELDS = [
  'existingAreaHa', 'targetAreaHa', 'currentProduction',
  'projectedProduction', 'fundingNeed', 'ownContribution',
  'impact', 'market', 'risks', 'durationMonths',
];

const FORBIDDEN_CLAIMS = [
  'rendement garanti', 'retour garanti', 'gain garanti', 'placement sûr',
  'capital garanti', 'profit garanti',
];

const assertNoGuarantee = (text) => {
  if (!text) return;
  const lower = String(text).toLowerCase();
  const hit = FORBIDDEN_CLAIMS.find((claim) => lower.includes(claim));
  if (hit) {
    throw ApiError.badRequest(
      `Formulation interdite (« ${hit} »). La plateforme ne peut présenter aucun rendement garanti (CDC V4).`,
    );
  }
};

const buildFieldStatus = (payload, declareAll = false) => {
  const status = {};

  for (const field of TRACKED_FIELDS) {
    const provided = payload[field] !== undefined && payload[field] !== null;
    if (!provided && !declareAll) continue;

    const declared = payload.fieldStatus?.[field];
    if (!declared) {
      // Sans statut explicite, on assume « declared » : jamais « verified »
      status[field] = { source: 'declared', verifiedBy: null, verifiedAt: null };
      continue;
    }
    if (!SOURCES.includes(declared.source)) {
      throw ApiError.badRequest(`Source de provenance invalide pour ${field}. Valeurs : ${SOURCES.join(', ')}`);
    }
    if (declared.source === 'platform_verified') {
      // Un producteur ne peut pas s'auto-attribuer une vérification
      throw ApiError.forbidden(
        `Le statut « platform_verified » sur ${field} est réservé à la vérification administrative.`,
      );
    }
    status[field] = { source: declared.source, verifiedBy: null, verifiedAt: null };
  }

  return status;
};

export const create = async (payload, req) => {
  assertNoGuarantee(payload.description);
  assertNoGuarantee(payload.impact ? JSON.stringify(payload.impact) : null);

  const slug = await uniqueSlug(payload.title, async (candidate) =>
    Boolean(await prisma.project.findUnique({ where: { slug: candidate } })),
  );

  const project = await prisma.project.create({
    data: {
      id: resolveId(payload.id),
      organizationId: req.tenant.organizationId,
      title: payload.title,
      slug,
      sector: payload.sector,
      countryCode: payload.countryCode,
      province: payload.province ?? null,
      description: payload.description ?? null,
      existingAreaHa: payload.existingAreaHa ?? null,
      targetAreaHa: payload.targetAreaHa ?? null,
      currentProduction: payload.currentProduction ?? undefined,
      projectedProduction: payload.projectedProduction ?? undefined,
      fundingNeed: payload.fundingNeed ?? undefined,
      ownContribution: payload.ownContribution ?? undefined,
      durationMonths: payload.durationMonths ?? null,
      milestones: payload.milestones ?? undefined,
      team: payload.team ?? undefined,
      market: payload.market ?? null,
      risks: payload.risks ?? undefined,
      impact: payload.impact ?? undefined,
      fieldStatus: buildFieldStatus(payload, true),
      linkedData: payload.linkedData ?? {},
      status: 'DRAFT',
      createdBy: req.user.id,
    },
  });

  await audit({ actorId: req.user.id, action: 'project.create', resource: 'projects', resourceId: project.id, req, newValue: { title: project.title, sector: project.sector } });
  return project;
};

export const update = async (id, payload, req) => {
  const project = assertOwnership(await prisma.project.findUnique({ where: { id } }), req.tenant.organizationId, 'Projet');

  if (['PUBLISHED', 'IN_DISCUSSION'].includes(project.status) && payload.fieldStatus === undefined && payload.force !== true) {
    throw ApiError.conflict(
      'Projet publié : toute modification doit déclarer les champs de provenance concernés.',
    );
  }

  assertNoGuarantee(payload.description);

  const mergedFieldStatus = {
    ...(project.fieldStatus ?? {}),
    ...buildFieldStatus(payload),
  };

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...payload,
      fieldStatus: mergedFieldStatus,
      version: { increment: 1 },
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'project.update',
    resource: 'projects',
    resourceId: id,
    req,
    oldValue: { version: project.version },
    newValue: { changedFields: Object.keys(payload) },
  });

  return updated;
};

/** PRJ-02 — soumission à revue (plus aucune publication sans contrôle). */
export const submit = async (id, req) => {
  const project = assertOwnership(await prisma.project.findUnique({ where: { id } }), req.tenant.organizationId, 'Projet');

  if (project.status !== 'DRAFT') throw ApiError.conflict(`Projet déjà ${project.status}`);

  const missing = [];
  if (!project.fundingNeed) missing.push('fundingNeed');
  if (!project.impact) missing.push('impact');
  if (!project.durationMonths) missing.push('durationMonths');
  if (!project.milestones) missing.push('milestones');

  if (missing.length > 0) {
    throw ApiError.badRequest(`Champs requis avant soumission : ${missing.join(', ')}`, missing.map((f) => ({ field: f, code: 'required' })));
  }

  const updated = await prisma.project.update({ where: { id }, data: { status: 'SUBMITTED' } });
  await audit({ actorId: req.user.id, action: 'project.submit', resource: 'projects', resourceId: id, req });
  return updated;
};

/** Revue administrative : validation ou retour au producteur. */
export const review = async (id, { decision, comment }, req) => {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw ApiError.notFound('Projet introuvable');
  if (!['SUBMITTED', 'IN_REVIEW'].includes(project.status)) {
    throw ApiError.conflict(`Revue impossible depuis le statut ${project.status}`);
  }

  const updated = await prisma.project.update({
    where: { id },
    data: { status: decision === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT' },
  });

  const members = await prisma.membership.findMany({
    where: { organizationId: project.organizationId, status: 'ACTIVE' },
    select: { userId: true },
  });
  await notifyMany(members.map((m) => m.userId), {
    type: 'project.review',
    title: `Projet ${decision === 'PUBLISHED' ? 'publié' : 'à corriger'}`,
    body: comment ?? null,
    payload: { projectId: id, decision },
    dedupeKey: `project:${id}:${decision}`,
  });

  await audit({ actorId: req.user.id, action: 'project.review', resource: 'projects', resourceId: id, req, oldValue: { status: project.status }, newValue: { status: updated.status, comment: comment ?? null } });
  return updated;
};

/** Couverture de provenance : utilitaire de transparence (PRJ-03). */
export const provenanceSummary = (fieldStatus = {}) => {
  const entries = Object.entries(fieldStatus).map(([field, value]) => ({
    field,
    source: value.source,
    label: {
      declared: 'Déclaré par l\'exploitant',
      platform_verified: 'Vérifié par la plateforme',
      third_party_verified: 'Vérifié par un tiers',
      measured_lab: 'Mesuré en laboratoire',
      measured_sensor: 'Mesuré par capteur',
      estimated: 'Estimé',
      derived: 'Calculé à partir de données existantes',
    }[value.source] ?? value.source,
  }));

  const verified = entries.filter((e) => ['platform_verified', 'third_party_verified', 'measured_lab', 'measured_sensor'].includes(e.source)).length;

  return {
    fields: entries,
    total: entries.length,
    verified,
    declaredOnly: entries.length - verified,
    disclosure: 'Les champs sans vérification sont explicitement identifiés comme déclaratifs.',
  };
};

export const listPublic = async (query) => {
  const { page, limit, sector, countryCode, minFunding, maxFunding } = query;

  const where = {
    status: 'PUBLISHED',
    deletedAt: null,
    ...(sector ? { sector } : {}),
    ...(countryCode ? { countryCode } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, title: true, slug: true, sector: true, countryCode: true, province: true,
        description: true, targetAreaHa: true, fundingNeed: true, durationMonths: true,
        fieldStatus: true, impact: true, status: true, updatedAt: true,
      },
    }),
    prisma.project.count({ where }),
  ]);

  let filtered = items;
  if (minFunding || maxFunding) {
    filtered = items.filter((p) => {
      const amount = Number(p.fundingNeed?.amount ?? 0);
      if (minFunding && amount < Number(minFunding)) return false;
      if (maxFunding && amount > Number(maxFunding)) return false;
      return true;
    });
  }

  return {
    items: filtered.map((p) => ({ ...p, provenance: provenanceSummary(p.fieldStatus) })),
    total: filtered.length,
    page,
    limit,
    disclaimer:
      'Les projets sont présentés à titre informatif. Aucune souscription, aucun titre financier et aucune promesse de rendement.',
  };
};

export const getOne = async (idOrSlug, req) => {
  const project = await prisma.project.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], deletedAt: null },
  });
  if (!project) throw ApiError.notFound('Projet introuvable');

  const isOwner = project.organizationId === req.tenant?.organizationId;
  const isReviewer = (req.user?.roles ?? []).some((r) => ['ADMIN', 'SUPER_ADMIN', 'VERIFIER', 'MODERATOR'].includes(r));

  if (project.status !== 'PUBLISHED' && !isOwner && !isReviewer) {
    throw ApiError.notFound('Projet introuvable');
  }

  // Un projet non publié ne divulgue ni ses risques détaillés ni son équipe
  const publicView = !isOwner && !isReviewer;

  return {
    project: publicView
      ? {
          id: project.id, title: project.title, slug: project.slug, sector: project.sector,
          countryCode: project.countryCode, province: project.province, description: project.description,
          targetAreaHa: project.targetAreaHa, fundingNeed: project.fundingNeed,
          durationMonths: project.durationMonths, impact: project.impact, market: project.market,
          status: project.status, fieldStatus: project.fieldStatus, linkedData: project.linkedData,
        }
      : project,
    provenance: provenanceSummary(project.fieldStatus ?? {}),
    dataRoom: {
      url: `/api/v1/projects/${project.id}/dataroom`,
      access: 'closed_by_default',
      rule: 'Aucun document n\'est accessible sans demande d\'accès approuvée et non expirée.',
    },
    disclosure: 'Aucune activité de collecte de fonds, de garde d\'actifs ou de promesse de rendement.',
  };
};
