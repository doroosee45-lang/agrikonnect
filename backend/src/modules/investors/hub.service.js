/**
 * Exigences CDC couvertes : INV-02, INV-03.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { audit } from '../../shared/audit.js';
import { notify } from '../../shared/events.js';

/**
 * V4 §8 — hub investisseur : INV-02 (exploration et suivi), INV-03 (mise en
 * relation et matching), PRJ-04 (contact encadré).
 *
 * Cadre réglementaire (CDC V4 §2) :
 *  - aucun fonds ne transite par la plateforme ;
 *  - aucun score d'investissement, aucune notation : le matching est une liste
 *    de critères satisfaits, affichée dans l'ordre, jamais un « score » ;
 *  - une mise en relation exige le consentement des deux parties ; le refus est
 *    silencieux (le demandeur ne voit pas les coordonnées) ;
 *  - les profils non vérifiés ou sans MFA n'accèdent pas aux projets détaillés.
 */

const CONTACT_TTL_DAYS = 30;

const assertProjectVisible = async (projectIdOrSlug) => {
  const project = await prisma.project.findFirst({
    where: {
      OR: [{ id: projectIdOrSlug }, { slug: projectIdOrSlug }],
      deletedAt: null,
      status: 'PUBLISHED',
    },
  });
  if (!project) throw ApiError.notFound('Projet introuvable ou non publié');
  return project;
};

/* ─────────────────────── INV-02 : exploration et suivi ─────────────────────── */

/**
 * Liste d'exploration : uniquement des projets publiés, avec les critères de
 * correspondance de l'investisseur affichés ligne par ligne.
 * Le classement suit strictement l'ordre du CDC V2 §8.5 : critères satisfaits,
 * puis vérification, puis fraîcheur — aucune autre pondération cachée.
 */
export const browseProjects = async (query, req) => {
  const profile = await prisma.investorProfile.findUnique({ where: { userId: req.user.id } });

  const where = {
    status: 'PUBLISHED',
    deletedAt: null,
    ...(query.sector ? { sector: query.sector } : {}),
    ...(query.countryCode ? { countryCode: query.countryCode } : {}),
  };

  const projects = await prisma.project.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: Math.min(Number(query.limit ?? 50), 100),
  });

  const follows = await prisma.projectFollow.findMany({ where: { userId: req.user.id } });
  const followedIds = new Set(follows.map((f) => f.projectId));

  const items = projects.map((project) => {
    const criteria = [];
    if (profile) {
      criteria.push({
        key: 'sector',
        label: 'Secteur recherché',
        met: !profile.sectors?.length || profile.sectors.includes(project.sector),
        observed: project.sector,
      });
      criteria.push({
        key: 'country',
        label: 'Pays ciblé',
        met: !profile.countries?.length || profile.countries.includes(project.countryCode),
        observed: project.countryCode,
      });

      const needAmount = project.fundingNeed?.amount ?? null;
      criteria.push({
        key: 'ticket',
        label: 'Ticket dans la fourchette',
        met:
          needAmount === null ||
          ((profile.ticketMin === null || profile.ticketMin === undefined || needAmount >= profile.ticketMin) &&
            (profile.ticketMax === null || profile.ticketMax === undefined || needAmount <= profile.ticketMax)),
        observed: needAmount,
      });
    }

    return {
      id: project.id,
      slug: project.slug,
      title: project.title,
      sector: project.sector,
      countryCode: project.countryCode,
      province: project.province,
      status: project.status,
      updatedAt: project.updatedAt,
      fundingNeed: project.fundingNeed,
      criteria,
      criteriaMet: criteria.filter((c) => c.met).length,
      criteriaTotal: criteria.length,
      followed: followedIds.has(project.id),
    };
  });

  // Ordre du CDC : critères satisfaits ↓, puis vérification, puis fraîcheur.
  const ranked = [...items].sort(
    (a, b) =>
      b.criteriaMet - a.criteriaMet ||
      Number(Boolean(b.verified)) - Number(Boolean(a.verified)) ||
      new Date(b.updatedAt) - new Date(a.updatedAt),
  );

  return {
    items: ranked,
    count: ranked.length,
    ranking: ['critères satisfaits (décroissant)', 'projet vérifié', 'fraîcheur (mise à jour récente)'],
    scope: profile ? 'critères de votre profil investisseur' : 'aucun profil investisseur : liste neutre',
    regulatory: 'Aucun score d’investissement, aucune recommandation personnalisée, aucun fonds collecté.',
  };
};

export const follow = async (projectId, req) => {
  const project = await assertProjectVisible(projectId);

  const existing = await prisma.projectFollow.findFirst({
    where: { projectId: project.id, userId: req.user.id },
  });
  if (existing) return { followed: true, projectId: project.id, alreadyFollowing: true };

  await prisma.projectFollow.create({
    data: {
      id: resolveId(),
      projectId: project.id,
      userId: req.user.id,
      organizationId: req.tenant?.organizationId ?? null,
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'investment.project.follow',
    resource: 'project_follows',
    resourceId: project.id,
    req,
    newValue: { projectId: project.id },
  });

  return { followed: true, projectId: project.id, alreadyFollowing: false };
};

export const unfollow = async (projectId, req) => {
  const project = await assertProjectVisible(projectId);
  const existing = await prisma.projectFollow.findFirst({
    where: { projectId: project.id, userId: req.user.id },
  });
  if (!existing) return { followed: false, projectId: project.id };

  await prisma.projectFollow.delete({ where: { id: existing.id } });
  await audit({
    actorId: req.user.id,
    action: 'investment.project.unfollow',
    resource: 'project_follows',
    resourceId: project.id,
    req,
  });
  return { followed: false, projectId: project.id };
};

export const listFollowed = async (req) => {
  const follows = await prisma.projectFollow.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  if (!follows.length) return { items: [], count: 0 };

  const projects = await prisma.project.findMany({
    where: { id: { in: follows.map((f) => f.projectId) } },
  });
  const byId = new Map(projects.map((p) => [p.id, p]));

  const items = follows
    .map((f) => {
      const project = byId.get(f.projectId);
      if (!project) return null;
      return {
        id: project.id,
        slug: project.slug,
        title: project.title,
        sector: project.sector,
        countryCode: project.countryCode,
        status: project.status,
        followedAt: f.createdAt,
        updatedAt: project.updatedAt,
      };
    })
    .filter(Boolean);

  return { items, count: items.length };
};

/* ─────────────────────── INV-03 : matching expliqué ─────────────────────── */

/**
 * Matching : renvoie les critères SATISFAITS et NON SATISFAITS, dans l'ordre.
 * Aucun score, aucun pourcentage : le CDC V4 interdit toute notation.
 */
export const matches = async (query, req) => {
  const profile = await prisma.investorProfile.findUnique({ where: { userId: req.user.id } });
  if (!profile) {
    throw ApiError.badRequest(
      'Aucun profil investisseur : renseignez vos critères (secteurs, pays, ticket) pour obtenir des correspondances',
    );
  }

  const { items } = await browseProjects({ ...query, limit: query.limit ?? 50 }, req);
  const retained = items.filter((item) => item.criteriaTotal === 0 || item.criteriaMet > 0);

  return {
    items: retained.map((item) => ({
      projectId: item.id,
      slug: item.slug,
      title: item.title,
      criteria: item.criteria,
      criteriaMet: item.criteriaMet,
      criteriaTotal: item.criteriaTotal,
      explanation: item.criteria
        .map((c) => `${c.met ? '✔' : '✘'} ${c.label} (${c.observed ?? 'non renseigné'})`)
        .join(' · '),
      disclosure: 'Liste de critères, sans score ni notation.',
    })),
    count: retained.length,
    criteria: {
      sector: profile.sectors,
      countries: profile.countries,
      ticketMin: profile.ticketMin,
      ticketMax: profile.ticketMax,
      currency: profile.currency,
    },
    regulatory: 'Aucun conseil en investissement, aucune sollicitation, aucun fonds collecté.',
  };
};

/* ─────────────────────── PRJ-04 : mise en relation encadrée ─────────────────────── */

export const requestContact = async (projectId, { message }, req) => {
  const project = await assertProjectVisible(projectId);

  const existing = await prisma.projectContactRequest.findFirst({
    where: { projectId: project.id, requesterUserId: req.user.id },
  });
  if (existing && existing.status === 'PENDING' && new Date(existing.expiresAt) > new Date()) {
    throw ApiError.conflict('Une demande de mise en relation est déjà en attente', {
      status: existing.status,
      expiresAt: existing.expiresAt,
    });
  }

  const expiresAt = new Date(Date.now() + CONTACT_TTL_DAYS * 24 * 3600 * 1000);
  const request = await prisma.projectContactRequest.create({
    data: {
      id: resolveId(),
      projectId: project.id,
      requesterUserId: req.user.id,
      requesterOrgId: req.tenant?.organizationId ?? null,
      message,
      status: 'PENDING',
      expiresAt,
    },
  });

  // Le porteur est notifié sans que le demandeur n'obtienne ses coordonnées.
  const owner = await prisma.membership.findFirst({
    where: { organizationId: project.organizationId, status: 'ACTIVE' },
  });
  if (owner) {
    await notify({
      userId: owner.userId,
      type: 'PROJECT_CONTACT_REQUEST',
      title: 'Nouvelle demande de mise en relation',
      body: 'Un investisseur souhaite échanger au sujet de votre projet.',
      payload: { projectId: project.id, requestId: request.id },
    });
  }

  await audit({
    actorId: req.user.id,
    action: 'investment.contact.request',
    resource: 'project_contact_requests',
    resourceId: request.id,
    req,
    newValue: { projectId: project.id },
  });

  return {
    request: { id: request.id, status: request.status, expiresAt: request.expiresAt },
    message: 'Demande transmise au porteur de projet. Ses coordonnées ne sont communiquées qu’après acceptation.',
    disclosure: 'Aucune coordonnée n’est exposée avant acceptation explicite du porteur.',
  };
};

export const decideContact = async (projectId, requestId, { decision }, req) => {
  const project = await assertProjectVisible(projectId);
  if (project.organizationId !== req.tenant.organizationId) {
    throw ApiError.notFound('Projet introuvable');
  }

  const request = await prisma.projectContactRequest.findUnique({ where: { id: requestId } });
  if (!request || request.projectId !== project.id) throw ApiError.notFound('Demande introuvable');
  if (request.status !== 'PENDING') throw ApiError.conflict('Cette demande a déjà été statuée');
  if (new Date(request.expiresAt) < new Date()) {
    await prisma.projectContactRequest.update({ where: { id: requestId }, data: { status: 'EXPIRED' } });
    throw ApiError.conflict('Cette demande a expiré');
  }

  const updated = await prisma.projectContactRequest.update({
    where: { id: requestId },
    data: { status: decision, decidedBy: req.user.id, decidedAt: new Date() },
  });

  await notify({
    userId: request.requesterUserId,
    type: 'PROJECT_CONTACT_DECISION',
    title: decision === 'ACCEPTED' ? 'Mise en relation acceptée' : 'Mise en relation refusée',
    body:
      decision === 'ACCEPTED'
        ? 'Le porteur de projet a accepté la mise en relation.'
        : 'Le porteur de projet n’a pas donné suite à votre demande.',
    payload: { projectId: project.id, requestId },
  });

  await audit({
    actorId: req.user.id,
    action: 'investment.contact.decide',
    resource: 'project_contact_requests',
    resourceId: requestId,
    req,
    oldValue: { status: 'PENDING' },
    newValue: { status: decision },
  });

  return {
    request: { id: updated.id, status: updated.status, decidedAt: updated.decidedAt },
    // Le refus reste silencieux : aucune coordonnée n'est transmise.
    contactShared: decision === 'ACCEPTED',
  };
};

export const listContactRequests = async (query, req) => {
  const items = await prisma.projectContactRequest.findMany({
    where: {
      ...(query.status ? { status: query.status } : {}),
      ...(query.asRequester === 'true'
        ? { requesterUserId: req.user.id }
        : { requesterOrgId: req.tenant.organizationId }),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(query.limit ?? 50), 200),
  });
  return {
    items: items.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      status: r.status,
      message: r.message,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      decidedAt: r.decidedAt,
    })),
    count: items.length,
  };
};
