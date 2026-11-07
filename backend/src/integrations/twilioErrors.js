/**
 * Correspondance des codes d'erreur Twilio vers un message exploitable.
 *
 * ## Pourquoi ce module existe
 *
 * Twilio renvoie un code numérique et un message **en anglais** rédigé pour un
 * développeur qui connaît déjà la plateforme : « The 'To' number is not a valid
 * mobile number ». Stocké tel quel dans `sms_messages.error`, ce message
 * n'explique rien à l'exploitant qui constate qu'une alerte n'est pas partie, et
 * surtout pas **quoi faire**.
 *
 * Deux informations distinctes sont nécessaires et sont séparées ici :
 *
 * - `cause`  : ce qui s'est probablement passé ;
 * - `action` : ce qu'il faut faire.
 *
 * ## Pourquoi « rejouable » est porté par le code
 *
 * Un code de configuration (20003) ou un numéro fixe (21614) échoueraient de la
 * même manière à chaque tentative : rejouer coûte de l'argent et du temps pour
 * rien. À l'inverse, une défaillance d'opérateur (30005) peut passer à la
 * tentative suivante. Le drapeau `rejouable` permet à l'appelant de décider, au
 * lieu de rejouer aveuglément.
 */

/**
 * @typedef {object} ErreurTwilio
 * @property {string} code        Code Twilio, en chaîne.
 * @property {string} resume      Une phrase : ce qui est arrivé.
 * @property {string} cause       Cause probable, en français.
 * @property {string} action      Ce qu'il faut faire, en français.
 * @property {boolean} rejouable  Une nouvelle tentative peut-elle aboutir ?
 */

/** @type {Record<string, Omit<ErreurTwilio, 'code'>>} */
const TABLE = {
  /* ─── Authentification ───────────────────────────────────── */
  20003: {
    resume: 'Identifiants Twilio refusés.',
    cause:
      'Le couple `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` est invalide : jeton '
      + 'révoqué, jeton d’un autre compte, ou SID collé à la place du jeton.',
    action:
      'Vérifie les deux valeurs dans la console Twilio (« Account Info »), puis '
      + 'relance `npm run sms:verifier-config`. Aucune modification de code n’est nécessaire.',
    rejouable: false,
  },

  /* ─── Numéro destinataire ────────────────────────────────── */
  21211: {
    resume: 'Numéro destinataire invalide.',
    cause:
      'Le numéro n’est pas au format E.164 ou ne correspond à aucun plan de ' +
      'numérotation : indicatif pays manquant, espaces ou tirets conservés, ' +
      'ou numéro tronqué à la saisie.',
    action:
      'Corrige le numéro du profil au format international (+243 suivi du '
      + 'numéro, sans espace ni tiret) puis redemande une vérification.',
    rejouable: false,
  },
  21608: {
    resume: 'Numéro non vérifié sur un compte d’essai Twilio.',
    cause:
      'Le compte est un essai (Trial) : seuls les numéros ajoutés et vérifiés '
      + 'dans « Verified Caller IDs » peuvent recevoir un message.',
    action:
      'Ajoute le numéro dans la console Twilio (« Phone Numbers → Verified Caller '
      + 'IDs ») et valide le code reçu, ou passe sur un compte payant. '
      + '`npm run sms:verifier-config` affiche si le compte est un essai.',
    rejouable: false,
  },
  21614: {
    resume: 'Le numéro destinataire n’accepte pas les SMS.',
    cause:
      'C’est une ligne fixe. Twilio refuse l’envoi avant de le facturer, mais ' +
      'aucun SMS n’arrivera jamais sur ce numéro.',
    action:
      'Demande un numéro mobile. Ne pas réessayer : le résultat sera identique. '
      + 'L’e-mail reste utilisable pour ce contact.',
    rejouable: false,
  },

  /* ─── Canal et zone géographique ─────────────────────────── */
  21612: {
    resume: 'Le canal SMS n’est pas autorisé vers ce numéro.',
    cause:
      'L’opérateur du destinataire n’achemine pas les SMS depuis cet expéditeur, ' +
      'ou le canal SMS n’est pas activé sur ce numéro.',
    action:
      'Essaie un autre opérateur pour isoler la cause. Si tout un opérateur est '
      + 'concerné, contacte le support Twilio en précisant l’indicatif pays (RDC, +243).',
    rejouable: false,
  },
  63016: {
    resume: 'La destination est interdite par les permissions géographiques du compte.',
    cause:
      'Le compte Twilio n’autorise pas l’envoi vers ce pays. Par défaut, un '
      + 'compte n’ouvre que quelques destinations.',
    action:
      'Dans la console Twilio, « Messaging → Geographic Permissions » : active la '
      + 'République démocratique du Congo. C’est un réglage de compte, pas de code.',
    rejouable: false,
  },

  /* ─── Livraison ──────────────────────────────────────────── */
  30003: {
    resume: 'Le message a expiré sans être remis.',
    cause:
      'Le téléphone est resté injoignable au-delà de la fenêtre de validité '
      + '(téléphone éteint, hors couverture).',
    action:
      'Relance l’envoi plus tard. Pour une alerte agronomique, une relance le '
      + 'lendemain suffit : la recommandation ne se périme pas en une heure.',
    rejouable: true,
  },
  30005: {
    resume: 'Défaillance de l’opérateur destinataire.',
    cause:
      'L’opérateur n’a pas traité le message. C’est transitoire dans la majorité '
      + 'des cas.',
    action: 'Relance l’envoi. Si le même numéro échoue plusieurs fois, vérifie le numéro.',
    rejouable: true,
  },
  30006: {
    resume: 'Ligne fixe ou opérateur injoignable.',
    cause:
      'Le numéro est une ligne fixe, ou l’opérateur n’a pas pu être joint de '
      + 'manière durable.',
    action:
      'Vérifie qu’il s’agit bien d’un mobile. Ne pas relancer en boucle : si le '
      + 'numéro est fixe, le résultat ne changera pas.',
    rejouable: false,
  },
  30007: {
    resume: 'L’opérateur a bloqué le message.',
    cause:
      'Blocage au niveau de l’opérateur : contenu filtré, expéditeur non reconnu, '
      + 'ou numéro inscrit sur une liste d’opposition.',
    action:
      'Vérifie l’identifiant d’expéditeur (`TWILIO_SENDER_ID`) : un identifiant '
      + 'générique est plus souvent filtré. Simplifie le texte (un lien ou un '
      + 'caractère spécial peut déclencher le filtre).',
    rejouable: false,
  },
};

/**
 * Codes d'erreur supplémentaires, fréquents en RDC, sans correspondance
 * obligatoire : ils reçoivent un traitement générique mais **nommé**, plutôt
 * qu'un simple numéro.
 */
const CONNUS_SANS_DETAIL = new Set([
  '21408', // SMS non activé sur ce compte pour cette région
  '30004', // contenu refusé (opt-out)
  '30008', // erreur inconnue de l'opérateur
  '21617', // corps de message trop long
  '30018', // identifiant alphanumérique non pré-inscrit
  '30040', // identifiant alphanumérique non pris en charge
]);

/**
 * Décrit une erreur Twilio.
 *
 * @param {string|number} code Code renvoyé par Twilio.
 * @param {object} [options]
 * @param {string} [options.messageFournisseur] Message brut de Twilio, conservé
 *   en complément — jamais en remplacement de l'explication.
 * @returns {ErreurTwilio}
 */
export const decrireErreurTwilio = (code, { messageFournisseur = null } = {}) => {
  const cle = String(code ?? '').trim();
  const connu = TABLE[cle];
  if (connu) {
    return {
      code: cle,
      ...connu,
      ...(messageFournisseur ? { messageFournisseur } : {}),
    };
  }
  return {
    code: cle || 'inconnu',
    resume: CONNUS_SANS_DETAIL.has(cle)
      ? 'Envoi refusé par Twilio pour un motif connu mais non détaillé ici.'
      : 'Envoi refusé par le fournisseur.',
    cause: messageFournisseur
      ? `Motif transmis par Twilio : ${messageFournisseur}.`
      : 'Motif non précisé par le fournisseur.',
    action:
      'Consulte le code dans la documentation Twilio des erreurs de messagerie, '
      + 'puis vérifie le numéro et l’identifiant d’expéditeur.',
    rejouable: false,
    ...(messageFournisseur ? { messageFournisseur } : {}),
  };
};

/**
 * Message lisible en une seule ligne, destiné à `sms_messages.errorMessage`.
 *
 * Le format est volontairement stable (« code — résumé. Cause : … Action : … ») :
 * il est lu dans une interface d'administration étroite, et un saut de ligne y
 * casserait l'affichage.
 *
 * @param {string|number} code
 * @param {object} [options]
 * @returns {string}
 */
export const messageErreurTwilio = (code, options = {}) => {
  const e = decrireErreurTwilio(code, options);
  return `[${e.code}] ${e.resume} Cause : ${e.cause} Action : ${e.action}`;
};

/**
 * Une nouvelle tentative a-t-elle une chance d'aboutir ?
 *
 * Sert à `integrations/sms.js` pour ne pas rejouer trois fois un échec de
 * configuration : chaque tentative est facturée et ajoute du délai avant que
 * l'utilisateur voie le vrai motif.
 *
 * @param {string|number} code
 * @returns {boolean}
 */
export const erreurRejouable = (code) => decrireErreurTwilio(code).rejouable === true;

/** Codes pris en charge, pour les tests et la documentation. */
export const CODES_TWILIO_GERES = Object.freeze(Object.keys(TABLE));
