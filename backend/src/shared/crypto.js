/**
 * Exigences CDC couvertes : SEC-09.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Utilitaires cryptographiques.
 * ⚠️ Les mots de passe sont gérés par Supabase Auth (Argon2/bcrypt côté Supabase).
 *    Ici : OTP, jetons à usage unique, empreintes de fichiers.
 */

/** Code OTP numérique à 6 chiffres (crypto sûr). */
export const generateOtp = (digits = 6) => {
  const max = 10 ** digits;
  return String(randomInt(0, max)).padStart(digits, '0');
};

/** Jeton opaque URL-safe (reset de mot de passe, invitation, consentement). */
export const generateToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

/** Empreinte SHA-256 : on ne stocke jamais un OTP ou un jeton en clair. */
export const sha256 = (value) => createHash('sha256').update(String(value)).digest('hex');

/** Comparaison à temps constant (évite les attaques temporelles). */
export const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};

/** Clé de stockage pour un média/document (renommage, pas de nom utilisateur). */
export const storageKey = (...parts) =>
  parts
    .filter(Boolean)
    .map((p) => String(p).replace(/[^A-Za-z0-9._-]/g, '_'))
    .join('/');
