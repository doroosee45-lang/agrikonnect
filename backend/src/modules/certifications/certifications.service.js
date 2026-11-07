/**
 * Exigences CDC couvertes : CERT-01, CERT-02, CERT-03.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { paginationArgs, orderBy } from '../../shared/pagination.js';
import { assertOwnership } from '../../middleware/tenant.js';
import { audit } from '../../shared/audit.js';
import { notifyMany } from '../../shared/events.js';

/**
 * CERT-01 → CERT-04 — Certifications.
 *
 * Une certification déclarée n'est PAS une certification vérifiée.
 * Le statut `VERIFIED` ne peut être posé que par un administrateur / vérificateur,
 * et une certification expirée est signalée comme telle partout.
 */

const EXPIRING_DAYS = 30;

const decorate = (cert) => {
  const now = Date.now();
  const expiresInDays = cert.expiresAt
    ? Math.ceil((cert.expiresAt.getTime() - now) / (24 * 3600 * 1000))
    : null;

  return {
    ...cert,
    // Un certificat expiré ne peut pas afficher un statut VERIFIED
    effectiveStatus: cert.expiresAt && cert.expiresAt.getTime() < now && cert.status === 'VERIFIED'
      ? 'EXPIRED'
      : cert.status,
    expiresInDays,
    expiringSoon: expiresInDays !== null && expiresInDays >= 0 && expiresInDays <= EXPIRING_DAYS,
    trusted: cert.status === 'VERIFIED' && (!cert.expiresAt || cert.expiresAt.getTime() > now),
  };
};

export const list = async (query, req) => {
  const where = {
    organizationId: req.tenant.organizationId,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.type ? { type: query.type } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.certification.findMany({
      where,
      ...paginationArgs(query),
      orderBy: orderBy(query.sort, query.order, ['createdAt', 'expiresAt']),
    }),
    prisma.certification.count({ where }),
  ]);

  return { items: items.map(decorate), total, page: query.page, limit: query.limit };
};

export const create = async (payload, req) => {
  const cert = await prisma.certification.create({
    data: {
      ...payload,
      id: resolveId(payload.id),
      organizationId: req.tenant.organizationId,
      // Toute déclaration démarre en attente de vérification
      status: 'PENDING',
    },
  });

  await audit({ actorId: req.user.id, action: 'certification.create', resource: 'certifications', resourceId: cert.id, req, newValue: { type: cert.type, issuer: cert.issuer } });
  return decorate(cert);
};

export const getOne = async (id, req) => {
  const cert = assertOwnership(
    await prisma.certification.findUnique({ where: { id } }),
    req.tenant.organizationId,
    'Certification',
  );
  return decorate(cert);
};

/** CERT-02 — vérification administrative (ou par un vérificateur habilité). */
export const verify = async (id, { decision, comment }, req) => {
  const cert = await prisma.certification.findUnique({ where: { id } });
  if (!cert) throw ApiError.notFound('Certification introuvable');
  if (cert.status === 'VERIFIED' && decision === 'VERIFIED') {
    throw ApiError.conflict('Certification déjà vérifiée');
  }

  if (decision === 'VERIFIED' && cert.expiresAt && cert.expiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest('Impossible de vérifier une certification déjà expirée');
  }

  const updated = await prisma.certification.update({
    where: { id },
    data: {
      status: decision,
      verifiedBy: req.user.id,
      verifiedAt: new Date(),
    },
  });

  const members = await prisma.membership.findMany({
    where: { organizationId: cert.organizationId, status: 'ACTIVE' },
    select: { userId: true },
  });
  await notifyMany(members.map((m) => m.userId), {
    type: 'certification.decision',
    title: `Certification ${decision === 'VERIFIED' ? 'vérifiée' : 'rejetée'}`,
    body: `${cert.type} — ${cert.issuer}${comment ? ` : ${comment}` : ''}`,
    payload: { certificationId: id, decision },
    dedupeKey: `cert:${id}:${decision}`,
  });

  await audit({
    actorId: req.user.id,
    action: 'certification.verify',
    resource: 'certifications',
    resourceId: id,
    req,
    oldValue: { status: cert.status },
    newValue: { status: decision, comment: comment ?? null },
  });

  return decorate(updated);
};

export const remove = async (id, req) => {
  const cert = assertOwnership(
    await prisma.certification.findUnique({ where: { id } }),
    req.tenant.organizationId,
    'Certification',
  );
  if (cert.status === 'VERIFIED') {
    throw ApiError.conflict('Une certification vérifiée ne peut pas être supprimée, seulement expirée');
  }

  await prisma.certification.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit({ actorId: req.user.id, action: 'certification.delete', resource: 'certifications', resourceId: id, req });
  return { deleted: true };
};

/** CERT-04 — organismes publics : certifications fiables d'une organisation. */
export const trusted = async (organizationId) => {
  const certs = await prisma.certification.findMany({
    where: { organizationId, deletedAt: null, status: 'VERIFIED' },
    orderBy: { expiresAt: 'desc' },
  });

  const now = Date.now();
  return {
    organizationId,
    certifications: certs.map(decorate),
    valid: certs.filter((c) => !c.expiresAt || c.expiresAt.getTime() > now).length,
    expired: certs.filter((c) => c.expiresAt && c.expiresAt.getTime() <= now).length,
    // Séparation explicite : vérifié ≠ simplement déclaré
    declaredPending: await prisma.certification.count({
      where: { organizationId, deletedAt: null, status: 'PENDING' },
    }),
  };
};
