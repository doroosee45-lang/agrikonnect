import { env } from '../config/env.js';
import { logger } from '../shared/http/logger.js';
import { hardware } from '../config/hardware.js';

/**
 * Abstraction fournisseur SMS (CDC D9 : éviter la dépendance à un agrégateur).
 * En développement, le provider "console" affiche le message dans les logs.
 * En production, brancher Twilio / Africa's Talking sans toucher au métier.
 */

/**
 * Masque un numéro pour les journaux.
 *
 * Un numéro de téléphone identifie une personne : il n'a pas sa place en clair
 * dans une trace. On garde l'indicatif et les deux derniers chiffres, ce qui
 * suffit à reconnaître un destinataire sans le révéler.
 */
const masquerNumero = (numero) => {
  const valeur = String(numero ?? '');
  if (valeur.length <= 6) return '•••';
  return `${valeur.slice(0, 4)}•••${valeur.slice(-2)}`;
};

const providers = {
  console: async (to, message) => {
    logger.info(`[SMS:console] → ${to} — ${message}`);
    return { provider: 'console', delivered: true };
  },

  /**
   * Twilio — envoi réel, derrière la même interface que les autres
   * fournisseurs : le code métier ne sait pas qui envoie.
   *
   * Le résultat porte `providerMessageId`, la clé de rapprochement avec
   * l'accusé de remise qui arrivera plus tard par webhook, ainsi que la
   * segmentation mesurée (un message Unicode coûte plus de segments).
   *
   * **`delivered` vaut `false` à la soumission.** Twilio renvoie `queued` :
   * c'est une acceptation, pas une remise. Affirmer la remise ici serait
   * mentir sur ce que l'on sait.
   */
  twilio: async (to, message) => {
    const { sendTwilioSms } = await import('./twilio.js');
    const { erreurRejouable } = await import('./twilioErrors.js');
    const senderId = env.TWILIO_SENDER_ID;

    try {
      return await sendTwilioSms({ to, body: message, from: senderId });
    } catch (erreur) {
      /*
       * Repli sur un numéro expéditeur — **uniquement** si
       * `TWILIO_FALLBACK_FROM` est explicitement renseigné.
       *
       * Sans cette variable, un refus de l'identifiant alphanumérique reste un
       * refus, et sa raison est journalisée. Aucune bascule silencieuse :
       * l'agriculteur reconnaît l'expéditeur de ses alertes, et en RDC les
       * identifiants **numériques ne sont pas remis par Airtel**. Changer
       * d'expéditeur à l'insu de l'exploitant transformerait un échec visible en
       * un message qui n'arrive pas sans raison apparente.
       *
       * Les codes concernés sont ceux qui portent sur l'expéditeur, pas sur le
       * destinataire : 30018 (non pré-inscrit) et 30040 (non pris en charge).
       * Un 21211 (numéro invalide) ou un 20003 (authentification) ne sera pas
       * réparé par un autre expéditeur, et rejouer coûterait pour rien.
       */
      const CODES_EXPEDITEUR = new Set(['30018', '30040']);
      const repli = String(env.TWILIO_FALLBACK_FROM ?? '').trim();
      const refusExpediteur = CODES_EXPEDITEUR.has(String(erreur.code ?? ''));

      if (refusExpediteur && !repli) {
        logger.warn(
          `[SMS:twilio] identifiant d'expéditeur « ${senderId} » refusé `
          + `(code ${erreur.code}) — aucun repli : TWILIO_FALLBACK_FROM n'est pas renseigné. `
          + "L'envoi échoue plutôt que de basculer sur un numéro expéditeur.",
        );
        throw erreur;
      }

      if (refusExpediteur && repli) {
        logger.warn(
          `[SMS:twilio] identifiant « ${senderId} » refusé (code ${erreur.code}) — `
          + `repli explicite sur TWILIO_FALLBACK_FROM (${masquerNumero(repli)})`,
        );
        return sendTwilioSms({ to, body: message, from: repli });
      }

      /*
       * Les autres codes sont **propagés avec leur code Twilio** : sans lui,
       * l'appelant ne peut pas distinguer un numéro invalide d'un compte mal
       * configuré, et `sms_messages.errorCode` resterait vide.
       */
      if (!erreurRejouable(String(erreur.code ?? ''))) erreur.rejouable = false;
      throw erreur;
    }
  },

  /**
   * Fournisseur générique par webhook : indispensable pour les agrégateurs
   * locaux (un par pays) et pour la recette, où l'on doit prouver la remise.
   */
  webhook: async (to, message) => {
    if (!env.SMS_WEBHOOK_URL) throw new Error('SMS_WEBHOOK_URL manquant pour le fournisseur webhook');
    const response = await fetch(env.SMS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to, message, sender: env.SMS_SENDER }),
      /**
       * Délai maximal lu dans le fichier de configuration matériel. `null` tant
       * que la passerelle n'est pas retenue : on ne fixe pas un délai inventé,
       * et le mode matériel `REAL` refuse de démarrer sans cette valeur.
       */
      ...(hardware.sms.requestTimeout.value === null
        ? {}
        : { signal: AbortSignal.timeout(hardware.sms.requestTimeout.value) }),
    });
    if (!response.ok) throw new Error(`Passerelle SMS : HTTP ${response.status}`);
    const receipt = await response.json().catch(() => ({}));
    return { provider: 'webhook', delivered: true, receipt };
  },

  africastalking: async (to, message) => {
    if (!env.SMS_API_KEY) throw new Error('SMS_API_KEY manquant pour Africa\'s Talking');
    logger.warn('[SMS:africastalking] Intégration à compléter (clé présente)');
    return { provider: 'africastalking', delivered: false, to, message };
  },
};

/**
 * Paramètres de fonctionnement du canal, pour observabilité et tests.
 *
 * Le **fournisseur actif** et les **secrets** restent dans l'environnement :
 * ce sont des choix de déploiement. Les limites (délais, tentatives) sont des
 * réglages du canal et viennent du fichier de configuration matériel.
 */
export const smsSettings = () => ({
  provider: env.SMS_PROVIDER,
  providerEnvVar: hardware.sms.providerEnvVar,
  availableProviders: hardware.sms.providers,
  maxAttempts: hardware.sms.maxAttempts,
  requestTimeoutMs: hardware.sms.requestTimeout.value,
  retryDelayMs: hardware.sms.retryDelay.value,
  /**
   * Identifiant d'expéditeur et garde-fous de coût, exposés pour
   * l'observabilité. **Aucun secret** : `TWILIO_AUTH_TOKEN` et
   * `TWILIO_ACCOUNT_SID` n'apparaissent pas ici, ni dans aucun journal.
   */
  senderId: env.TWILIO_SENDER_ID,
  dailyLimitPerFarmer: env.SMS_DAILY_LIMIT_PER_FARMER,
  dailyLimitPerOrganization: env.SMS_DAILY_LIMIT_PER_ORGANIZATION,
  /** Le fournisseur est-il réellement configuré, sans révéler la valeur. */
  twilioConfigured: Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN),
});

export const sendSms = async (to, message) => {
  const provider = providers[env.SMS_PROVIDER] ?? providers.console;
  const maxAttempts = hardware.sms.maxAttempts;
  const retryDelayMs = hardware.sms.retryDelay.value;

  const { erreurRejouable, messageErreurTwilio } = await import('./twilioErrors.js');

  let lastError = null;
  let attempts = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attempts = attempt;
    try {
      return await provider(to, message);
    } catch (error) {
      lastError = error;

      /*
       * Un échec **définitif** ne se rejoue pas.
       *
       * Rejouer trois fois un 20003 (identifiants refusés) ou un 21614 (ligne
       * fixe) donne exactement le même résultat, en ajoutant du délai avant que
       * l'utilisateur voie le vrai motif — et chaque soumission chez un
       * fournisseur peut être facturée. Seuls les codes transitoires (30003,
       * 30005) méritent une nouvelle tentative.
       */
      if (!erreurRejouable(String(error.code ?? '')) && error.code) {
        logger.warn(
          `[SMS] échec définitif (code ${error.code}) vers ${masquerNumero(to)} — aucune nouvelle tentative`,
        );
        break;
      }
      if (attempt === maxAttempts) break;
      logger.warn(
        `[SMS] tentative ${attempt}/${maxAttempts} échouée vers ${masquerNumero(to)} : ${error.message}`,
      );
      // Délai non confirmé tant que la passerelle n'est pas retenue : on rejoue
      // immédiatement plutôt que d'appliquer un délai inventé.
      if (retryDelayMs !== null) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  /*
   * Un échec d'envoi ne doit pas casser le parcours : le code reste réessayable
   * et l'erreur est tracée pour l'exploitation.
   *
   * **Le code Twilio est conservé** (`code`), et le message est traduit en
   * français exploitable. Sans `code`, `sms_messages.errorCode` resterait vide
   * et un 21211 (numéro invalide) serait indiscernable d'un 20003 (identifiants
   * refusés) : deux fautes qui n'appellent pas du tout la même correction.
   */
  const code = lastError?.code != null ? String(lastError.code) : null;
  logger.error(
    `[SMS] échec d'envoi vers ${masquerNumero(to)} après ${attempts} tentative(s) : ${lastError?.message}`,
  );
  return {
    provider: env.SMS_PROVIDER,
    delivered: false,
    attempts,
    code,
    error: code
      ? messageErreurTwilio(code, { messageFournisseur: lastError?.message ?? null })
      : lastError?.message ?? 'échec inconnu',
    rejouable: code ? erreurRejouable(code) : true,
  };
};

export const otpMessage = (code, minutes) =>
  `AGRIKONNECT : ton code de vérification est ${code}. Il expire dans ${minutes} min. Ne le partage avec personne.`;
