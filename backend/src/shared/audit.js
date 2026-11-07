/**
 * Exigences CDC couvertes : SEC-10.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../config/prisma.js';
import { logger } from './http/logger.js';

/**
 * Journal d'audit immuable des actions sensibles (SEC-09).
 *
 * Un module n'écrit jamais directement dans `audit_logs` : il passe par
 * ce service, ce qui garantit un format homogène (qui, quoi, ressource,
 * quand, IP, appareil, ancienne/nouvelle valeur).
 */
export const audit = async ({
  actorId = null,
  actingFor = null,
  action,
  resource,
  resourceId = null,
  req = null,
  oldValue = null,
  newValue = null,
}) => {
  try {
    const ip =
      req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ??
      req?.ip ??
      null;

    await prisma.auditLog.create({
      data: {
        actorId,
        actingFor,
        action,
        resource,
        resourceId,
        ip,
        device: req?.headers?.['user-agent'] ?? null,
        oldValue: oldValue ?? undefined,
        newValue: newValue ?? undefined,
      },
    });
  } catch (error) {
    // L'audit ne doit jamais faire échouer l'action métier, mais l'échec
    // doit être visible dans les logs d'exploitation.
    logger.error('Échec de l\'écriture du journal d\'audit :', error);
  }
};

/** Raccourci : audit d'une action effectuée par l'utilisateur courant. */
export const auditAs = (req, params) =>
  audit({
    actorId: req.user?.id ?? null,
    actingFor: params.actingFor ?? null,
    req,
    ...params,
  });
