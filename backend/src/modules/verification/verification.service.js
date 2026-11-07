/**
 * Exigences CDC couvertes : VER-01, VER-02, VER-03, VER-04, VER-05.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { withTransaction } from '../../shared/transaction.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { paginationArgs, orderBy } from '../../shared/pagination.js';
import { audit } from '../../shared/audit.js';
import { sendEmail, templates } from '../../integrations/email.js';

/**
 * VER-01 → VER-05.
 * - Statuts distincts (UNVERIFIED implicite / PHONE_VERIFIED / PROFILE_VERIFIED / ORGANIZATION_VERIFIED)
 * - Documents en stockage privé (bucket privé + URL signées, SEC-07)
 * - File de revue admin, décision motivée, notification, audit
 * - Aucun « score global » : on expose des critères cochés
 */

export const submit = async (payload, req) => {
  const subjectId = payload.subjectId ?? req.user.id;

  if (payload.subjectType === 'FARM') {
    const farm = await prisma.farm.findUnique({ where: { id: subjectId } });
    if (!farm || farm.deletedAt || farm.organizationId !== req.tenant.organizationId) {
      throw ApiError.notFound('Exploitation introuvable');
    }
  }

  if (payload.documentIds.length) {
    const docs = await prisma.document.findMany({
      where: { id: { in: payload.documentIds } },
      select: { id: true, organizationId: true },
    });
    if (docs.length !== payload.documentIds.length) {
      throw ApiError.badRequest('Un ou plusieurs documents sont introuvables');
    }
    if (docs.some((d) => d.organizationId !== req.tenant.organizationId)) {
      throw ApiError.notFound('Document introuvable');
    }
  }

  // Une seule demande en attente par sujet et par niveau
  const pending = await prisma.verification.findFirst({
    where: { subjectType: payload.subjectType, subjectId, level: payload.level, status: 'PENDING' },
  });
  if (pending) throw ApiError.conflict('Une demande est déjà en cours d\'examen pour ce niveau');

  const verification = await prisma.verification.create({
    data: {
      id: resolveId(),
      subjectType: payload.subjectType,
      subjectId,
      organizationId: req.tenant.organizationId,
      level: payload.level,
      status: 'PENDING',
      documents: payload.documentIds.length
        ? { create: payload.documentIds.map((documentId) => ({ documentId })) }
        : undefined,
    },
    include: { documents: { include: { document: true } } },
  });

  await audit({
    actorId: req.user.id,
    action: 'verification.submit',
    resource: 'verifications',
    resourceId: verification.id,
    req,
    newValue: { level: payload.level, subjectType: payload.subjectType, documents: payload.documentIds.length },
  });

  return verification;
};

export const listMine = async (req) => {
  const items = await prisma.verification.findMany({
    where: { organizationId: req.tenant.organizationId },
    orderBy: { createdAt: 'desc' },
    include: { documents: { include: { document: { select: { id: true, name: true, category: true, mimeType: true } } } } },
  });

  /**
   * VER-05 : critères cochés, jamais un score opaque.
   * La liste est calculée à partir de données réelles, pas d'un chiffre inventé.
   */
  const profile = req.user.profile;
  const farmCount = await prisma.farm.count({
    where: { organizationId: req.tenant.organizationId, deletedAt: null },
  });
  const productionCount = await prisma.production.count({
    where: { organizationId: req.tenant.organizationId, deletedAt: null },
  });
  const historyCount = await prisma.plotCropHistory.count({
    where: { organizationId: req.tenant.organizationId, deletedAt: null },
  });

  const criteria = [
    { key: 'phone', label: 'Téléphone vérifié', done: Boolean(profile?.phoneVerifiedAt) },
    { key: 'email', label: 'Email vérifié', done: Boolean(profile?.emailVerifiedAt) },
    {
      key: 'documents',
      label: 'Pièce d\'identité déposée',
      done: items.some((v) => v.documents.length > 0),
    },
    { key: 'profile_verified', label: 'Profil vérifié par AGRIKONNECT', done: items.some((v) => v.level === 'PROFILE_VERIFIED' && v.status === 'APPROVED') },
    {
      key: 'organization_verified',
      label: 'Organisation vérifiée',
      done: items.some((v) => v.level === 'ORGANIZATION_VERIFIED' && v.status === 'APPROVED'),
    },
    { key: 'farm', label: 'Exploitation renseignée', done: farmCount > 0 },
    { key: 'production', label: 'Production renseignée', done: productionCount > 0 },
    { key: 'history', label: 'Historique cultural renseigné', done: historyCount > 0 },
  ];

  return { items, criteria };
};

// ─── Administration (VER-03) ───────────────────────────────────

export const listForReview = async (query) => {
  const { page, limit, sort, order, status, level } = query;

  const where = {
    ...(status ? { status } : { status: 'PENDING' }),
    ...(level ? { level } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.verification.findMany({
      where,
      ...paginationArgs({ page, limit }),
      orderBy: orderBy(sort, order, ['createdAt']),
      include: {
        documents: {
          include: {
            document: { select: { id: true, name: true, category: true, mimeType: true, storageKey: true } },
          },
        },
      },
    }),
    prisma.verification.count({ where }),
  ]);

  return { items, total, page, limit };
};

/**
 * VER-03 : approbation / rejet motivé + notification + audit + mise à jour
 * du statut de vérification de la ressource concernée.
 */
export const review = async (id, { status, reason }, req) => {
  const verification = await prisma.verification.findUnique({ where: { id } });
  if (!verification) throw ApiError.notFound('Demande introuvable');
  if (verification.status !== 'PENDING') throw ApiError.conflict('Cette demande a déjà été traitée');

  // VER-02 — la vérification est instruite par un tiers : l'organisation qui
  // dépose le dossier ne peut pas statuer sur le sien (séparation des rôles).
  if (verification.organizationId === req.tenant?.organizationId) {
    throw ApiError.forbidden(
      "Une demande de vérification est instruite par un tiers : l'organisation demandeuse ne peut pas statuer sur son propre dossier",
    );
  }

  // VER-02 — un refus est toujours motivé par écrit : sans motif, le producteur
  // ne saurait pas quoi corriger et la décision serait inexploitable.
  if (status === 'REJECTED' && !String(reason ?? '').trim()) {
    throw ApiError.badRequest('Un motif écrit est obligatoire pour refuser une demande de vérification');
  }

  // NFR-03 — décision + répercussion sur la ressource : une seule transaction.
  const updated = await withTransaction(async (tx) => {
    const result = await tx.verification.update({
      where: { id },
      data: {
        status,
        reason: reason ?? null,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
      },
    });

    if (status === 'APPROVED') {
      // Répercussion sur la ressource vérifiée
      if (verification.subjectType === 'FARM') {
        await tx.farm.update({
          where: { id: verification.subjectId },
          data: {
            verificationStatus: verification.level,
            verifiedAt: new Date(),
            verifiedBy: req.user.id,
          },
        });
      }
    }

    return result;
  });

  // Notification de l'utilisateur (VER-03)
  const owner = await prisma.organization.findUnique({
    where: { id: verification.organizationId },
    select: { createdBy: true },
  });
  const profile = owner?.createdBy
    ? await prisma.profile.findUnique({ where: { id: owner.createdBy }, select: { email: true } })
    : null;

  if (profile?.email) {
    const tpl = templates.verificationDecision({ approved: status === 'APPROVED', reason });
    await sendEmail({ to: profile.email, ...tpl });
  }

  await audit({
    actorId: req.user.id,
    action: status === 'APPROVED' ? 'verification.approve' : 'verification.reject',
    resource: 'verifications',
    resourceId: id,
    req,
    oldValue: { status: 'PENDING' },
    newValue: { status, reason: reason ?? null },
  });

  return updated;
};
