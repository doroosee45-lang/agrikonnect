/**
 * Exigences CDC couvertes : PREC-01, PREC-02, PREC-03
 * (identifiant du cahier des charges : SOIL-15).
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { audit } from '../../shared/audit.js';
import { buildPdf } from '../../shared/pdf.js';

/**
 * PRE-01 → PRE-03 — Agriculture de précision.
 *
 * Deux exigences :
 *  1. Toute zone de gestion et tout rapport de précision porte une VERSION DE
 *     MÉTHODE (`methodVersion`) et la liste de ses `sources`. Recalculer avec
 *     une autre méthode crée une nouvelle version, jamais un écrasement.
 *  2. Un rapport de précision n'est « validé » que par un agronome identifié
 *     (`validatedBy` + `validatedAt`). Sinon il reste à l'état de proposition.
 */

export const METHOD_VERSION = 'zones-v1.0';

const assertPlot = async (plotId, organizationId) => {
  const plot = await prisma.plot.findFirst({ where: { id: plotId, organizationId, deletedAt: null } });
  if (!plot) throw ApiError.notFound('Parcelle introuvable');
  return plot;
};

/**
 * Calcul de zones à partir de sources RÉELLES disponibles sur la parcelle.
 * Aucune zone n'est produite si les données sont insuffisantes.
 */
export const computeZones = async (plotId, payload, req) => {
  await assertPlot(plotId, req.tenant.organizationId);

  const [satellite, soil, readings] = await Promise.all([
    prisma.satelliteObservation.findMany({ where: { plotId }, orderBy: { observedAt: 'desc' }, take: 10 }),
    prisma.soilAssessment.findMany({
      where: { plotId, deletedAt: null },
      orderBy: { assessedAt: 'desc' },
      take: 1,
      include: { parameters: true },
    }),
    prisma.sensorReading.findMany({
      where: { device: { plotId } },
      orderBy: { at: 'desc' },
      take: 20,
    }),
  ]);

  const sources = [];
  if (satellite.length > 0) sources.push({ kind: 'satellite', points: satellite.length, index: satellite[0].index });
  if (soil.length > 0) sources.push({ kind: 'soil_assessment', parameters: soil[0].parameters.length });
  if (readings.length > 0) sources.push({ kind: 'sensor', readings: readings.length });

  if (sources.length === 0) {
    throw ApiError.badRequest(
      'Données insuffisantes pour délimiter des zones de gestion : aucune source (satellite, sol, capteur) disponible. Aucune zone n\'est inventée.',
    );
  }

  // Découpage en 2 ou 3 zones selon le nombre de sources, chacune avec sa justification
  const zoneCount = sources.length >= 3 ? 3 : 2;
  const zones = Array.from({ length: zoneCount }, (_, index) => ({
    index,
    label: `Zone ${index + 1}`,
    // Aucune géométrie inventée : le contour doit être fourni par le client
    geometry: null,
    basis: sources.map((s) => s.kind),
    recommendation: null,
  }));

  const zonesRecord = await prisma.managementZone.create({
    data: {
      id: resolveId(payload.id),
      plotId,
      organizationId: req.tenant.organizationId,
      methodVersion: payload.methodVersion ?? METHOD_VERSION,
      sources: { available: sources, missing: ['géométrie fine des zones (à fournir)'] },
      zones,
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'precision.zones.compute',
    resource: 'management_zones',
    resourceId: zonesRecord.id,
    req,
    newValue: { plotId, methodVersion: zonesRecord.methodVersion, zones: zoneCount },
  });

  return {
    managementZones: zonesRecord,
    justification: {
      methodVersion: zonesRecord.methodVersion,
      sources,
      rule: 'Les zones ne sont délimitées que sur sources disponibles ; aucune interpolation non documentée.',
      requiresFieldValidation: true,
    },
  };
};

export const listZones = async (plotId, req) => {
  await assertPlot(plotId, req.tenant.organizationId);

  const zoneSets = await prisma.managementZone.findMany({
    where: { plotId, organizationId: req.tenant.organizationId },
    orderBy: { computedAt: 'desc' },
    take: 20,
  });

  return {
    plotId,
    versions: zoneSets.map((z) => ({
      id: z.id,
      methodVersion: z.methodVersion,
      computedAt: z.computedAt,
      zones: z.zones,
      sources: z.sources,
    })),
    // Historique conservé : jamais de réécriture d'une version passée
    versioning: 'Chaque calcul crée une nouvelle version horodatée.',
  };
};

/** PRE-02 — rapport de précision (proposition puis validation humaine). */
export const createReport = async (plotId, payload, req) => {
  await assertPlot(plotId, req.tenant.organizationId);

  const report = await prisma.precisionReport.create({
    data: {
      id: resolveId(payload.id),
      plotId,
      organizationId: req.tenant.organizationId,
      pdfKey: payload.pdfKey ?? null,
      ruleSetVersion: payload.ruleSetVersion ?? null,
      methodVersion: payload.methodVersion ?? METHOD_VERSION,
      // Aucune validation automatique : validatedBy reste vide
      validatedBy: null,
      validatedAt: null,
    },
  });

  await audit({ actorId: req.user.id, action: 'precision.report.create', resource: 'precision_reports', resourceId: report.id, req, newValue: { plotId, methodVersion: report.methodVersion } });

  return {
    report,
    status: 'NOT_VALIDATED',
    disclaimer:
      'Rapport généré automatiquement. Il ne vaut pas recommandation agronomique tant qu\'un agronome ne l\'a pas validé (PRE-03).',
  };
};

/** PRE-03 — validation par un agronome identifié. */
export const validateReport = async (reportId, payload, req) => {
  const report = await prisma.precisionReport.findUnique({ where: { id: reportId } });
  if (!report) throw ApiError.notFound('Rapport introuvable');
  if (report.validatedAt) throw ApiError.conflict('Rapport déjà validé');

  const updated = await prisma.precisionReport.update({
    where: { id: reportId },
    data: {
      validatedBy: req.user.id,
      validatedAt: new Date(),
      ruleSetVersion: payload.ruleSetVersion ?? report.ruleSetVersion,
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'precision.report.validate',
    resource: 'precision_reports',
    resourceId: reportId,
    req,
    newValue: { validatedBy: req.user.id, ruleSetVersion: updated.ruleSetVersion },
  });

  return {
    report: updated,
    validated: true,
    notice: 'Validation humaine enregistrée : le rapport peut être présenté comme recommandation encadrée.',
  };
};

export const listReports = async (plotId, req) => {
  await assertPlot(plotId, req.tenant.organizationId);

  const reports = await prisma.precisionReport.findMany({
    where: { plotId, organizationId: req.tenant.organizationId },
    orderBy: { generatedAt: 'desc' },
    take: 30,
  });

  return {
    plotId,
    reports: reports.map((r) => ({
      ...r,
      validated: Boolean(r.validatedAt),
      status: r.validatedAt ? 'VALIDATED_BY_AGRONOMIST' : 'PROPOSITION_NON_VALIDEE',
    })),
  };
};


/**
 * S4 §9.4 — rapport de précision en PDF.
 *
 * Le rapport porte en clair et sur chaque page la mention « ne constitue pas une
 * certification » : c'est une exigence du CDC, pas une note de bas de page.
 */
export const reportPdf = async (reportId, req) => {
  const report = await prisma.precisionReport.findUnique({ where: { id: reportId } });
  if (!report) throw ApiError.notFound('Rapport introuvable');
  if (report.organizationId !== req.tenant.organizationId) throw ApiError.notFound('Rapport introuvable');

  const plot = await prisma.plot.findUnique({ where: { id: report.plotId } });
  const zones = await prisma.managementZone.findFirst({
    where: { plotId: report.plotId, organizationId: req.tenant.organizationId },
    orderBy: { computedAt: 'desc' },
  });

  const buffer = await buildPdf({
    title: 'Rapport de précision parcellaire',
    subtitle: 'Document technique — ne constitue pas une certification',
    reference: report.id,
    sections: [
      {
        heading: 'Parcelle',
        rows: [
          ['Nom', plot?.name ?? '—'],
          ['Superficie', `${plot?.areaHa ?? plot?.area ?? '—'} ha`],
          ['Version de méthode', report.methodVersion ?? '—'],
          ['Jeu de règles', report.ruleSetVersion ?? '—'],
          ['Généré le', new Date(report.generatedAt).toISOString().slice(0, 10)],
          [
            'Validation agronomique',
            report.validatedAt ? `validé le ${new Date(report.validatedAt).toISOString().slice(0, 10)}` : 'non validé',
          ],
        ],
      },
      {
        heading: 'Zones de gestion',
        text: zones
          ? `${Array.isArray(zones.zones) ? zones.zones.length : 0} zone(s) calculée(s), sources : ${JSON.stringify(zones.sources ?? [])}.`
          : 'Aucune zone calculée pour cette parcelle.',
      },
      {
        heading: 'Limites',
        text:
          'Les zones sont des propositions issues de données déclarées ou mesurées. ' +
          'Elles ne remplacent ni une analyse de laboratoire ni un diagnostic de terrain. ' +
          'Ce rapport ne constitue pas une certification et ne peut être présenté comme telle.',
      },
    ],
    footer:
      'AGRIKONNECT AFRICA — rapport de précision — NE CONSTITUE PAS UNE CERTIFICATION — ' +
      'document technique non opposable en tant que preuve de conformité.',
  });

  await audit({
    actorId: req.user.id,
    action: 'precision.report.pdf',
    resource: 'precision_reports',
    resourceId: report.id,
    req,
  });

  return { buffer, filename: `rapport-precision-${report.id}.pdf` };
};
