/**
 * Exigences CDC couvertes : SEC-04.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { ApiError } from '../shared/errors/ApiError.js';
import { PLATFORM_ROLES } from '../shared/permissions.js';

/** H-03 — fonction pure (testée) : rôles applicables dans l'organisation active. */
export const rolesEffectifs = (rolesOrganisationActive = [], rolesTousTenants = []) => [
  ...new Set([
    ...rolesOrganisationActive,
    ...rolesTousTenants.filter((role) => PLATFORM_ROLES.includes(role)),
  ]),
];

/**
 * Isolation tenant (CDC §3.4 / A.3, couche 4 du modèle d'autorisation).
 *
 * Le client ne fournit JAMAIS l'organizationId utilisé pour filtrer :
 * il peut seulement *choisir* une organisation à laquelle il appartient
 * (header `X-Organization-Id`). Le serveur vérifie l'appartenance.
 *
 * Tout service métier DOIT filtrer par `req.tenant.organizationId`.
 */
export const resolveTenant = (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());

  const { memberships } = req.user;
  if (!memberships?.length) {
    return next(ApiError.forbidden('Aucune organisation associée à ce compte'));
  }

  const requested = req.headers['x-organization-id'];

  let membership;
  if (requested) {
    membership = memberships.find((m) => m.organizationId === requested);
    if (!membership) {
      // 404 volontaire : on ne révèle pas l'existence d'une organisation tierce.
      return next(ApiError.notFound('Organisation introuvable'));
    }
  } else {
    // Par défaut : l'organisation individuelle du producteur (CDC D2),
    // sinon la première organisation active.
    membership =
      memberships.find((m) => m.organization.type === 'INDIVIDUAL') ?? memberships[0];
  }

  req.tenant = {
    organizationId: membership.organizationId,
    organization: membership.organization,
    roles: membership.roles,
    /**
     * H-03 — rôles effectifs = rôles de l'organisation active + rôles de
     * plateforme portés ailleurs. Les rôles métier d'une AUTRE organisation ne
     * s'appliquent jamais ici (isolation des rôles par tenant).
     */
    effectiveRoles: rolesEffectifs(membership.roles, req.user.roles),
  };

  next();
};

/**
 * Vérifie qu'une ressource appartient bien au tenant courant.
 * À appeler dans les services avec la ressource déjà chargée.
 * Renvoie une 404 (et non 403) pour ne pas confirmer son existence.
 */
export const assertOwnership = (resource, organizationId, label = 'Ressource') => {
  if (!resource || resource.deletedAt) throw ApiError.notFound(`${label} introuvable`);
  if (resource.organizationId !== organizationId) throw ApiError.notFound(`${label} introuvable`);
  return resource;
};
