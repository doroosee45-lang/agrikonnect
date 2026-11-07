/**
 * Exigences CDC couvertes : GEO-01, GEO-02, GEO-03
 * (identifiants du cahier des charges : GEO-01, DRN-01, SOIL-13).
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { assertOwnership } from '../../middleware/tenant.js';
import { audit } from '../../shared/audit.js';

/**
 * GEO-01 → GEO-03 — Satellite, drone, laboratoire.
 *
 * Chaque résultat est rattaché à une parcelle et porte sa provenance
 * (`provider`, `confidence`, `labPartnerOrgId`, `flownAt`…). On ne mélange
 * jamais une mesure satellite, une observation de drone et une analyse de
 * laboratoire : les sources restent distinctes et affichées.
 */

const assertPlot = async (plotId, organizationId) => {
  const plot = await prisma.plot.findFirst({ where: { id: plotId, organizationId, deletedAt: null } });
  if (!plot) throw ApiError.notFound('Parcelle introuvable');
  return plot;
};

/** Satellites — séries d'indices (NDVI, NDWI…) par parcelle. */
export const satelliteSeries = async (plotId, query, req) => {
  await assertPlot(plotId, req.tenant.organizationId);

  const observations = await prisma.satelliteObservation.findMany({
    where: { plotId, ...(query.index ? { index: query.index } : {}) },
    orderBy: { observedAt: 'asc' },
    take: Math.min(Number(query.limit ?? 200), 500),
  });

  if (observations.length === 0) {
    return {
      plotId,
      available: false,
      observations: [],
      message: 'Aucune observation satellite enregistrée. Aucun indice n\'est extrapolé.',
    };
  }

  return {
    plotId,
    available: true,
    index: query.index ?? observations[0].index,
    observations: observations.map((o) => ({
      observedAt: o.observedAt,
      value: o.value,
      index: o.index,
      provider: o.provider,
      // La couverture nuageuse est affichée : une valeur très nuageuse est peu fiable
      cloudCover: o.cloudCover,
      usable: o.cloudCover == null || o.cloudCover < 30,
      confidence: o.confidence,
    })),
    provenance: {
      distinctProviders: [...new Set(observations.map((o) => o.provider))],
      rule: 'Chaque point conserve son fournisseur et sa date ; aucune moyenne multi-capteurs n\'est calculée.',
    },
  };
};

export const recordSatellite = async (payload, req) => {
  await assertPlot(payload.plotId, req.tenant.organizationId);

  const observation = await prisma.satelliteObservation.create({
    data: {
      id: resolveId(payload.id),
      plotId: payload.plotId,
      provider: payload.provider,
      index: payload.index ?? 'NDVI',
      value: payload.value,
      observedAt: payload.observedAt,
      cloudCover: payload.cloudCover ?? null,
      confidence: payload.confidence ?? 'medium',
    },
  });

  await audit({ actorId: req.user.id, action: 'geodata.satellite.record', resource: 'satellite_observations', resourceId: observation.id, req, newValue: { plotId: payload.plotId, provider: payload.provider } });
  return observation;
};

/** Drones — missions et documents associés. */
export const listDroneSurveys = async (plotId, req) => {
  await assertPlot(plotId, req.tenant.organizationId);

  const surveys = await prisma.droneSurvey.findMany({
    where: { plotId },
    orderBy: { flownAt: 'desc' },
    take: 50,
  });

  return {
    plotId,
    surveys: surveys.map((s) => ({
      ...s,
      // Un drone n'est pas un satellite : type et opérateur toujours affichés
      provenance: { sourceKind: 'drone', operatorOrgId: s.operatorOrgId, flownAt: s.flownAt },
    })),
  };
};

export const recordDroneSurvey = async (payload, req) => {
  await assertPlot(payload.plotId, req.tenant.organizationId);

  const survey = await prisma.droneSurvey.create({
    data: {
      id: resolveId(payload.id),
      plotId: payload.plotId,
      organizationId: req.tenant.organizationId,
      operatorOrgId: payload.operatorOrgId ?? req.tenant.organizationId,
      type: payload.type,
      storageKey: payload.storageKey ?? null,
      reportKey: payload.reportKey ?? null,
      flownAt: payload.flownAt,
    },
  });

  await audit({ actorId: req.user.id, action: 'geodata.drone.record', resource: 'drone_surveys', resourceId: survey.id, req, newValue: { plotId: payload.plotId, type: payload.type } });
  return survey;
};

/** Laboratoire — résultats d'analyse rattachés à un prélèvement. */
export const labResults = async (plotId, req) => {
  await assertPlot(plotId, req.tenant.organizationId);

  const results = await prisma.labResult.findMany({
    where: { plotId },
    orderBy: { sampledAt: 'desc' },
    take: 50,
  });

  return {
    plotId,
    results: results.map((r) => ({
      ...r,
      provenance: {
        sourceKind: 'lab',
        labPartnerOrgId: r.labPartnerOrgId,
        sampledAt: r.sampledAt,
        // Une analyse de laboratoire est la source la plus forte : marquée comme telle
        reliability: 'measured_lab',
      },
    })),
    trust: 'Les résultats de laboratoire ne sont jamais fusionnés avec des valeurs déclarées.',
  };
};

export const recordLabResult = async (payload, req) => {
  await assertPlot(payload.plotId, req.tenant.organizationId);

  const labOrgId = req.tenant.organizationId;
  const isLabPartner = req.tenant.organization?.type === 'LAB_PARTNER';

  if (!isLabPartner && !['ADMIN', 'SUPER_ADMIN'].includes(req.tenant.roles?.[0])) {
    // Seul un laboratoire partenaire (ou un administrateur) saisit un résultat
    throw ApiError.forbidden('Seul un laboratoire partenaire peut publier un résultat d\'analyse');
  }

  const result = await prisma.labResult.create({
    data: {
      id: resolveId(payload.id),
      organizationId: req.tenant.organizationId,
      plotId: payload.plotId,
      labPartnerOrgId: labOrgId,
      sampleId: payload.sampleId,
      sampledAt: payload.sampledAt,
      parameters: payload.parameters,
      reportKey: payload.reportKey ?? null,
    },
  });

  await audit({ actorId: req.user.id, action: 'geodata.lab.record', resource: 'lab_results', resourceId: result.id, req, newValue: { plotId: payload.plotId, sampleId: payload.sampleId } });
  return result;
};

/** Vue consolidée « toutes sources » avec provenance affichée ligne par ligne. */
export const plotObservations = async (plotId, req) => {
  const plot = await assertPlot(plotId, req.tenant.organizationId);

  const [satellite, drones, lab, soil] = await Promise.all([
    prisma.satelliteObservation.findMany({ where: { plotId }, orderBy: { observedAt: 'desc' }, take: 12 }),
    prisma.droneSurvey.findMany({ where: { plotId }, orderBy: { flownAt: 'desc' }, take: 5 }),
    prisma.labResult.findMany({ where: { plotId }, orderBy: { sampledAt: 'desc' }, take: 5 }),
    prisma.soilAssessment.findMany({
      where: { plotId, deletedAt: null },
      orderBy: { assessedAt: 'desc' },
      take: 3,
      include: { parameters: true },
    }),
  ]);

  return {
    plot: { id: plot.id, name: plot.name, cropId: plot.currentCropId, areaHa: plot.areaHa },
    sources: {
      satellite: satellite.map((s) => ({ kind: 'satellite', at: s.observedAt, provider: s.provider, value: s.value, index: s.index, confidence: s.confidence })),
      drone: drones.map((d) => ({ kind: 'drone', at: d.flownAt, type: d.type, reportKey: d.reportKey })),
      lab: lab.map((l) => ({ kind: 'lab', at: l.sampledAt, sampleId: l.sampleId, parameters: l.parameters })),
      soil: soil.map((s) => ({ kind: 'soil_assessment', at: s.assessedAt, source: s.source, parameters: s.parameters.map((p) => ({ key: p.key, value: p.numericValue ?? p.value, unit: p.unit, source: p.source, confidence: p.confidence })) })),
    },
    // Principe de provenance V1 conservé : chaque valeur garde sa source
    provenancePolicy: 'Chaque observation conserve sa source, sa date et son niveau de confiance. Aucune fusion entre capteurs.',
  };
};
