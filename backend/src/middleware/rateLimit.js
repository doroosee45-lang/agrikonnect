/**
 * Exigences CDC couvertes : SEC-01.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * Corps d'erreur des limiteurs.
 *
 * `code` est exposé **au niveau racine**, comme le fait désormais
 * `errorHandler.js` : sans cela, une erreur de débit serait la seule du contrat
 * à ne porter son code que dans `errors[0].code`, et un client devrait connaître
 * deux emplacements. Le `code` dans `errors` est conservé — ajout, pas
 * remplacement.
 */
const errorBody = (code, message) => ({
  success: false,
  code,
  message,
  errors: [{ field: null, code }],
});

/** Limite globale sur l'API (SEC-01). */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isProd ? 300 : 10_000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: errorBody('RATE_LIMITED', 'Trop de requêtes, réessaie plus tard'),
});

/** Limite stricte : connexion, inscription, OTP, réinitialisation. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isProd ? 10 : 1_000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: errorBody('AUTH_RATE_LIMITED', 'Trop de tentatives, réessaie dans quelques minutes'),
});

/** Limite pour les écritures lourdes (uploads, imports). */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.isProd ? 30 : 1_000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: errorBody('WRITE_RATE_LIMITED', 'Trop d\'écritures, réessaie dans une minute'),
});

/**
 * Limite dédiée aux routes publiques non authentifiées (ex. fiche publique
 * d'un lot via QR code) : plus stricte, par IP.
 */
export const publicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isProd ? 60 : 2_000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: errorBody('PUBLIC_RATE_LIMITED', 'Trop de consultations, réessaie plus tard'),
});
