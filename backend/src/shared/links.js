/**
 * Liens web construits par le backend.
 *
 * ## Pourquoi ce module existe
 *
 * Trois URL étaient construites en dur dans les services, et **aucune** ne
 * correspondait à une route du client web :
 *
 * | Construit côté backend              | Route web réelle         | Résultat |
 * | ----------------------------------- | ------------------------ | -------- |
 * | `${PUBLIC_WEB_URL}/verify-email`    | `/auth/verify-email`     | 404      |
 * | `${PUBLIC_WEB_URL}/reset-password`  | `/auth/reset`            | 404      |
 * | `${PUBLIC_WEB_URL}/farm/:slug`      | `/public/farms/:slug`    | 404      |
 *
 * Le client web a une route attrape-tout (`path="*"` → `AppNotFound`), donc un
 * chemin faux ne produit **aucune erreur** : l'e-mail part, le lien s'ouvre,
 * et l'utilisateur arrive sur « page introuvable ». Le jeton de vérification
 * n'est alors saisi nulle part et la vérification d'adresse est impossible.
 *
 * Réunir les chemins ici ne suffit pas à empêcher la dérive — c'est le test
 * `tests/webLinks.test.mjs` qui le fait, en confrontant chaque chemin de cette
 * table aux `<Route path=…>` réellement déclarés dans `apps/web/src/App.tsx`.
 */
import { env } from '../config/env.js';

/**
 * Chemins web, sans préfixe d'origine.
 *
 * Doivent correspondre **exactement** à un `<Route path="…">` de
 * `apps/web/src/App.tsx`. Les segments dynamiques sont notés `:param`, comme
 * dans le routeur.
 */
export const CHEMINS_WEB = {
  /** Vérification d'adresse électronique (AUTH-03). */
  verifyEmail: '/auth/verify-email',
  /** Réinitialisation du mot de passe (AUTH-04). */
  resetPassword: '/auth/reset',
  /** Profil public d'une ferme, cible de l'URL canonique et du partage. */
  farmProfile: '/public/farms/:slug',
};

/**
 * Construit une URL absolue du client web.
 *
 * `PUBLIC_WEB_URL` ne doit **pas** porter de barre oblique finale : elle est
 * retirée si elle s'y trouve, pour que `${PUBLIC_WEB_URL}//auth/verify-email`
 * (double barre, refusée par certains clients de messagerie) soit impossible.
 *
 * @param {string} chemin — commence nécessairement par `/`.
 * @param {Record<string, string>} [params] — remplace les segments `:nom`.
 * @returns {string} URL absolue.
 */
export const lienWeb = (chemin, params = {}) => {
  const origine = String(env.PUBLIC_WEB_URL ?? '').replace(/\/+$/, '');
  const resolu = chemin.replace(/:([a-zA-Z]+)/g, (segment, nom) => {
    const valeur = params[nom];
    if (valeur === undefined || valeur === null || valeur === '') {
      // Un segment non résolu produirait un lien littéralement `/farms/:slug`.
      throw new Error(`lienWeb : paramètre « ${nom} » manquant pour « ${chemin} »`);
    }
    return encodeURIComponent(String(valeur));
  });
  return `${origine}${resolu}`;
};

/** URL de vérification d'adresse électronique. */
export const lienVerificationEmail = () => lienWeb(CHEMINS_WEB.verifyEmail);

/** URL de réinitialisation du mot de passe. */
export const lienMotDePasseOublie = () => lienWeb(CHEMINS_WEB.resetPassword);

/**
 * URL du profil public d'une ferme.
 *
 * Sert d'URL canonique, d'`og:url` et de lien de partage : un chemin faux ici
 * ne casse pas seulement un e-mail, il casse aussi le référencement.
 */
export const lienProfilFerme = (slug) => lienWeb(CHEMINS_WEB.farmProfile, { slug });
