/**
 * Exigences CDC couvertes : SOIL-01, SOIL-02, SOIL-03.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { assertOwnership } from '../../middleware/tenant.js';
import { audit } from '../../shared/audit.js';
import { fuseProfile } from './intelligence.service.js';

/**
 * Module Soil & Crop Intelligence — piste S1 (CDC V1 §6).
 *
 * S1 ne recommande RIEN : elle collecte, structure et affiche avec provenance.
 * Chaque paramètre porte value, unit, source, method, confidence, measuredAt.
 * Aucun score global, aucune recommandation de culture en V1.
 */

const DISPLAY_RULES = {
  measured: '✔ mesuré (laboratoire / capteur)',
  estimated: '≈ déclaré ou estimé',
  note: 'Chaque valeur affiche sa source et sa date. Aucune recommandation automatique en V1.',
};

const SOURCE_LABEL = {
  declared: 'Déclarée par le producteur',
  estimated: 'Estimation',
  derived: 'Dérivée (calcul)',
  measured_lab: 'Mesurée en laboratoire',
  measured_sensor: 'Mesurée par capteur',
  third_party_verified: 'Vérifiée par un tiers',
};

/** Libellé d'affichage : ✔ = mesuré, ≈ = déclaré/estimé (CDC §11.6). */
const displayFlag = (source) =>
  source === 'measured_lab' || source === 'measured_sensor' ? 'measured' : 'estimated';

const shapeAssessment = (assessment) => ({
  id: assessment.id,
  plotId: assessment.plotId,
  assessedAt: assessment.assessedAt,
  countryCode: assessment.countryCode,
  notes: assessment.notes,
  source: assessment.source,
  version: assessment.version,
  parameters: assessment.parameters.map((p) => ({
    key: p.key,
    value: p.value,
    numericValue: p.numericValue,
    unit: p.unit,
    source: p.source,
    sourceLabel: SOURCE_LABEL[p.source] ?? p.source,
    flag: displayFlag(p.source),
    method: p.method,
    confidence: p.confidence,
    measuredAt: p.measuredAt,
    labReportId: p.labReportId,
  })),
});

const assertPlot = async (plotId, organizationId) => {
  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    include: { farm: { select: { countryCode: true } } },
  });
  return assertOwnership(plot, organizationId, 'Parcelle');
};

export const list = async (plotId, req) => {
  await assertPlot(plotId, req.tenant.organizationId);

  const items = await prisma.soilAssessment.findMany({
    where: { plotId, deletedAt: null },
    orderBy: { assessedAt: 'desc' },
    include: { parameters: true },
  });

  return {
    items: items.map(shapeAssessment),
    displayRules: DISPLAY_RULES,
    // SOIL-01 : message explicite quand aucune analyse n'existe (CDC V1 §6.5)
    emptyMessage:
      items.length === 0
        ? 'Aucune analyse de sol enregistrée. Une analyse en laboratoire permet d\'améliorer les futures recommandations.'
        : null,
  };
};

/**
 * SOIL-01 : dernier profil de sol connu, avec les données manquantes
 * (paramètres attendus non renseignés) — sans aucune interprétation.
 */
export const latestProfile = async (plotId, req) => {
  await assertPlot(plotId, req.tenant.organizationId);

  const latest = await prisma.soilAssessment.findFirst({
    where: { plotId, deletedAt: null },
    orderBy: { assessedAt: 'desc' },
    include: { parameters: true },
  });

  const expected = ['ph', 'organicMatter', 'texture', 'n', 'p', 'k'];
  const present = new Set((latest?.parameters ?? []).map((p) => p.key));

  // SOIL-10 → SOIL-13 : profil fusionné multi-sources, avec la priorité du CDC §6.5
  const fused = await fuseProfile(plotId);

  return {
    plotId,
    assessment: latest ? shapeAssessment(latest) : null,
    fusedProfile: fused.parameters,
    sourcesUsed: fused.sourcesUsed,
    sourcePriority: fused.priorityOrder,
    missingParameters: expected.filter((k) => !present.has(k)),
    displayRules: DISPLAY_RULES,
    /**
     * Avertissement systématique S-P1 / S-P4 : en V1 le système ne conclut pas.
     */
    disclaimer:
      'Évaluation indicative : les données affichées sont celles disponibles. Aucune recommandation de culture n\'est produite en V1. Une analyse de sol en laboratoire est recommandée avant toute décision importante.',
  };
};

export const create = async (plotId, payload, req) => {
  const plot = await assertPlot(plotId, req.tenant.organizationId);

  // SOIL-02 : cohérence du rapport de laboratoire rattaché
  if (payload.labReportDocumentId) {
    const doc = await prisma.document.findUnique({ where: { id: payload.labReportDocumentId } });
    assertOwnership(doc, req.tenant.organizationId, 'Document');
  }

  const assessment = await prisma.soilAssessment.create({
    data: {
      id: resolveId(payload.id),
      organizationId: req.tenant.organizationId,
      plotId,
      assessedAt: payload.assessedAt,
      countryCode: plot.farm?.countryCode ?? 'CD',
      notes: payload.notes ?? null,
      source: payload.parameters.some((p) => p.source === 'measured_lab')
        ? 'measured_lab'
        : 'declared',
      createdBy: req.user.id,
      parameters: {
        create: payload.parameters.map((p) => ({
          key: p.key,
          value: p.value,
          numericValue: p.numericValue ?? null,
          unit: p.unit ?? null,
          source: p.source,
          method: p.method ?? null,
          confidence: p.confidence,
          measuredAt: p.measuredAt ?? payload.assessedAt,
          labReportId: payload.labReportDocumentId ?? null,
        })),
      },
    },
    include: { parameters: true },
  });

  await audit({
    actorId: req.user.id,
    action: 'soil.create',
    resource: 'soil_assessments',
    resourceId: assessment.id,
    req,
    newValue: { plotId, assessedAt: payload.assessedAt, parameters: payload.parameters.map((p) => p.key) },
  });

  return shapeAssessment(assessment);
};

export const update = async (plotId, assessmentId, payload, req) => {
  await assertPlot(plotId, req.tenant.organizationId);

  const existing = await prisma.soilAssessment.findUnique({ where: { id: assessmentId } });
  if (!existing || existing.plotId !== plotId || existing.deletedAt) {
    throw ApiError.notFound('Analyse de sol introuvable');
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (payload.parameters) {
      await tx.soilParameter.deleteMany({ where: { assessmentId } });
      await tx.soilParameter.createMany({
        data: payload.parameters.map((p) => ({
          assessmentId,
          key: p.key,
          value: p.value,
          numericValue: p.numericValue ?? null,
          unit: p.unit ?? null,
          source: p.source,
          method: p.method ?? null,
          confidence: p.confidence,
          measuredAt: p.measuredAt ?? payload.assessedAt ?? existing.assessedAt,
        })),
      });
    }

    return tx.soilAssessment.update({
      where: { id: assessmentId },
      data: {
        ...(payload.assessedAt ? { assessedAt: payload.assessedAt } : {}),
        ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
        version: { increment: 1 },
      },
      include: { parameters: true },
    });
  });

  await audit({
    actorId: req.user.id,
    action: 'soil.update',
    resource: 'soil_assessments',
    resourceId: assessmentId,
    req,
    newValue: { parameters: payload.parameters?.map((p) => p.key) ?? null },
  });

  return shapeAssessment(updated);
};

export const archive = async (plotId, assessmentId, req) => {
  await assertPlot(plotId, req.tenant.organizationId);

  const existing = await prisma.soilAssessment.findUnique({ where: { id: assessmentId } });
  if (!existing || existing.plotId !== plotId || existing.deletedAt) {
    throw ApiError.notFound('Analyse de sol introuvable');
  }

  await prisma.soilAssessment.update({
    where: { id: assessmentId },
    data: { deletedAt: new Date(), version: { increment: 1 } },
  });

  await audit({
    actorId: req.user.id,
    action: 'soil.archive',
    resource: 'soil_assessments',
    resourceId: assessmentId,
    req,
  });

  return { archived: true };
};
