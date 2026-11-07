#!/usr/bin/env node
/**
 * `npm run email:verifier-config` — vérifie la configuration e-mail **sans
 * envoyer de message**.
 *
 * ## Pourquoi cette commande existe
 *
 * Un e-mail de vérification qui ne part pas bloque l'inscription, et la cause
 * n'est presque jamais le code : c'est une clé absente, un domaine non vérifié
 * chez le fournisseur, ou une adresse expéditeur qui ne correspond à aucun
 * domaine autorisé. Sans cette commande, on le découvre quand un utilisateur
 * signale qu'il n'a rien reçu.
 *
 * Tout est en **lecture seule** : on interroge le fournisseur, on n'envoie rien.
 *
 * ## Aucune fuite de secret
 *
 * `EMAIL_API_KEY` n'est jamais imprimé, même tronqué. Seuls son état
 * (renseignée ou non) et les domaines renvoyés par le fournisseur apparaissent.
 */

import { env } from '../src/config/env.js';
import { verifierConfigEmail } from '../src/config/messagingConfig.js';

const COMPTE = '✓';
const CROIX = '✗';
const ATTENTION = '!';

/** Tronque une valeur sans en révéler le milieu. */
const tronquer = (valeur) => {
  const v = String(valeur ?? '');
  if (v.length <= 8) return '•••';
  return `${v.slice(0, 3)}…${v.slice(-3)}`;
};

const domaineDe = (adresse) => String(adresse ?? '').split('@')[1]?.toLowerCase() ?? '';

const lire = async (url, cle, timeoutMs) => {
  const reponse = await fetch(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${cle}`, accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const corps = await reponse.json().catch(() => ({}));
  return { ok: reponse.ok, statut: reponse.status, corps };
};

const main = async () => {
  const ligne = (s = '') => process.stdout.write(`${s}\n`);
  let blocages = 0;

  ligne('');
  ligne('  Vérification de la configuration e-mail');
  ligne('  ───────────────────────────────────────');
  ligne('');

  const rapport = verifierConfigEmail(env);
  ligne(`  Fournisseur        : ${env.EMAIL_PROVIDER}`);
  ligne(`  Expéditeur         : ${env.EMAIL_FROM}`);

  for (const erreur of rapport.erreurs) {
    ligne(`  ${CROIX} ${erreur}`);
    blocages += 1;
  }
  for (const avertissement of rapport.avertissements) ligne(`  ${ATTENTION} ${avertissement}`);

  if (env.EMAIL_PROVIDER === 'console') {
    ligne('');
    ligne(`  ${ATTENTION} EMAIL_PROVIDER vaut « console » : les e-mails sont écrits dans`);
    ligne('     les journaux du serveur, aucun message réel ne part. C’est normal en');
    ligne('     développement, insuffisant en production.');
    ligne('');
    process.exitCode = rapport.erreurs.length ? 1 : 0;
    return;
  }

  if (env.EMAIL_PROVIDER === 'webhook') {
    ligne('');
    ligne(`  ${COMPTE} Fournisseur générique : ${env.EMAIL_WEBHOOK_URL}`);
    ligne('     Aucune API de fournisseur à interroger : la passerelle est interne.');
    ligne('');
    process.exitCode = rapport.erreurs.length ? 1 : 0;
    return;
  }

  if (rapport.erreurs.length) {
    ligne('');
    ligne('  Arrêt : corrige les erreurs ci-dessus avant d’interroger le fournisseur.');
    ligne('');
    process.exit(1);
  }

  /* ── Interrogation du fournisseur, en lecture seule ───────────── */
  const estResend = env.EMAIL_PROVIDER === 'resend';
  const base = estResend ? env.RESEND_API_BASE_URL : env.SENDGRID_API_BASE_URL;
  const chemin = estResend ? '/domains' : '/v3/verified_senders';

  ligne('');
  ligne(`  Clé API            : ${tronquer(env.EMAIL_API_KEY)}`);
  ligne(`  API                : ${String(base).replace(/\/+$/, '')}`);
  ligne('');

  let reponse;
  try {
    reponse = await lire(`${String(base).replace(/\/+$/, '')}${chemin}`, env.EMAIL_API_KEY, env.EMAIL_REQUEST_TIMEOUT_MS);
  } catch (erreur) {
    ligne(`  ${CROIX} API injoignable : ${erreur.message}`);
    ligne('');
    process.exit(1);
  }

  if (!reponse.ok) {
    if (reponse.statut === 401 || reponse.statut === 403) {
      ligne(`  ${CROIX} Clé API REFUSÉE (HTTP ${reponse.statut})`);
      ligne(`     ${estResend ? 'Resend' : 'SendGrid'} n’accepte pas cette clé : révoquée,`);
      ligne('     ou clé d’un autre compte. Vérifie dans le tableau de bord du fournisseur.');
    } else {
      ligne(`  ${CROIX} Réponse inattendue : HTTP ${reponse.statut}`);
      ligne(`     ${JSON.stringify(reponse.corps).slice(0, 200)}`);
    }
    ligne('');
    process.exit(1);
  }

  ligne(`  ${COMPTE} Clé API acceptée`);

  /*
   * Le point décisif : le domaine de `EMAIL_FROM` doit être vérifié chez le
   * fournisseur. Sans cela, l'envoi est refusé (Resend 403) ou part en
   * indésirable — et l'utilisateur ne reçoit jamais son lien de vérification.
   */
  const domaineAttendu = domaineDe(env.EMAIL_FROM);
  if (estResend) {
    const domaines = (reponse.corps?.data ?? []).map((d) => ({
      nom: d.name,
      statut: d.status,
    }));
    if (domaines.length === 0) {
      ligne(`  ${CROIX} Aucun domaine chez Resend : tout envoi sera refusé en 403.`);
      ligne('     Ajoute et vérifie un domaine dans « Domains ».');
      blocages += 1;
    } else {
      ligne(`  ${COMPTE} Domaines (${domaines.length}) :`);
      for (const d of domaines.slice(0, 10)) {
        ligne(`     · ${d.nom} — ${d.statut}`);
      }
      const ok = domaines.some(
        (d) => d.nom === domaineAttendu && String(d.statut).toLowerCase() === 'verified',
      );
      if (!ok) {
        ligne(`  ${CROIX} Le domaine de EMAIL_FROM (${domaineAttendu}) n’est pas vérifié.`);
        ligne('     Tout envoi sera refusé en 403. Vérifie ce domaine, ou aligne EMAIL_FROM');
        ligne('     sur un domaine déjà vérifié.');
        blocages += 1;
      }
    }
  } else {
    const expediteurs = reponse.corps?.results ?? [];
    if (expediteurs.length === 0) {
      ligne(`  ${CROIX} Aucun expéditeur vérifié chez SendGrid.`);
      ligne('     Configure « Sender Authentication » (domaine ou expéditeur unique).');
      blocages += 1;
    } else {
      ligne(`  ${COMPTE} Expéditeurs vérifiés (${expediteurs.length}) :`);
      for (const e of expediteurs.slice(0, 10)) {
        ligne(`     · ${e.email ?? e.domain?.domain ?? '(inconnu)'}`);
      }
      const ok = expediteurs.some(
        (e) => (e.email ?? '').toLowerCase() === env.EMAIL_FROM.toLowerCase()
          || domaineDe(e.email) === domaineAttendu
          || (e.domain?.domain ?? '').toLowerCase() === domaineAttendu,
      );
      if (!ok) {
        ligne(`  ${CROIX} Aucun expéditeur vérifié ne correspond à ${env.EMAIL_FROM}.`);
        ligne('     L’envoi sera refusé ou classé indésirable. Aligne EMAIL_FROM sur un');
        ligne('     expéditeur vérifié.');
        blocages += 1;
      }
    }
  }

  ligne('');
  if (blocages > 0) {
    ligne(`  ${CROIX} ${blocages} problème(s) bloquant(s) : l’e-mail de vérification ne partira pas.`);
  } else {
    ligne('  Aucune faute bloquante détectée.');
  }
  ligne('  Cette commande n’a envoyé aucun e-mail : elle n’a fait que lire la configuration.');
  ligne('');
  process.exitCode = blocages > 0 ? 1 : 0;
};

main().catch((erreur) => {
  /*
   * Dernière ligne de défense. La pile n'est pas imprimée : elle pourrait
   * contenir une URL d'appel, et elle n'aiderait personne ici.
   */
  process.stdout.write(`\n  ${CROIX} Échec inattendu : ${erreur?.message ?? erreur}\n\n`);
  process.exit(1);
});
