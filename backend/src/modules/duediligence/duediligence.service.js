/**
 * Exigences CDC couvertes : DD-01, DD-02, DD-03.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { audit } from '../../shared/audit.js';

/**
 * DD-01 → DD-03 — Due diligence.
 *
 * Un élément de due diligence n'est `VERIFIED` que si un professionnel est
 * identifié (nom + qualité). Sinon il reste `IN_PROGRESS` : on n'affiche
 * jamais une vérification anonyme comme un contrôle effectué.
 */

const PROFESSIONAL_CAPACITIES = [
  'expert_comptable', 'commissaire_aux_comptes', 'notaire', 'avocat',
  'agronome', 'ingenieur_agronome', 'auditeur', 'certification_body',
];

/** Modèle de checklist par catégorie (créé à la demande). */
const TEMPLATE = {
  legal: ['Statuts de l\'organisation', 'Titre de propriété / bail des terres', 'Autorisations d\'exploiter'],
  financial: ['États financiers 3 derniers exercices', 'Relevés bancaires', 'Structure de la dette'],
  agronomic: ['Analyse de sol', 'Historique des rendements', 'Plan de production'],
  environmental: ['Évaluation d\'impact', 'Plan de gestion des déchets', 'Usage de l\'eau'],
  social: ['Registre du personnel', 'Politique de sécurité', 'Travail des enfants : attestation de non-recours'],
};

export const ensureChecklist = async (projectId, req) => {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: req.tenant.organizationId, deletedAt: null },
  });
  if (!project) throw ApiError.notFound('Projet introuvable');

  const existing = await prisma.dueDiligenceItem.findMany({ where: { projectId } });
  if (existing.length > 0) return existing;

  const rows = [];
  for (const [category, labels] of Object.entries(TEMPLATE)) {
    for (const label of labels) {
      // eslint-disable-next-line no-await-in-loop
      rows.push(
        await prisma.dueDiligenceItem.create({
          data: { id: resolveId(), projectId, category, label, status: 'NOT_STARTED', evidence: [] },
        }),
      );
    }
  }

  await audit({ actorId: req.user.id, action: 'duediligence.checklist.create', resource: 'due_diligence_items', resourceId: projectId, req, newValue: { items: rows.length } });
  return rows;
};

export const list = async (projectId, req) => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.deletedAt) throw ApiError.notFound('Projet introuvable');

  const isOwner = project.organizationId === req.tenant.organizationId;
  const isProfessional = (req.user?.roles ?? []).some((r) => ['VERIFIER', 'ADMIN', 'SUPER_ADMIN'].includes(r));
  if (!isOwner && !isProfessional) {
    // La due diligence n'est pas publique
    throw ApiError.notFound('Projet introuvable');
  }

  const items = await prisma.dueDiligenceItem.findMany({
    where: { projectId },
    orderBy: [{ category: 'asc' }, { label: 'asc' }],
  });

  const byCategory = items.reduce((acc, item) => {
    acc[item.category] = acc[item.category] ?? { total: 0, verified: 0, issues: 0 };
    acc[item.category].total += 1;
    if (item.status === 'VERIFIED') acc[item.category].verified += 1;
    if (item.status === 'ISSUE') acc[item.category].issues += 1;
    return acc;
  }, {});

  return {
    projectId,
    items,
    summary: byCategory,
    completion: items.length > 0 ? Math.round((items.filter((i) => i.status === 'VERIFIED').length / items.length) * 100) : 0,
    // Transparence : vérifié par un professionnel identifié, ou pas vérifié
    rule: 'Un élément ne peut être VERIFIED que si le nom et la qualité du professionnel sont renseignés (DD-02).',
  };
};

export const update = async (id, payload, req) => {
  const item = await prisma.dueDiligenceItem.findUnique({ where: { id } });
  if (!item) throw ApiError.notFound('Élément introuvable');

  const project = await prisma.project.findUnique({ where: { id: item.projectId } });
  const isOwner = project?.organizationId === req.tenant.organizationId;
  const isProfessional = (req.user?.roles ?? []).some((r) => ['VERIFIER', 'ADMIN', 'SUPER_ADMIN'].includes(r));
  if (!isOwner && !isProfessional) throw ApiError.notFound('Élément introuvable');

  // DD-02 — pas de vérification anonyme
  if (payload.status === 'VERIFIED') {
    if (!isProfessional) {
      throw ApiError.forbidden(
        'Seul un professionnel habilité (VERIFIER) peut marquer un élément comme vérifié',
      );
    }
    const name = payload.professionalName ?? item.professionalName;
    const capacity = payload.professionalCapacity ?? item.professionalCapacity;
    if (!name || !capacity) {
      throw ApiError.badRequest(
        'Nom et qualité du professionnel requis pour valider un élément (DD-02)',
        [{ field: 'professionalName', code: 'required' }, { field: 'professionalCapacity', code: 'required' }],
      );
    }
    if (capacity && !PROFESSIONAL_CAPACITIES.includes(capacity) && !isProfessional) {
      throw ApiError.badRequest(`Qualité professionnelle non reconnue. Valeurs : ${PROFESSIONAL_CAPACITIES.join(', ')}`);
    }
  }

  const updated = await prisma.dueDiligenceItem.update({
    where: { id },
    data: {
      ...payload,
      ...(payload.status === 'VERIFIED' ? { reviewedAt: new Date() } : {}),
    },
  });

  await audit({
    actorId: req.user.id,
    action: 'duediligence.update',
    resource: 'due_diligence_items',
    resourceId: id,
    req,
    oldValue: { status: item.status },
    newValue: { status: updated.status, professionalName: updated.professionalName },
  });

  return {
    item: updated,
    // Rappel affiché dans l'interface investisseur
    notice: updated.status === 'VERIFIED'
      ? `Vérifié par ${updated.professionalName} (${updated.professionalCapacity})`
      : 'Non vérifié par un tiers à ce jour',
  };
};

/** Ajout de pièces justificatives (références de stockage, jamais de contenu). */
export const addEvidence = async (id, { evidence }, req) => {
  const item = await prisma.dueDiligenceItem.findUnique({ where: { id } });
  if (!item) throw ApiError.notFound('Élément introuvable');

  const updated = await prisma.dueDiligenceItem.update({
    where: { id },
    data: { evidence: [...new Set([...item.evidence, ...evidence])] },
  });

  await audit({ actorId: req.user.id, action: 'duediligence.evidence', resource: 'due_diligence_items', resourceId: id, req, newValue: { added: evidence.length } });
  return updated;
};
