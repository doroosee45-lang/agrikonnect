/**
 * Exigences CDC couvertes : FUND-01, FUND-02, FUND-03.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { generateToken } from '../../shared/crypto.js';
import { audit } from '../../shared/audit.js';
import { notify } from '../../shared/events.js';

/**
 * FUND-01 → FUND-03 — Mise en relation de financement.
 *
 * Règle centrale (CDC V4 §9) : AUCUNE transmission de dossier à un partenaire
 * sans consentement explicite et enregistré (identifiant + horodatage + copie
 * du contenu transmis). L'absence de consentement bloque la transmission au
 * niveau du service, pas seulement de l'interface.
 *
 * La plateforme ne collecte pas de fonds et ne promet aucun rendement.
 */

const DISCLAIMER =
  'AGRIKONNECT facilite la mise en relation. La plateforme ne collecte, ne détient ni ne gère ' +
  'aucun fonds, ne garantit aucune levée et ne promet aucun rendement.';

export const requestConsent = async (projectId, req) => {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: req.tenant.organizationId, deletedAt: null },
  });
  if (!project) throw ApiError.notFound('Projet introuvable');

  // Jeton de consentement à usage unique, à conserver côté client
  const consentId = generateToken(24);

  const draft = await prisma.fundingRequest.create({
    data: {
      id: resolveId(),
      projectId,
      consentId,
      consentAt: new Date(),
      contentSnapshot: {
        projectTitle: project.title,
        fundingNeed: project.fundingNeed,
        durationMonths: project.durationMonths,
        impact: project.impact,
        // Copie figée : ce qui sera transmis, et rien d'autre
        snapshotAt: new Date().toISOString(),
      },
      status: 'DRAFT',
    },
  });

  await audit({ actorId: req.user.id, action: 'funding.consent.issued', resource: 'funding_requests', resourceId: draft.id, req });

  return {
    fundingRequestId: draft.id,
    consentId,
    contentPreview: draft.contentSnapshot,
    nextStep:
      'La transmission exige un consentement explicite : POST /funding/funding-requests/:id/transmit avec { consentId, consentGiven: true }.',
    disclaimer: DISCLAIMER,
  };
};

export const transmit = async (id, { consentId, consentGiven, partnerName, partnerOrgId }, req) => {
  const funding = await prisma.fundingRequest.findUnique({ where: { id } });
  if (!funding) throw ApiError.notFound('Demande de financement introuvable');

  const project = await prisma.project.findFirst({
    where: { id: funding.projectId, organizationId: req.tenant.organizationId, deletedAt: null },
  });
  if (!project) throw ApiError.notFound('Demande de financement introuvable');

  // FUND-02 — le consentement est une condition dure
  if (consentGiven !== true || consentId !== funding.consentId) {
    throw ApiError.forbidden(
      'Transmission refusée : consentement explicite absent ou invalide (FUND-02). ' +
        'Aucun dossier n\'est transmis sans accord enregistré.',
    );
  }
  if (funding.status !== 'DRAFT') {
    throw ApiError.conflict(`Dossier déjà ${funding.status}`);
  }
  if (project.status !== 'PUBLISHED') {
    throw ApiError.conflict('Seul un projet publié peut être présenté à un partenaire');
  }

  const updated = await prisma.fundingRequest.update({
    where: { id },
    data: {
      status: 'TRANSMITTED',
      transmittedAt: new Date(),
      partnerName: partnerName ?? null,
      partnerOrgId: partnerOrgId ?? null,
      contentSnapshot: {
        ...(funding.contentSnapshot ?? {}),
        consent: {
          consentId,
          consentGiven: true,
          givenAt: new Date().toISOString(),
          givenBy: req.user.id,
          scope: 'transmission du dossier résumé à un partenaire identifié',
        },
      },
    },
  });

  await notify({
    userId: req.user.id,
    type: 'funding.transmitted',
    title: 'Dossier transmis',
    body: partnerName ? `Transmis à ${partnerName}` : 'Dossier transmis au partenaire',
    payload: { fundingRequestId: id, projectId: funding.projectId },
    dedupeKey: `funding:${id}:transmitted`,
  });

  await audit({
    actorId: req.user.id,
    action: 'funding.transmit',
    resource: 'funding_requests',
    resourceId: id,
    req,
    newValue: { consentId, partnerName: partnerName ?? null, transmittedAt: updated.transmittedAt },
  });

  return {
    fundingRequest: updated,
    // Le dossier ne contient que le snapshot consenti
    transmittedContent: updated.contentSnapshot,
    disclaimer: DISCLAIMER,
  };
};

export const list = async (projectId, req) => {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: req.tenant.organizationId, deletedAt: null },
  });
  if (!project) throw ApiError.notFound('Projet introuvable');

  const requests = await prisma.fundingRequest.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  return {
    projectId,
    requests,
    counts: {
      draft: requests.filter((r) => r.status === 'DRAFT').length,
      transmitted: requests.filter((r) => r.status === 'TRANSMITTED').length,
    },
    disclaimer: DISCLAIMER,
  };
};

/** FUND-03 — clôture du suivi (retour du partenaire, sans transaction financière). */
export const acknowledge = async (id, { status, note }, req) => {
  const funding = await prisma.fundingRequest.findUnique({ where: { id } });
  if (!funding) throw ApiError.notFound('Demande de financement introuvable');

  const project = await prisma.project.findFirst({
    where: { id: funding.projectId, organizationId: req.tenant.organizationId },
  });
  if (!project) throw ApiError.notFound('Demande de financement introuvable');

  const updated = await prisma.fundingRequest.update({
    where: { id },
    data: {
      status,
      contentSnapshot: { ...(funding.contentSnapshot ?? {}), followUp: { status, note: note ?? null, at: new Date().toISOString() } },
    },
  });

  await audit({ actorId: req.user.id, action: 'funding.followup', resource: 'funding_requests', resourceId: id, req, newValue: { status, note: note ?? null } });
  return { fundingRequest: updated, disclaimer: DISCLAIMER };
};
