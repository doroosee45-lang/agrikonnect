/**
 * Contrôle de `PUBLIC_WEB_URL` — l'origine du site web.
 *
 * Cette valeur devient l'adresse de retour des e-mails d'authentification
 * (`emailRedirectTo` / `redirectTo` transmis à Supabase Auth : vérification
 * d'adresse, mot de passe oublié) et des liens publics (QR codes, partage).
 *
 * Sa valeur par défaut, `http://localhost:5173`, est faite pour le poste de
 * développement. Oubliée en production, elle envoie chaque utilisateur vers
 * `localhost` en cliquant sur son lien de confirmation, sans aucune erreur
 * côté serveur. D'où ce contrôle : **en production, le démarrage est refusé**
 * plutôt que d'émettre un seul lien inutilisable.
 *
 * Fonction pure : testable sans modifier l'environnement du processus.
 * Les messages citent le nom de la variable et la valeur fautive — ce n'est
 * pas un secret (c'est l'adresse publique du site).
 */

const HOTES_LOCAUX = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1']);

/**
 * @param {{ NODE_ENV?: string, PUBLIC_WEB_URL?: string }} cfg
 * @returns {{ erreurs: string[] }}
 */
export const verifierUrlWebPublique = (cfg) => {
  const erreurs = [];
  if (cfg.NODE_ENV !== 'production') return { erreurs };

  const brute = String(cfg.PUBLIC_WEB_URL ?? '').trim();
  let url;
  try {
    url = new URL(brute);
  } catch {
    erreurs.push(`PUBLIC_WEB_URL n'est pas une URL valide (« ${brute} »).`);
    return { erreurs };
  }

  if (HOTES_LOCAUX.has(url.hostname)) {
    erreurs.push(
      `PUBLIC_WEB_URL pointe vers « ${url.hostname} » : les liens de vérification `
      + "d'e-mail et de mot de passe oublié enverraient les utilisateurs sur leur propre machine. "
      + "Renseigne l'adresse publique du site (ex. https://agrikonnectweb.onrender.com).",
    );
  }
  if (url.protocol !== 'https:') {
    erreurs.push(`PUBLIC_WEB_URL doit être en https en production (reçu « ${url.protocol}// »).`);
  }
  if ((url.pathname && url.pathname !== '/') || url.search || url.hash) {
    erreurs.push(
      `PUBLIC_WEB_URL doit être une origine seule, sans chemin ni paramètre (reçu « ${brute} »).`,
    );
  }
  return { erreurs };
};
