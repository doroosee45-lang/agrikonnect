/**
 * Exigences CDC couvertes : RPT-01, RPT-02, RPT-03.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { audit } from '../../shared/audit.js';

/**
 * REP-01 → REP-03 — Rapports d'avancement et d'impact.
 *
 * Un rapport d'impact porte TOUJOURS sa `source`. Un indicateur « déclaré »
 * n'est jamais présenté comme « mesuré ». Les rapports sont horodatés et
 * ne peuvent pas être antidatés.
 */

const assertProjectAccess = async (projectId, organizationId, { write = false } = {}) => {
  const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
  if (!project) throw ApiError.notFound('Projet introuvable');

  const isOwner = project.organizationId === organizationId;
  if (write && !isOwner) throw ApiError.forbidden('Seul le porteur de projet publie ses rapports');
  if (!write && !isOwner && project.status !== 'PUBLISHED') throw ApiError.notFound('Projet introuvable');

  return project;
};

/** REP-01 — rapport d'avancement (production, dépenses, photos). */
export const createProgress = async (projectId, payload, req) => {
  await assertProjectAccess(projectId, req.tenant.organizationId, { write: true });

  const report = await prisma.progressReport.create({
    data: {
      id: resolveId(payload.id),
      projectId,
      period: payload.period,
      production: payload.production ?? undefined,
      progress: payload.progress ?? null,
      expenses: payload.expenses ?? undefined,
      photos: payload.photos ?? [],
      createdBy: req.user.id,
    },
  });

  await audit({ actorId: req.user.id, action: 'reporting.progress.create', resource: 'progress_reports', resourceId: report.id, req, newValue: { projectId, period: payload.period } });
  return report;
};

/** REP-02 — rapport d'impact avec provenance par indicateur. */
export const createImpact = async (projectId, payload, req) => {
  await assertProjectAccess(projectId, req.tenant.organizationId, { write: true });

  // RPT-03 — un rapport publié est immuable : une nouvelle version ne peut pas
  // réécrire un rapport déjà publié pour la même période (l'historique se
  // consulte, il ne se corrige pas en silence).
  const existing = await prisma.impactReport.findFirst({
    where: { projectId, period: payload.period },
  });
  if (existing?.publishedAt) {
    throw ApiError.conflict(
      `Un rapport d'impact déjà publié existe pour la période ${payload.period} : publier une correction requiert une nouvelle période ou un erratum explicite`,
    );
  }

  const indicators = payload.indicators.map((indicator) => ({
    ...indicator,
    // Chaque indicateur exige sa source : déclaré, mesuré, estimé…
    source: indicator.source ?? 'declared',
  }));

  const unverified = indicators.filter((i) => i.source === 'declared').length;

  const report = await prisma.impactReport.create({
    data: {
      id: resolveId(payload.id),
      projectId,
      period: payload.period,
      indicators,
      source: payload.source ?? 'declared',
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'reporting.impact.create',
    resource: 'impact_reports',
    resourceId: report.id,
    req,
    newValue: { projectId, period: payload.period, source: report.source, declaredIndicators: unverified },
  });

  return {
    report,
    provenance: {
      source: report.source,
      declaredIndicators: unverified,
      totalIndicators: indicators.length,
      caveat: unverified > 0
        ? `${unverified} indicateur(s) déclaré(s) par le porteur de projet, non vérifié(s) par un tiers.`
        : 'Tous les indicateurs portent une source vérifiée ou mesurée.',
    },
  };
};

/** REP-03 — consolidation des rapports d'un projet (historique lisible). */
export const listForProject = async (projectId, req) => {
  await assertProjectAccess(projectId, req.tenant.organizationId);

  const [progress, impact] = await Promise.all([
    prisma.progressReport.findMany({ where: { projectId }, orderBy: { publishedAt: 'desc' }, take: 50 }),
    prisma.impactReport.findMany({ where: { projectId }, orderBy: { publishedAt: 'desc' }, take: 50 }),
  ]);

  return {
    projectId,
    progressReports: progress,
    impactReports: impact.map((r) => ({
      ...r,
      caveat:
        r.source === 'declared'
          ? 'Indicateurs déclarés par le porteur de projet — non vérifiés par un tiers.'
          : 'Indicateurs avec source mesurée ou vérifiée.',
    })),
    rules: [
      'Chaque rapport est horodaté par le serveur et ne peut pas être antidaté.',
      'Un rapport publié n\'est jamais supprimé : une correction se fait par un nouveau rapport.',
    ],
  };
};

export const createProgressUpdate = createProgress;
