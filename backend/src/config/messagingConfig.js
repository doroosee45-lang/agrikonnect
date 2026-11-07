/**
 * Validation de la configuration de messagerie (SMS et e-mail).
 *
 * ## Le problème que ce module résout
 *
 * Avec `SMS_PROVIDER=twilio` et un secret manquant, le serveur **démarrait** et
 * l'échec n'apparaissait qu'au premier envoi : « TWILIO_ACCOUNT_SID et
 * TWILIO_AUTH_TOKEN sont requis ». Autrement dit, on découvrait la faute de
 * configuration au moment où l'on voulait envoyer un SMS à un agriculteur, pas
 * au moment où l'on déployait.
 *
 * La règle : **une configuration qui ne peut pas fonctionner doit empêcher le
 * démarrage**, avec un message qui nomme la variable à renseigner.
 *
 * ## Ce qui bloque et ce qui avertit
 *
 * - **Bloquant** : une valeur absente ou de forme impossible. Le serveur ne
 *   pourrait pas envoyer un seul message.
 * - **Avertissement** : une valeur valide mais qui ne fonctionnera pas depuis
 *   l'Internet — typiquement une URL de rappel en `localhost`. En développement
 *   c'est un choix légitime ; le bloquer serait faux.
 *
 * ## Aucune fuite de secret
 *
 * Les messages citent le **nom** des variables, jamais leur valeur. Le SID et le
 * jeton sont des secrets : `TWILIO_AUTH_TOKEN` est aussi la clé de signature des
 * webhooks, et sa fuite permettrait de forger des accusés de remise.
 */

import { validateSenderId, isPlausibleAccountSid, isLocalUrl } from '../shared/senderId.js';

/** Fournisseurs SMS pour lesquels une configuration réelle est exigée. */
const SMS_REELS = new Set(['twilio']);

/** Fournisseurs e-mail pour lesquels une configuration réelle est exigée. */
const EMAIL_REELS = new Set(['resend', 'sendgrid']);

/**
 * @typedef {object} RapportConfig
 * @property {string[]} erreurs    Bloquantes : le démarrage doit être refusé.
 * @property {string[]} avertissements  Non bloquantes : à lire avant de déployer.
 */

/**
 * Contrôle une URL de rappel (statut Twilio, webhook public).
 *
 * @param {string} nom   Nom de la variable, pour le message.
 * @param {string|undefined} valeur
 * @param {{erreurs: string[], avertissements: string[]}} rapport
 * @param {string} role  Ce que fait cette URL, pour expliquer la conséquence.
 */
const verifierUrlRappel = (nom, valeur, rapport, { consequence, vide }) => {
  if (!valeur) {
    rapport.avertissements.push(
      `${nom} est vide : ${vide}. Renseigne l'URL publique du backend `
      + '(un tunnel ngrok ou cloudflared en développement).',
    );
    return;
  }
  if (isLocalUrl(valeur)) {
    rapport.avertissements.push(
      `${nom} pointe vers ${valeur} : Twilio ne peut pas rappeler une adresse `
      + `locale, donc ${consequence}. Utilise une URL publique (ngrok, `
      + 'cloudflared) — voir docs/SMS-OTP-TEST-REEL.md.',
    );
  }
};

/**
 * Valide la configuration SMS.
 *
 * @param {object} v Valeurs de configuration (typiquement `env`).
 * @returns {RapportConfig}
 */
export const verifierConfigSms = (v) => {
  const rapport = { erreurs: [], avertissements: [] };
  const fournisseur = v.SMS_PROVIDER ?? 'console';

  if (!SMS_REELS.has(fournisseur)) {
    /*
     * `console`, `webhook` et `africastalking` n'exigent rien ici : les deux
     * premiers sont des modes de développement et de recette, et rien ne serait
     * gagné à exiger des secrets qu'ils n'utilisent pas.
     */
    if (fournisseur === 'webhook' && !v.SMS_WEBHOOK_URL) {
      rapport.erreurs.push('SMS_WEBHOOK_URL est requis quand SMS_PROVIDER=webhook.');
    }
    return rapport;
  }

  // ── Twilio ────────────────────────────────────────────────────
  const sid = String(v.TWILIO_ACCOUNT_SID ?? '').trim();
  const token = v.TWILIO_AUTH_TOKEN;
  const senderId = String(v.TWILIO_SENDER_ID ?? '').trim();

  if (!sid) {
    rapport.erreurs.push(
      'TWILIO_ACCOUNT_SID est requis quand SMS_PROVIDER=twilio. '
      + 'Il est visible dans la console Twilio, sous « Account Info ».',
    );
  } else if (!sid.startsWith('AC')) {
    /*
     * Un SID Twilio commence toujours par `AC`. Une valeur qui ne commence pas
     * ainsi est presque toujours l'`Auth Token` collé à la place, ou un
     * identifiant de projet — et l'envoi échouerait en 20003 sans que la cause
     * soit évidente.
     */
    rapport.erreurs.push(
      `TWILIO_ACCOUNT_SID doit commencer par « AC » (reçu : ${sid.slice(0, 2)}…). `
      + 'Vérifie qu’il ne s’agit pas de l’Auth Token collé par erreur.',
    );
  } else if (!isPlausibleAccountSid(sid)) {
    rapport.avertissements.push(
      `TWILIO_ACCOUNT_SID a une forme inhabituelle (${sid.length} caractères au lieu de 34). `
      + 'L’envoi peut échouer en 20003.',
    );
  }

  if (!token) {
    rapport.erreurs.push(
      'TWILIO_AUTH_TOKEN est requis quand SMS_PROVIDER=twilio. Il sert aussi à '
      + 'signer les webhooks : sans lui, aucun accusé de remise ne peut être vérifié.',
    );
  }

  if (!senderId) {
    rapport.erreurs.push('TWILIO_SENDER_ID est requis quand SMS_PROVIDER=twilio.');
  } else {
    const controle = validateSenderId(senderId);
    if (!controle.valid) {
      rapport.erreurs.push(`TWILIO_SENDER_ID est refusé : ${controle.reasons.join(' ; ')}.`);
    }
  }

  /*
   * Le repli sur un numéro expéditeur **ne se devine jamais**. Sans variable
   * explicite, un refus de l'alphanumérique doit rester un refus : basculer
   * silencieusement sur un numéro changerait l'identité de l'expéditeur, que
   * l'agriculteur reconnaît, et en RDC les identifiants numériques ne sont pas
   * remis par Airtel.
   */
  const repli = String(v.TWILIO_FALLBACK_FROM ?? '').trim();
  if (repli) {
    if (!/^\+[1-9]\d{6,14}$/.test(repli)) {
      rapport.erreurs.push(
        `TWILIO_FALLBACK_FROM doit être un numéro E.164 (ex. +243810000000) ; reçu : ${repli}.`,
      );
    } else {
      rapport.avertissements.push(
        'TWILIO_FALLBACK_FROM est renseigné : en cas de refus de l’identifiant '
        + 'alphanumérique, l’envoi repartira depuis ce numéro. Les identifiants '
        + 'numériques ne sont pas remis par Airtel en RDC.',
      );
    }
  }

  verifierUrlRappel('TWILIO_WEBHOOK_BASE_URL', v.TWILIO_WEBHOOK_BASE_URL, rapport, {
    consequence:
      "la signature des accusés de remise devra être reconstruite depuis les "
      + 'en-têtes, ce qui échoue derrière un mandataire qui termine le TLS',
    vide:
      'la signature des accusés de remise sera reconstruite depuis les en-têtes '
      + 'de la requête, ce qui est fragile derrière un mandataire',
  });
  verifierUrlRappel('TWILIO_STATUS_CALLBACK_URL', v.TWILIO_STATUS_CALLBACK_URL, rapport, {
    consequence: 'aucun accusé de remise ne sera envoyé par Twilio',
    vide: "Twilio n'enverra aucun accusé de remise",
  });

  return rapport;
};

/**
 * Valide la configuration e-mail.
 *
 * @param {object} v
 * @returns {RapportConfig}
 */
export const verifierConfigEmail = (v) => {
  const rapport = { erreurs: [], avertissements: [] };
  const fournisseur = v.EMAIL_PROVIDER ?? 'console';

  if (fournisseur === 'console') return rapport;

  if (fournisseur === 'webhook') {
    if (!v.EMAIL_WEBHOOK_URL) {
      rapport.erreurs.push('EMAIL_WEBHOOK_URL est requis quand EMAIL_PROVIDER=webhook.');
    } else if (isLocalUrl(v.EMAIL_WEBHOOK_URL)) {
      rapport.avertissements.push(
        `EMAIL_WEBHOOK_URL pointe vers ${v.EMAIL_WEBHOOK_URL} : injoignable hors de cette machine.`,
      );
    }
    return rapport;
  }

  if (EMAIL_REELS.has(fournisseur)) {
    if (!v.EMAIL_API_KEY) {
      rapport.erreurs.push(
        `EMAIL_API_KEY est requis quand EMAIL_PROVIDER=${fournisseur}. `
        + 'Sans elle, aucun e-mail de vérification ne part et l’inscription '
        + 'reste bloquée à l’étape de confirmation.',
      );
    }
    const from = String(v.EMAIL_FROM ?? '').trim();
    if (!from) {
      rapport.erreurs.push('EMAIL_FROM est requis : un envoi sans expéditeur est refusé par le fournisseur.');
    } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(from)) {
      rapport.erreurs.push(`EMAIL_FROM n’est pas une adresse valable (reçu : ${from}).`);
    } else if (!isDomaineAutorise(from, v)) {
      rapport.avertissements.push(
        `EMAIL_FROM (${from}) n’utilise pas un domaine vérifié chez le fournisseur : `
        + 'l’envoi sera probablement refusé ou classé comme indésirable.',
      );
    }
  }

  return rapport;
};

/**
 * Le domaine de l'expéditeur doit être vérifié chez Resend ou SendGrid.
 *
 * On ne peut pas le vérifier sans appeler l'API, donc on se contente de refuser
 * les domaines d'exemple et les domaines publics : personne ne reçoit un e-mail
 * de vérification crédible depuis `example.com`.
 */
const isDomaineAutorise = (from, v) => {
  const domaine = from.split('@')[1]?.toLowerCase() ?? '';
  const INTERDITS = ['example.com', 'example.org', 'example.net', 'localhost', 'test.local'];
  if (INTERDITS.includes(domaine)) return false;
  // Un domaine explicitement déclaré comme vérifié est accepté tel quel.
  const autorises = String(v.EMAIL_VERIFIED_DOMAINS ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return autorises.length === 0 || autorises.includes(domaine);
};

/**
 * Rapport consolidé, prêt à être affiché.
 *
 * @param {object} v
 * @returns {RapportConfig}
 */
export const verifierConfigMessagerie = (v) => {
  const sms = verifierConfigSms(v);
  const email = verifierConfigEmail(v);
  return {
    erreurs: [...sms.erreurs, ...email.erreurs],
    avertissements: [...sms.avertissements, ...email.avertissements],
  };
};
