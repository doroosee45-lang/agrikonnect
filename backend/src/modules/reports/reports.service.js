import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { paginationArgs, orderBy } from '../../shared/pagination.js';
import { audit } from '../../shared/audit.js';

/** Signalements et modération (V1 §5.12, MKT-05 pour la suite). */

export const create = async (payload, req) => {
  const report = await prisma.report.create({
    data: {
      id: resolveId(),
      reporterId: req.user.id,
      subjectType: payload.subjectType,
      subjectId: payload.subjectId,
      reason: payload.reason,
      details: payload.details ?? null,
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'report.create',
    resource: 'reports',
    resourceId: report.id,
    req,
    newValue: { subjectType: payload.subjectType, subjectId: payload.subjectId, reason: payload.reason },
  });

  return report;
};

export const listForModeration = async (query) => {
  const { page, limit, sort, order, status } = query;

  const where = { ...(status ? { status } : { status: 'OPEN' }) };

  const [items, total] = await Promise.all([
    prisma.report.findMany({
      where,
      ...paginationArgs({ page, limit }),
      orderBy: orderBy(sort, order, ['createdAt']),
    }),
    prisma.report.count({ where }),
  ]);

  return { items, total, page, limit };
};

export const review = async (id, { status, decision }, req) => {
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) throw ApiError.notFound('Signalement introuvable');
  if (report.status === 'RESOLVED' || report.status === 'REJECTED') {
    throw ApiError.conflict('Ce signalement est déjà clos');
  }

  const updated = await prisma.report.update({
    where: { id },
    data: {
      status,
      decision: decision ?? null,
      moderatorId: req.user.id,
      decidedAt: status === 'REVIEWING' ? null : new Date(),
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'report.review',
    resource: 'reports',
    resourceId: id,
    req,
    oldValue: { status: report.status },
    newValue: { status, decision: decision ?? null },
  });

  return updated;
};
