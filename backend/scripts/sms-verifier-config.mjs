#!/usr/bin/env node
/**
 * `npm run sms:verifier-config` — vérifie la configuration Twilio **sans envoyer
 * de SMS**.
 *
 * ## Pourquoi cette commande existe
 *
 * Avant elle, la seule façon de savoir si les identifiants étaient bons était
 * d'envoyer un SMS et d'observer l'échec. Cela coûte un envoi, demande un numéro
 * sous la main, et mélange deux questions distinctes : « ma configuration est-
 * elle bonne ? » et « cet opérateur achemine-t-il mon message ? ».
 *
 * Ici, tout est en **lecture seule** : on interroge le compte, on n'écrit rien.
 *
 * ## Ce qui est affiché
 *
 *  - validité des identifiants (sans jamais les montrer) ;
 *  - compte d'essai ou compte payant — décisif, car un compte d'essai ne joint
 *    que les numéros vérifiés ;
 *  - solde, si l'API le renvoie ;
 *  - numéros du compte (sur un compte d'essai, ce sont les seuls joignables) ;
 *  - URL de rappel configurée, et si elle est joignable depuis Internet.
 *
 * ## Aucune fuite de secret
 *
 * Ni `TWILIO_AUTH_TOKEN` ni `TWILIO_ACCOUNT_SID` n'apparaissent. Le SID est
 * tronqué (`AC0123…cdef`) : il n'est pas secret au sens strict, mais le
 * tronquer évite qu'une capture d'écran ne le diffuse. Le jeton n'est jamais
 * imprimé, même tronqué, même en cas d'erreur.
 */

import { env } from '../src/config/env.js';
import {
  verifierConfigSms,
} from '../src/config/messagingConfig.js';
import { isLocalUrl } from '../src/shared/senderId.js';
import { validateSenderId } from '../src/shared/senderId.js';

const COMPTE = '✓';

/*
 * Fautes **au niveau du compte Twilio** qui empêchent tout envoi vers la RDC.
 *
 * Elles ne se corrigent pas dans `.env`, mais une commande de vérification qui
 * rend 0 dans ce cas laisserait croire qu'un déploiement est prêt. Le code de
 * sortie doit refléter « est-ce que ça peut marcher ? », pas seulement « le
 * fichier .env est-il bien formé ? ».
 */
let blocagesCompte = 0;
const CROIX = '✗';
const ATTENTION = '!';

/** Tronque un identifiant long sans en révéler le milieu. */
const tronquer = (valeur) => {
  const v = String(valeur ?? '');
  if (v.length <= 8) return '•••';
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
};

/**
 * Appel GET authentifié vers l'API Twilio.
 *
 * @param {string} chemin  Chemin après `/2010-04-01`.
 * @param {object} cfg
 * @returns {Promise<{ok: boolean, statut: number, corps: object}>}
 */
const lire = async (chemin, cfg) => {
  const base = String(cfg.baseUrl).replace(/\/+$/, '');
  const url = `${base}/2010-04-01${chemin}`;
  const reponse = await fetch(url, {
    method: 'GET',
    headers: {
      authorization: `Basic ${cfg.authentification}`,
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(cfg.timeoutMs),
  });
  const corps = await reponse.json().catch(() => ({}));
  return { ok: reponse.ok, statut: reponse.status, corps };
};

const main = async () => {
  const ligne = (s = '') => process.stdout.write(`${s}\n`);

  ligne('');
  ligne('  Vérification de la configuration SMS');
  ligne('  ────────────────────────────────────');
  ligne('');

  /* ── 1. Configuration locale, avant tout appel réseau ─────────── */
  const rapport = verifierConfigSms(env);
  ligne(`  Fournisseur        : ${env.SMS_PROVIDER}`);
  ligne(`  Identifiant émet.  : ${env.TWILIO_SENDER_ID}`);

  const controleSender = validateSenderId(env.TWILIO_SENDER_ID);
  if (!controleSender.valid) {
    ligne(`  ${CROIX} TWILIO_SENDER_ID refusé : ${controleSender.reasons.join(' ; ')}`);
  } else {
    ligne(`  ${COMPTE} TWILIO_SENDER_ID conforme`);
  }

  for (const erreur of rapport.erreurs) ligne(`  ${CROIX} ${erreur}`);
  for (const avertissement of rapport.avertissements) ligne(`  ${ATTENTION} ${avertissement}`);

  if (env.SMS_PROVIDER !== 'twilio') {
    ligne('');
    ligne(`  ${ATTENTION} SMS_PROVIDER vaut « ${env.SMS_PROVIDER} » : aucun appel Twilio n'est`);
    ligne('     possible. Passe à SMS_PROVIDER=twilio pour tester un compte réel.');
    ligne('');
    process.exit(rapport.erreurs.length ? 1 : 0);
  }

  if (rapport.erreurs.length) {
    ligne('');
    ligne('  Arrêt : corrige les erreurs ci-dessus avant de tester le compte.');
    ligne('');
    process.exit(1);
  }

  /* ── 2. Lecture du compte (aucun envoi) ───────────────────────── */
  const cfg = {
    baseUrl: env.TWILIO_API_BASE_URL,
    authentification: Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64'),
    timeoutMs: env.TWILIO_REQUEST_TIMEOUT_MS,
  };

  ligne('');
  ligne(`  Compte interrogé   : ${tronquer(env.TWILIO_ACCOUNT_SID)}`);
  ligne(`  API                : ${cfg.baseUrl}`);
  ligne('');

  let compte;
  try {
    compte = await lire(`/Accounts/${env.TWILIO_ACCOUNT_SID}.json`, cfg);
  } catch (erreur) {
    /*
     * Le message de `fetch` peut contenir l'URL, jamais l'en-tête
     * d'authentification : il n'y a donc pas de secret à filtrer ici. On
     * n'affiche pas la pile, qui n'aiderait personne.
     */
    ligne(`  ${CROIX} API injoignable : ${erreur.message}`);
    ligne('     Vérifie la connexion et TWILIO_API_BASE_URL.');
    ligne('');
    process.exit(1);
  }

  if (!compte.ok) {
    const code = compte.corps?.code;
    if (compte.statut === 401 || code === 20003) {
      ligne(`  ${CROIX} Identifiants REFUSÉS (HTTP ${compte.statut}${code ? `, code ${code}` : ''})`);
      ligne('     TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN ne correspondent pas à un');
      ligne('     même compte, ou le jeton a été révoqué. Vérifie dans la console');
      ligne('     Twilio, sous « Account Info ».');
    } else if (compte.statut === 404) {
      ligne(`  ${CROIX} Compte introuvable (HTTP 404)`);
      ligne(`     Aucun compte ne correspond au SID ${tronquer(env.TWILIO_ACCOUNT_SID)}.`);
    } else {
      ligne(`  ${CROIX} Réponse inattendue : HTTP ${compte.statut}`);
      ligne(`     ${compte.corps?.message ?? 'Aucun message du fournisseur.'}`);
    }
    ligne('');
    process.exit(1);
  }

  const donnees = compte.corps;
  const estEssai = String(donnees.type ?? '').toLowerCase() === 'trial';

  ligne(`  ${COMPTE} Identifiants valides`);
  ligne(`     Compte           : ${donnees.friendly_name ?? '(sans nom)'}`);
  ligne(`     Type             : ${estEssai ? "ESSAI (Trial) — seuls les numéros vérifiés sont joignables" : 'payant (Full)'}`);
  ligne(`     État             : ${donnees.status ?? 'inconnu'}`);

  /*
   * Le solde n'est pas garanti par cette API : il a longtemps été absent du
   * ressource `Account`. On l'affiche s'il est là, et on dit franchement qu'il
   * ne l'est pas sinon — inventer un solde serait pire que de dire « inconnu ».
   */
  if (donnees.balance != null) {
    ligne(`     Solde            : ${donnees.balance} ${donnees.balance_currency ?? ''}`.trim());
  } else {
    ligne(`     Solde            : non renvoyé par cette API (voir la console Twilio)`);
  }

  /* ── 3. Numéros du compte ─────────────────────────────────────── */
  ligne('');
  try {
    const numeros = await lire(`/Accounts/${env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json`, cfg);
    if (numeros.ok) {
      const liste = numeros.corps?.incoming_phone_numbers ?? [];
      if (liste.length === 0) {
        ligne(`  ${ATTENTION} Aucun numéro sur ce compte.`);
        if (estEssai) {
          ligne('     Sur un compte d\'essai, ajoute et vérifie les numéros destinataires');
          ligne('     dans « Verified Caller IDs » : sans cela, tout envoi échoue en 21608.');
        }
      } else {
        ligne(`  ${COMPTE} Numéros du compte (${liste.length}) — seuls joignables en essai :`);
        for (const n of liste.slice(0, 10)) {
          ligne(`     · ${n.phone_number}${n.capabilities?.sms ? ' (SMS)' : ' (sans SMS)'}`);
        }
        if (liste.length > 10) ligne(`     … et ${liste.length - 10} autre(s)`);
      }
    } else {
      ligne(`  ${ATTENTION} Numéros illisibles : HTTP ${numeros.statut}`);
    }
  } catch (erreur) {
    ligne(`  ${ATTENTION} Numéros illisibles : ${erreur.message}`);
  }

  /* ── 4. Permissions géographiques ─────────────────────────────── */
  /*
   * La RDC doit être autorisée, sinon chaque envoi échoue en 63016 sans que la
   * cause soit évidente. C'est la faute de configuration la plus fréquente sur
   * un compte neuf.
   */
  ligne('');
  try {
    const zones = await lire(`/Accounts/${env.TWILIO_ACCOUNT_SID}/Messaging/Countries.json`, cfg);
    if (zones.ok) {
      const pays = zones.corps?.countries ?? [];
      const rdc = pays.find((p) => p.country === 'CD');
      if (!rdc) {
        ligne(`  ${CROIX} République démocratique du Congo ABSENTE des destinations autorisées.`);
        blocagesCompte += 1;
        ligne('     Tout envoi vers +243 échouera en 63016. Active-la dans la console :');
        ligne('     « Messaging → Geographic Permissions ».');
      } else if (rdc.allow === false) {
        ligne(`  ${CROIX} République démocratique du Congo présente mais DÉSACTIVÉE.`);
        blocagesCompte += 1;
        ligne('     Tout envoi vers +243 échouera en 63016. Active-la dans la console.');
      } else {
        ligne(`  ${COMPTE} République démocratique du Congo autorisée`);
      }
    } else {
      ligne(`  ${ATTENTION} Permissions géographiques illisibles : HTTP ${zones.statut}`);
    }
  } catch (erreur) {
    ligne(`  ${ATTENTION} Permissions géographiques illisibles : ${erreur.message}`);
  }

  /* ── 5. URL de rappel ─────────────────────────────────────────── */
  ligne('');
  const urlRappel = env.TWILIO_WEBHOOK_BASE_URL ?? env.TWILIO_STATUS_CALLBACK_URL;
  if (!urlRappel) {
    ligne(`  ${ATTENTION} Aucune URL de rappel configurée : les accusés de remise ne`);
    ligne('     seront jamais reçus, et les messages resteront à l\'état « envoyé ».');
  } else if (isLocalUrl(urlRappel)) {
    ligne(`  ${ATTENTION} URL de rappel locale : ${urlRappel}`);
    ligne('     Twilio ne peut pas l\'atteindre. Utilise un tunnel public');
    ligne('     (ngrok ou cloudflared) — voir docs/SMS-OTP-TEST-REEL.md.');
  } else {
    ligne(`  ${COMPTE} URL de rappel : ${urlRappel}`);
    ligne(`     À coller dans la console Twilio : ${urlRappel}/api/v1/webhooks/twilio/status`);
  }

  ligne('');
  if (blocagesCompte > 0) {
    ligne(`  ${CROIX} ${blocagesCompte} réglage(s) du compte Twilio empêchent l'envoi vers la RDC.`);
  } else {
    ligne('  Aucune faute bloquante détectée sur le compte.');
  }
  ligne('  Cette commande n\'a envoyé aucun SMS : elle n\'a fait que lire le compte.');
  ligne('');
  process.exitCode = blocagesCompte > 0 ? 1 : 0;
};

main().catch((erreur) => {
  /*
   * Dernière ligne de défense. On n'imprime pas la pile : elle pourrait
   * contenir une URL d'appel, et l'exploitant n'en tirerait rien.
   */
  process.stdout.write(`\n  ${CROIX} Échec inattendu : ${erreur?.message ?? erreur}\n\n`);
  process.exit(1);
});
