/**
 * Exigences CDC couvertes : DR-01, DR-02, DR-03, DR-04, DR-05.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { audit } from '../../shared/audit.js';
import { notify } from '../../shared/events.js';

/**
 * DR-01 → DR-05 — Data room d'investissement.
 *
 * La data room est FERMÉE PAR DÉFAUT. Rien n'est lisible sans une demande
 * d'accès explicite, approuvée par le propriétaire du projet, avec une portée
 * (`scope`) et une date d'expiration. Chaque consultation est journalisée en
 * append-only, et le téléchargement est désactivé par défaut document par
 * document.
 */

/** Délai par défaut configurable (`DATAROOM_ACCESS_TTL_DAYS`), plafonné à 90 jours. */
const DEFAULT_TTL_DAYS = env.DATAROOM_ACCESS_TTL_DAYS;

const assertProjectOwner = async (projectId, organizationId) => {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
  });
  if (!project) throw ApiError.notFound('Projet introuvable');
  return project;
};

/** Vérifie qu'un accès actif existe pour cet utilisateur, sur ce projet. */
const activeGrant = async (projectId, userId) => {
  const grant = await prisma.dataRoomAccessRequest.findFirst({
    where: { projectId, granteeUserId: userId, status: 'GRANTED' },
    orderBy: { decidedAt: 'desc' },
  });

  if (!grant) return null;
  if (grant.expiresAt && grant.expiresAt.getTime() < Date.now()) {
    await prisma.dataRoomAccessRequest.update({ where: { id: grant.id }, data: { status: 'EXPIRED' } });
    return null;
  }
  return grant;
};

const log = async (projectId, userId, action, { documentId = null, ip = null, device = null } = {}) => {
  // Journal append-only : uniquement des insertions
  await prisma.dataRoomAccessLog.create({
    data: { projectId, documentId, userId, action, ip, device },
  });
};

/** DR-02 — demander l'accès (procédure explicite, jamais implicite). */
export const requestAccess = async (projectId, { scope, justification, requestedDays }, req) => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.deletedAt) throw ApiError.notFound('Projet introuvable');
  if (project.status !== 'PUBLISHED') {
    throw ApiError.conflict('La data room n\'est ouverte qu\'aux projets publiés');
  }
  if (project.organizationId === req.tenant.organizationId) {
    throw ApiError.badRequest('Le propriétaire du projet a déjà accès à sa data room');
  }

  const existing = await prisma.dataRoomAccessRequest.findFirst({
    where: { projectId, granteeUserId: req.user.id, status: { in: ['PENDING', 'GRANTED'] } },
  });
  if (existing) {
    throw ApiError.conflict(
      existing.status === 'PENDING'
        ? 'Une demande est déjà en attente de décision'
        : 'Un accès actif existe déjà pour ce projet',
    );
  }

  const request = await prisma.dataRoomAccessRequest.create({
    data: {
      id: resolveId(),
      projectId,
      granteeUserId: req.user.id,
      granteeOrgId: req.tenant.organizationId,
      scope: {
        ...scope,
        // Portée par défaut : lecture seule, sans téléchargement
        download: scope?.download === true,
        requestedDays: requestedDays ?? DEFAULT_TTL_DAYS,
        justification: justification ?? null,
      },
      status: 'PENDING',
    },
  });

  const members = await prisma.membership.findMany({
    where: { organizationId: project.organizationId, status: 'ACTIVE' },
    select: { userId: true },
  });
  for (const member of members) {
    // eslint-disable-next-line no-await-in-loop
    await notify({
      userId: member.userId,
      type: 'dataroom.request',
      title: 'Nouvelle demande d\'accès à votre data room',
      body: justification ?? 'Demande à examiner',
      payload: { projectId, requestId: request.id },
      dedupeKey: `dataroom:${request.id}:${member.userId}`,
    });
  }

  await audit({ actorId: req.user.id, action: 'dataroom.request', resource: 'data_room_access_requests', resourceId: request.id, req, newValue: { projectId, scope: request.scope } });
  return request;
};

/** DR-03 — décision du propriétaire (accord, refus, durée, portée). */
export const decideAccess = async (requestId, { decision, expiresAt, conditions, downloadAllowed }, req) => {
  const request = await prisma.dataRoomAccessRequest.findUnique({ where: { id: requestId } });
  if (!request) throw ApiError.notFound('Demande introuvable');

  const project = await assertProjectOwner(request.projectId, req.tenant.organizationId);
  if (request.status !== 'PENDING') throw ApiError.conflict(`Demande déjà ${request.status}`);

  const ttlDays = request.scope?.requestedDays ?? DEFAULT_TTL_DAYS;
  const expiry = expiresAt ?? new Date(Date.now() + Math.min(ttlDays, 90) * 24 * 3600 * 1000);

  const updated = await prisma.dataRoomAccessRequest.update({
    where: { id: requestId },
    data: {
      status: decision === 'GRANTED' ? 'GRANTED' : 'REJECTED',
      conditions: conditions ?? null,
      expiresAt: decision === 'GRANTED' ? expiry : null,
      decidedBy: req.user.id,
      decidedAt: new Date(),
      scope: {
        ...(request.scope ?? {}),
        download: downloadAllowed === true,
      },
    },
  });

  await notify({
    userId: request.granteeUserId,
    type: 'dataroom.decision',
    title: decision === 'GRANTED' ? 'Accès à la data room accordé' : 'Accès à la data room refusé',
    body: decision === 'GRANTED' ? `Valable jusqu'au ${expiry.toISOString().slice(0, 10)}` : conditions ?? null,
    payload: { projectId: project.id, requestId, decision },
    dedupeKey: `dataroom-decision:${requestId}`,
  });

  await audit({
    actorId: req.user.id,
    action: 'dataroom.decide',
    resource: 'data_room_access_requests',
    resourceId: requestId,
    req,
    newValue: { decision, expiresAt: updated.expiresAt, download: updated.scope?.download === true },
  });

  return updated;
};

/** DR-01 — liste des documents : métadonnées uniquement, jamais de contenu. */
export const listDocuments = async (projectId, req) => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.deletedAt) throw ApiError.notFound('Projet introuvable');

  const isOwner = project.organizationId === req.tenant.organizationId;
  const grant = isOwner ? null : await activeGrant(projectId, req.user.id);

  if (!isOwner && !grant) {
    await log(projectId, req.user.id, 'LIST_DENIED', { ip: req.ip, device: req.headers['user-agent'] });
    throw ApiError.forbidden(
      'Data room fermée par défaut : une demande d\'accès approuvée est requise (DR-01).',
    );
  }

  const documents = await prisma.projectDocument.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { uploadedAt: 'desc' },
  });

  const allowedCategories = grant?.scope?.categories ?? null;

  const visible = documents.filter(
    (d) => isOwner || !allowedCategories || allowedCategories.includes(d.category),
  );

  await log(projectId, req.user.id, 'LIST', { ip: req.ip, device: req.headers['user-agent'] });

  return {
    projectId,
    documents: visible.map((d) => ({
      id: d.id,
      name: d.name,
      category: d.category,
      confidentiality: d.confidentiality,
      // Le contenu n'est jamais inclus : seulement une référence signée à demander
      storageKey: isOwner ? d.storageKey : null,
      downloadAllowed: d.downloadAllowed && (isOwner || grant?.scope?.download === true),
      sha256: d.sha256,
      uploadedAt: d.uploadedAt,
    })),
    access: {
      granted: Boolean(grant) || isOwner,
      expiresAt: grant?.expiresAt ?? null,
      conditions: grant?.conditions ?? null,
      downloadEnabled: isOwner || grant?.scope?.download === true,
    },
    policy: 'Chaque consultation est journalisée. Aucun document n\'est téléchargeable sans autorisation explicite.',
  };
};

/** DR-04 — ouverture d'un document (contrôle + journalisation). */
export const openDocument = async (documentId, req) => {
  const document = await prisma.projectDocument.findUnique({ where: { id: documentId } });
  if (!document || document.deletedAt) throw ApiError.notFound('Document introuvable');

  const project = await prisma.project.findUnique({ where: { id: document.projectId } });
  const isOwner = project?.organizationId === req.tenant.organizationId;
  const grant = isOwner ? null : await activeGrant(document.projectId, req.user.id);

  if (!isOwner && !grant) {
    await log(document.projectId, req.user.id, 'OPEN_DENIED', { documentId, ip: req.ip, device: req.headers['user-agent'] });
    throw ApiError.forbidden('Accès non autorisé à ce document');
  }

  const downloadRequested = req.query.download === 'true';
  if (downloadRequested && !isOwner && (document.downloadAllowed !== true || grant?.scope?.download !== true)) {
    await log(document.projectId, req.user.id, 'DOWNLOAD_DENIED', { documentId, ip: req.ip, device: req.headers['user-agent'] });
    throw ApiError.forbidden(
      'Téléchargement désactivé par défaut (DR-04). Le propriétaire doit l\'autoriser explicitement.',
    );
  }

  await log(document.projectId, req.user.id, downloadRequested ? 'DOWNLOAD' : 'OPEN', {
    documentId,
    ip: req.ip,
    device: req.headers['user-agent'],
  });

  return {
    document: { id: document.id, name: document.name, category: document.category, sha256: document.sha256 },
    storageKey: document.storageKey,
    download: {
      allowed: downloadRequested ? true : false,
      rule: 'URL signée à durée limitée, une seule consultation journalisée.',
    },
    logged: true,
  };
};

/** DR-05 — journal d'accès (append-only, lisible par le propriétaire). */
export const accessLog = async (projectId, query, req) => {
  await assertProjectOwner(projectId, req.tenant.organizationId);

  const logs = await prisma.dataRoomAccessLog.findMany({
    where: { projectId, ...(query.action ? { action: query.action } : {}) },
    orderBy: { at: 'desc' },
    take: Math.min(Number(query.limit ?? 100), 500),
  });

  return {
    projectId,
    entries: logs,
    appendOnly: true,
    retention: 'Le journal ne peut être ni modifié ni supprimé via l\'API.',
  };
};

/** Dépôt d'un document par le propriétaire (téléchargement désactivé par défaut). */
export const addDocument = async (projectId, payload, req) => {
  await assertProjectOwner(projectId, req.tenant.organizationId);

  const document = await prisma.projectDocument.create({
    data: {
      id: resolveId(payload.id),
      projectId,
      name: payload.name,
      category: payload.category,
      storageKey: payload.storageKey,
      sha256: payload.sha256 ?? null,
      confidentiality: payload.confidentiality ?? 'PRIVATE',
      // DR-04 : jamais téléchargeable sauf décision explicite
      downloadAllowed: payload.downloadAllowed === true,
      uploadedBy: req.user.id,
    },
  });

  await audit({ actorId: req.user.id, action: 'dataroom.document.add', resource: 'project_documents', resourceId: document.id, req, newValue: { projectId, category: document.category, downloadAllowed: document.downloadAllowed } });
  return document;
};
