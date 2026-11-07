/**
 * Validation de l'identifiant d'expéditeur SMS.
 *
 * ## Pourquoi ce fichier existe séparément
 *
 * La règle vivait dans `integrations/twilio.js`. Or la **validation de
 * configuration au démarrage** doit la réutiliser pour refuser de démarrer avec
 * un identifiant non conforme — et `integrations/twilio.js` importe `config/env.js`,
 * qui est précisément le module qui déclenche la validation. L'import aurait été
 * circulaire.
 *
 * Ce module n'importe donc **rien** : il est pur, testable seul, et `twilio.js`
 * le ré-exporte pour ne casser aucun appelant existant.
 *
 * ## Règles, et d'où elles viennent
 *
 * Contraintes Twilio sur l'identifiant alphanumérique : 11 caractères au plus,
 * ASCII, chiffres et espaces, **au moins une lettre** — jamais de chiffres
 * seuls. À cela s'ajoute une spécificité RDC : les identifiants **numériques ne
 * sont pas remis par le réseau Airtel**, et les identifiants génériques
 * (`InfoSMS`, `Verify`…) y sont déconseillés parce que susceptibles d'être
 * bloqués.
 */

/** Identifiants génériques déconseillés en RDC. */
const GENERIQUES = ['infosisms', 'infosms', 'info', 'verify', 'notify', 'alert', 'sms'];

/**
 * @param {string} senderId
 * @returns {{ valid: boolean, reasons: string[] }}
 */
export const validateSenderId = (senderId) => {
  const reasons = [];
  const value = String(senderId ?? '').trim();

  if (value.length === 0) reasons.push('identifiant d’expéditeur absent');
  if (value.length > 11) {
    reasons.push(`identifiant trop long (${value.length} caractères, 11 au plus)`);
  }
  if (value && !/[A-Za-z]/.test(value)) {
    reasons.push('un identifiant uniquement numérique est refusé (et non remis par Airtel en RDC)');
  }
  if (value && /[^A-Za-z0-9 +\-_&]/.test(value)) {
    reasons.push('caractères non autorisés : lettres ASCII, chiffres, espaces, + - _ & uniquement');
  }
  if (GENERIQUES.includes(value.toLowerCase())) {
    reasons.push('identifiant générique : Twilio recommande de l’éviter en RDC, il risque d’être bloqué');
  }

  return { valid: reasons.length === 0, reasons };
};

/**
 * Valide un **expéditeur** Twilio, quelle que soit sa forme.
 *
 * Le champ `From` de l'API Twilio accepte deux choses différentes :
 *
 *  - un **identifiant alphanumérique** (`AGRIKONNECT`) — c'est le réglage normal
 *    en RDC, où il est préservé par les opérateurs ;
 *  - un **numéro E.164** (`+243810000777`) — un numéro acheté chez Twilio, ou le
 *    repli volontaire de `TWILIO_FALLBACK_FROM`.
 *
 * Les soumettre au même contrôle était une faute : `validateSenderId` refuse un
 * identifiant purement numérique, donc un numéro de repli était **toujours**
 * rejeté avant même l'appel réseau. La variable `TWILIO_FALLBACK_FROM` ne pouvait
 * donc pas fonctionner. Les deux formes sont maintenant distinguées, chacune
 * validée selon ses propres règles.
 *
 * @param {string} expediteur
 * @returns {{ valid: boolean, reasons: string[], type: 'ALPHANUMERIQUE'|'NUMERO'|'VIDE' }}
 */
export const validateExpediteur = (expediteur) => {
  const valeur = String(expediteur ?? '').trim();
  if (!valeur) return { valid: false, reasons: ['expéditeur absent'], type: 'VIDE' };

  // Un `+` initial n'a de sens que pour un numéro E.164.
  if (valeur.startsWith('+')) {
    return /^\+[1-9]\d{6,14}$/.test(valeur)
      ? { valid: true, reasons: [], type: 'NUMERO' }
      : {
          valid: false,
          reasons: ['numéro expéditeur invalide : format E.164 attendu (ex. +243810000000)'],
          type: 'NUMERO',
        };
  }

  const controle = validateSenderId(valeur);
  return { ...controle, type: 'ALPHANUMERIQUE' };
};

/**
 * Un `AccountSid` Twilio commence toujours par `AC` et fait 34 caractères.
 *
 * Le contrôle porte sur le préfixe, pas sur la longueur exacte : refuser un
 * compte valide parce qu'un caractère manque dans une constante serait pire que
 * laisser passer un SID douteux.
 *
 * @param {string} sid
 * @returns {boolean}
 */
export const isPlausibleAccountSid = (sid) => /^AC[a-f0-9]{32}$/i.test(String(sid ?? '').trim());

/**
 * Une URL est-elle injoignable depuis l'Internet ?
 *
 * Sert à **avertir** — pas à bloquer — quand une URL de rappel pointe vers la
 * machine locale : Twilio ne peut pas rappeler `localhost`, donc aucun accusé de
 * remise n'arrivera jamais. Le blocage serait faux : en développement, c'est un
 * choix légitime.
 *
 * @param {string} url
 * @returns {boolean}
 */
export const isLocalUrl = (url) => {
  try {
    const { hostname } = new URL(String(url));
    return (
      hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '::1'
      || hostname === '[::1]'
      || hostname.endsWith('.localhost')
      || /^192\.168\./.test(hostname)
      || /^10\./.test(hostname)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    );
  } catch {
    // Une URL invalide est déjà refusée par le schéma Zod : ce n'est pas ici
    // qu'il faut la signaler une seconde fois.
    return false;
  }
};
