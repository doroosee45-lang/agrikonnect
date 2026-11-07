/**
 * Exigences CDC couvertes : SEC-03 · NFR-01 · SPEC-SUPER-ADMIN §2/§8.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { ApiError } from '../shared/errors/ApiError.js';
import { can } from '../shared/permissions.js';

/**
 * Couche 2 du modèle d'autorisation : permission requise (CDC A.2).
 * À utiliser après `authenticate` et, pour les routes privées, après `resolveTenant`.
 *
 *   router.post('/', authenticate, resolveTenant, authorize('farms.write'), handler)
 *
 * Plusieurs permissions peuvent être passées : elles sont alors **alternatives**
 * (une seule suffit) — utile pour les écrans de modération accessibles à
 * plusieurs équipes.
 */
export const authorize = (...permissions) => (req, _res, next) => {
  const roles = req.tenant?.effectiveRoles ?? req.user?.roles ?? [];
  const allowed = permissions.some((permission) => can(roles, permission));
  if (!allowed) {
    return next(ApiError.forbidden(`Permission requise : ${permissions.join(' ou ')}`));
  }
  next();
};

/** Restriction explicite à une liste de rôles (usage ponctuel). */
export const requireRole = (...roles) => (req, _res, next) => {
  const effective = req.tenant?.effectiveRoles ?? req.user?.roles ?? [];
  if (!effective.some((r) => roles.includes(r))) {
    return next(ApiError.forbidden('Tu n\'as pas les droits nécessaires pour cette action'));
  }
  next();
};

export const requireAdmin = requireRole('ADMIN', 'SUPER_ADMIN');

/**
 * NFR-01 / RG-S1 — second facteur actif requis.
 *
 * Toute mutation de gouvernance (palier 2) exige un compte doté d'une MFA
 * vérifiée : `profiles.mfaEnabled` est le miroir de `MfaSecret.confirmedAt`,
 * et la connexion impose déjà le code TOTP quand la MFA est active. Une session
 * authentifiée sur un profil `mfaEnabled` est donc une session à second facteur.
 *
 * Refus = 403 avec `details.mfaRequired` — le même contrat que
 * `mfa.service.js#assertMfa`, pour que les clients (web et mobile) affichent
 * le champ de code et l'action d'activation.
 */
export const requireMfa = (req, _res, next) => {
  const profile = req.user?.profile;
  if (!profile?.mfaEnabled) {
    return next(
      ApiError.forbidden(
        'Second facteur (MFA) requis pour cette action — active la double authentification depuis ton profil.',
        { mfaRequired: true, method: 'totp' },
      ),
    );
  }
  next();
};

/**
 * SPEC-SUPER-ADMIN §2.3 RG-G1 — garde Super Admin (palier 2).
 *
 * Deux contrôles cumulés, jamais un seul :
 *   1. le rôle `SUPER_ADMIN` figure parmi les rôles effectifs ;
 *   2. le compte dispose d'un second facteur actif (`requireMfa`).
 *
 * À placer sur les routes de gouvernance : nomination des administrateurs,
 * paramètres `security.*` / `integrations.*`, clés de service, feature flags,
 * maintenance. L'usage reste : `authenticate` AVANT cette garde.
 *
 *   router.post('/admin/users/:id/roles', authenticate, requireSuperAdmin, handler)
 */
export const requireSuperAdmin = (req, res, next) => {
  const roles = req.tenant?.effectiveRoles ?? req.user?.roles ?? [];
  if (!roles.includes('SUPER_ADMIN')) {
    return next(ApiError.forbidden('Réservé au Super Administrateur de la plateforme'));
  }
  return requireMfa(req, res, next);
};







// /**
//  * Exigences CDC couvertes : SEC-03 · NFR-01 · SPEC-SUPER-ADMIN §2/§8.
//  *
//  * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
//  * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
//  */
// import { ApiError } from '../shared/errors/ApiError.js';
// import { can } from '../shared/permissions.js';

// /**
//  * Couche 2 du modèle d'autorisation : permission requise (CDC A.2).
//  * À utiliser après `authenticate` et, pour les routes privées, après `resolveTenant`.
//  *
//  *   router.post('/', authenticate, resolveTenant, authorize('farms.write'), handler)
//  *
//  * Plusieurs permissions peuvent être passées : elles sont alors **alternatives**
//  * (une seule suffit) — utile pour les écrans de modération accessibles à
//  * plusieurs équipes.
//  */
// export const authorize = (...permissions) => (req, _res, next) => {
//   const roles = req.tenant?.effectiveRoles ?? req.user?.roles ?? [];
//   const allowed = permissions.some((permission) => can(roles, permission));
//   if (!allowed) {
//     return next(ApiError.forbidden(`Permission requise : ${permissions.join(' ou ')}`));
//   }
//   next();
// };

// /** Restriction explicite à une liste de rôles (usage ponctuel). */
// export const requireRole = (...roles) => (req, _res, next) => {
//   const effective = req.tenant?.effectiveRoles ?? req.user?.roles ?? [];
//   if (!effective.some((r) => roles.includes(r))) {
//     return next(ApiError.forbidden('Tu n\'as pas les droits nécessaires pour cette action'));
//   }
//   next();
// };

// export const requireAdmin = requireRole('ADMIN', 'SUPER_ADMIN');

// /**
//  * NFR-01 / RG-S1 — second facteur actif requis.
//  *
//  * Toute mutation de gouvernance (palier 2) exige un compte doté d'une MFA
//  * vérifiée : `profiles.mfaEnabled` est le miroir de `MfaSecret.confirmedAt`,
//  * et la connexion impose déjà le code TOTP quand la MFA est active. Une session
//  * authentifiée sur un profil `mfaEnabled` est donc une session à second facteur.
//  *
//  * Refus = 403 avec `details.mfaRequired` — le même contrat que
//  * `mfa.service.js#assertMfa`, pour que les clients (web et mobile) affichent
//  * le champ de code et l'action d'activation.
//  */
// export const requireMfa = (req, _res, next) => {
//   const profile = req.user?.profile;
//   if (!profile?.mfaEnabled) {
//     return next(
//       ApiError.forbidden(
//         'Second facteur (MFA) requis pour cette action — active la double authentification depuis ton profil.',
//         { mfaRequired: true, method: 'totp' },
//       ),
//     );
//   }
//   next();
// };

// /**
//  * SPEC-SUPER-ADMIN §2.3 RG-G1 — garde Super Admin (palier 2).
//  *
//  * Deux contrôles cumulés, jamais un seul :
//  *   1. le rôle `SUPER_ADMIN` figure parmi les rôles effectifs ;
//  *   2. le compte dispose d'un second facteur actif (`requireMfa`).
//  *
//  * À placer sur les routes de gouvernance : nomination des administrateurs,
//  * paramètres `security.*` / `integrations.*`, clés de service, feature flags,
//  * maintenance. L'usage reste : `authenticate` AVANT cette garde.
//  *
//  *   router.post('/admin/users/:id/roles', authenticate, requireSuperAdmin, handler)
//  */
// export const requireSuperAdmin = (req, res, next) => {
//   const roles = req.tenant?.effectiveRoles ?? req.user?.roles ?? [];
//   if (!roles.includes('SUPER_ADMIN')) {
//     return next(ApiError.forbidden('Réservé au Super Administrateur de la plateforme'));
//   }
//   return requireMfa(req, res, next);
// };