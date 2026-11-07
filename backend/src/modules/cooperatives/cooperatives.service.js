/**
 * Exigences CDC couvertes : COOP-01, COOP-02, COOP-03, COOP-04, COOP-05.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { assertOwnership } from '../../middleware/tenant.js';
import { paginationArgs, orderBy, textFilter } from '../../shared/pagination.js';
import { audit } from '../../shared/audit.js';

/**
 * COOP-01 → COOP-05.
 * Règle centrale (COOP-05 / §3.3) : le membre garde la propriété de ses données.
 * La coopérative n'accède qu'aux données explicitement autorisées via
 * `consentScopes` (profile, plots, productions, soil).
 */

const assertCooperative = async (cooperativeId, organizationId) => {
  const cooperative = await prisma.cooperative.findUnique({
    where: { id: cooperativeId },
    include: { organization: true },
  });
  if (!cooperative || cooperative.deletedAt) throw ApiError.notFound('Coopérative introuvable');
  // Seule l'organisation propriétaire (tenant) peut administrer la coopérative
  if (cooperative.organizationId !== organizationId) throw ApiError.notFound('Coopérative introuvable');
  return cooperative;
};

export const getCurrent = async (req) => {
  const organizationId = req.tenant.organizationId;

  const cooperative = await prisma.cooperative.findUnique({
    where: { organizationId },
    include: {
      organization: true,
      _count: { select: { members: true } },
    },
  });

  if (!cooperative) throw ApiError.notFound('Aucune coopérative pour cette organisation');
  return cooperative;
};

export const updateCurrent = async (payload, req) => {
  const cooperative = await assertCooperative(
    (await getCurrent(req)).id,
    req.tenant.organizationId,
  );

  const updated = await prisma.cooperative.update({
    where: { id: cooperative.id },
    data: {
      ...(payload.legalStatus !== undefined ? { legalStatus: payload.legalStatus } : {}),
      ...(payload.foundedYear !== undefined ? { foundedYear: payload.foundedYear } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.province !== undefined ? { province: payload.province } : {}),
      ...(payload.territory !== undefined ? { territory: payload.territory } : {}),
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'cooperative.update',
    resource: 'cooperatives',
    resourceId: cooperative.id,
    req,
    newValue: payload,
  });

  return updated;
};

export const listMembers = async (cooperativeId, query, req) => {
  await assertCooperative(cooperativeId, req.tenant.organizationId);
  const { page, limit, sort, order, status, search } = query;

  const where = {
    cooperativeId,
    ...(status ? { status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.cooperativeMember.findMany({
      where,
      ...paginationArgs({ page, limit }),
      orderBy: orderBy(sort, order, ['createdAt', 'joinedAt']),
    }),
    prisma.cooperativeMember.count({ where }),
  ]);

  // Enrichissement contrôlé : identité minimale du membre
  const userIds = items.map((m) => m.memberUserId);
  const profiles = await prisma.profile.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true },
  });
  const byId = new Map(profiles.map((p) => [p.id, p]));

  const enriched = items
    .map((m) => {
      const profile = byId.get(m.memberUserId);
      const label = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');
      return {
        id: m.id,
        memberUserId: m.memberUserId,
        memberName: label || null,
        // Contacts masqués par défaut (P6) : visibles seulement si le membre
        // a autorisé la portée 'profile'
        contact: m.consentScopes.includes('profile')
          ? { phone: profile?.phone ?? null, email: profile?.email ?? null }
          : null,
        status: m.status,
        joinedAt: m.joinedAt,
        consentScopes: m.consentScopes,
      };
    })
    .filter((m) => !search || (m.memberName ?? '').toLowerCase().includes(search.toLowerCase()));

  return { items: enriched, total, page, limit };
};

export const addMember = async (cooperativeId, payload, req) => {
  await assertCooperative(cooperativeId, req.tenant.organizationId);

  const profile = await prisma.profile.findFirst({
    where: {
      OR: [{ email: payload.identifier.toLowerCase() }, { phone: payload.identifier }],
      deletedAt: null,
    },
  });

  if (!profile) {
    throw ApiError.notFound(
      'Aucun compte AGRIKONNECT pour cet email/téléphone. Le membre doit d\'abord créer son compte.',
    );
  }

  const existing = await prisma.cooperativeMember.findUnique({
    where: { cooperativeId_memberUserId: { cooperativeId, memberUserId: profile.id } },
  });
  if (existing) throw ApiError.conflict('Ce producteur est déjà membre ou invité');

  // COOP-02 : invitation avec consentement enregistré
  const member = await prisma.cooperativeMember.create({
    data: {
      cooperativeId,
      memberUserId: profile.id,
      status: 'INVITED',
      consentScopes: payload.consentScopes,
      invitedBy: req.user.id,
      joinedAt: payload.joinedAt ?? null,
      consentRecordedAt: new Date(),
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'cooperative.member.invite',
    resource: 'cooperative_members',
    resourceId: member.id,
    req,
    newValue: { cooperativeId, memberUserId: profile.id, consentScopes: payload.consentScopes },
  });

  return member;
};

export const updateMember = async (cooperativeId, memberId, payload, req) => {
  await assertCooperative(cooperativeId, req.tenant.organizationId);

  const member = await prisma.cooperativeMember.findUnique({ where: { id: memberId } });
  if (!member || member.cooperativeId !== cooperativeId) {
    throw ApiError.notFound('Membre introuvable');
  }

  const updated = await prisma.cooperativeMember.update({
    where: { id: memberId },
    data: {
      ...(payload.status ? { status: payload.status } : {}),
      ...(payload.consentScopes ? { consentScopes: payload.consentScopes, consentRecordedAt: new Date() } : {}),
      ...(payload.status === 'ACTIVE' && !member.joinedAt ? { joinedAt: new Date() } : {}),
    },
  });

  if (payload.status === 'REMOVED') {
    await audit({
      actorId: req.user.id,
      action: 'cooperative.member.remove',
      resource: 'cooperative_members',
      resourceId: memberId,
      req,
    });
  }

  return updated;
};

/**
 * COOP-03 — import CSV/Excel avec rapport d'erreurs LIGNE PAR LIGNE
 * et détection de doublons. Aucune écriture partielle silencieuse :
 * `dryRun` permet de prévisualiser.
 */
export const importMembers = async (cooperativeId, { csv, dryRun }, req) => {
  await assertCooperative(cooperativeId, req.tenant.organizationId);

  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 2) throw ApiError.badRequest('Le fichier doit contenir un en-tête et au moins une ligne');

  const headers = lines[0].split(/[,;]/).map((h) => h.trim().toLowerCase());
  const required = ['email'];
  const hasIdentifier = headers.includes('email') || headers.includes('phone');
  if (!hasIdentifier) {
    throw ApiError.badRequest('Colonne « email » ou « phone » requise dans l\'en-tête');
  }

  const results = [];
  const seen = new Set();
  let createdCount = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const values = lines[i].split(/[,;]/).map((v) => v.trim());
    const row = Object.fromEntries(headers.map((h, idx) => [h, values[idx] ?? '']));
    const line = i + 1;

    const identifier = (row.email || row.phone || '').toLowerCase();
    if (!identifier) {
      results.push({ line, status: 'error', message: 'Email ou téléphone manquant' });
      continue;
    }

    if (seen.has(identifier)) {
      results.push({ line, status: 'duplicate', message: 'Doublon dans le fichier', identifier });
      continue;
    }
    seen.add(identifier);

    // eslint-disable-next-line no-await-in-loop
    const profile = await prisma.profile.findFirst({
      where: {
        ...(headers.includes('email') ? { email: identifier } : { phone: identifier }),
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!profile) {
      results.push({
        line,
        status: 'error',
        message: 'Aucun compte AGRIKONNECT pour cet identifiant',
        identifier,
      });
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const existing = await prisma.cooperativeMember.findUnique({
      where: { cooperativeId_memberUserId: { cooperativeId, memberUserId: profile.id } },
    });

    if (existing) {
      results.push({ line, status: 'duplicate', message: 'Déjà membre de la coopérative', identifier });
      continue;
    }

    const scopes = (row.consentscopes || 'profile')
      .split('|')
      .map((s) => s.trim())
      .filter((s) => ['profile', 'plots', 'productions', 'soil'].includes(s));

    if (!dryRun) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.cooperativeMember.create({
        data: {
          cooperativeId,
          memberUserId: profile.id,
          status: 'INVITED',
          consentScopes: scopes.length ? scopes : ['profile'],
          invitedBy: req.user.id,
          consentRecordedAt: new Date(),
        },
      });
    }

    createdCount += 1;
    results.push({ line, status: 'ok', identifier });
  }

  const summary = {
    totalLines: lines.length - 1,
    created: createdCount,
    duplicates: results.filter((r) => r.status === 'duplicate').length,
    errors: results.filter((r) => r.status === 'error').length,
    dryRun,
  };

  if (!dryRun) {
    await audit({
      actorId: req.user.id,
      action: 'cooperative.members.import',
      resource: 'cooperative_members',
      resourceId: cooperativeId,
      req,
      newValue: summary,
    });
  }

  return { summary, results };
};

/**
 * COOP-04 — vue consolidée : nombre de membres, superficie, cultures,
 * production agrégée des membres AYANT AUTORISÉ les portées correspondantes.
 */
export const overview = async (cooperativeId, req) => {
  await assertCooperative(cooperativeId, req.tenant.organizationId);

  const members = await prisma.cooperativeMember.findMany({
    where: { cooperativeId, status: 'ACTIVE' },
    select: { memberUserId: true, consentScopes: true },
  });

  const userIds = members.map((m) => m.memberUserId);

  const memberships = await prisma.membership.findMany({
    where: { userId: { in: userIds }, status: 'ACTIVE' },
    select: { userId: true, organizationId: true },
  });

  const orgByUser = new Map(memberships.map((m) => [m.userId, m.organizationId]));

  const plotsAuthorized = members
    .filter((m) => m.consentScopes.includes('plots'))
    .map((m) => orgByUser.get(m.memberUserId))
    .filter(Boolean);

  const productionsAuthorized = members
    .filter((m) => m.consentScopes.includes('productions'))
    .map((m) => orgByUser.get(m.memberUserId))
    .filter(Boolean);

  const [plots, productions, crops] = await Promise.all([
    plotsAuthorized.length
      ? prisma.plot.findMany({
          where: { organizationId: { in: plotsAuthorized }, deletedAt: null },
          select: { areaHa: true, currentCropId: true },
        })
      : [],
    productionsAuthorized.length
      ? prisma.production.groupBy({
          by: ['cropId'],
          where: { organizationId: { in: productionsAuthorized }, deletedAt: null },
          _sum: { quantityKg: true },
          _count: { _all: true },
        })
      : [],
    prisma.crop.findMany({ select: { id: true, names: true, slug: true } }),
  ]);

  const cropById = new Map(crops.map((c) => [c.id, c]));

  const totalAreaHa = Math.round(plots.reduce((acc, p) => acc + (p.areaHa ?? 0), 0) * 100) / 100;

  return {
    members: {
      total: members.length,
      withPlotsConsent: plotsAuthorized.length,
      withProductionsConsent: productionsAuthorized.length,
    },
    plots: {
      count: plots.length,
      totalAreaHa,
      // Note explicite : n'inclut que les membres ayant autorisé la portée
      scope: 'membres ayant autorisé la portée « plots »',
    },
    productions: {
      byCrop: productions.map((p) => ({
        cropId: p.cropId,
        crop: cropById.get(p.cropId)?.names?.fr ?? p.cropId,
        records: p._count._all,
        quantityKg: p._sum.quantityKg ?? 0,
      })),
      scope: 'membres ayant autorisé la portée « productions »',
      source: 'declared',
    },
    crops: [...new Set(plots.map((p) => p.currentCropId).filter(Boolean))].map((id) => ({
      id,
      name: cropById.get(id)?.names?.fr ?? id,
    })),
  };
};
