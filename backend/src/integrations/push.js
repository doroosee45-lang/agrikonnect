/**
 * Notifications push — FCM (Android) et APNs (iOS : alertes + VoIP/PushKit).
 *
 * Bibliothèque standard uniquement (aucune dépendance) :
 *   - FCM API HTTP v1 : jeton d'accès OAuth 2.0 obtenu par assertion JWT RS256
 *     du compte de service (portée `firebase.messaging`), mis en cache ;
 *   - APNs : HTTP/2 (`node:http2`), jeton fournisseur JWT ES256 (clé .p8),
 *     renouvelé avant 60 min comme l'exige Apple.
 *
 * Règles d'envoi par genre (appliquées par `envoyerAuxAppareils`) :
 *   APPEL_ENTRANT  → Android : message DONNÉES priorité HAUTE, TTL = sonnerie
 *                    (l'application affiche l'écran d'appel plein écran) ;
 *                    iOS : push VoIP (`<bundle>.voip`) → l'application DOIT
 *                    signaler l'appel à CallKit (exigence Apple) ; repli en
 *                    alerte classique si l'installation n'a pas de jeton VoIP ;
 *   APPEL_TERMINE  → Android : données priorité haute (arrêter la sonnerie) ;
 *                    iOS : push « background » au mieux — JAMAIS de VoIP (un
 *                    push VoIP sans appel CallKit est interdit par Apple) ;
 *   NOTIFICATION   → Android : notification + données ; iOS : alerte.
 *
 * Désactivé par défaut : un fournisseur n'est utilisé que si PUSH_ENABLED=true
 * et que toutes ses variables sont présentes. Secrets jamais journalisés ;
 * jetons d'appareils masqués dans les journaux. Les jetons refusés
 * définitivement par le fournisseur sont RÉVOQUÉS en base.
 */
import crypto from 'node:crypto';
import http2 from 'node:http2';

import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { logger } from '../shared/http/logger.js';

/* ─────────────────────── configuration ─────────────────────── */

export const fcmConfigure = (cfg = env) =>
  cfg.PUSH_ENABLED === 'true' && Boolean(cfg.FCM_PROJECT_ID && cfg.FCM_CLIENT_EMAIL && cfg.FCM_PRIVATE_KEY);

export const apnsConfigure = (cfg = env) =>
  cfg.PUSH_ENABLED === 'true'
  && Boolean(cfg.APNS_TEAM_ID && cfg.APNS_KEY_ID && cfg.APNS_PRIVATE_KEY && cfg.APNS_BUNDLE_ID);

/** Clé PEM fournie sur une ligne (`\n` échappés) ou multi-lignes. */
const pem = (valeur) => String(valeur ?? '').replace(/\\n/g, '\n');
const b64url = (valeur) => Buffer.from(typeof valeur === 'string' ? valeur : JSON.stringify(valeur)).toString('base64url');

/** Jeton d'appareil masqué pour les journaux (jamais en clair). */
export const masquer = (jeton) => (jeton ? `…${String(jeton).slice(-6)}` : '∅');

/* ─────────────────────── jetons d'authentification (purs, testés) ─────────────────────── */

export const PORTEE_FCM = 'https://www.googleapis.com/auth/firebase.messaging';
export const URL_JETON_GOOGLE = 'https://oauth2.googleapis.com/token';

/** Assertion JWT RS256 du compte de service Google (échangée contre un jeton d'accès). */
export const assertionGoogle = ({ clientEmail, privateKey, maintenantSecondes = Math.floor(Date.now() / 1000) }) => {
  const entete = b64url({ alg: 'RS256', typ: 'JWT' });
  const charge = b64url({
    iss: clientEmail,
    scope: PORTEE_FCM,
    aud: URL_JETON_GOOGLE,
    iat: maintenantSecondes,
    exp: maintenantSecondes + 3600,
  });
  const signature = crypto.sign('RSA-SHA256', Buffer.from(`${entete}.${charge}`), pem(privateKey)).toString('base64url');
  return `${entete}.${charge}.${signature}`;
};

/** Jeton fournisseur APNs (JWT ES256, signature au format brut IEEE P1363). */
export const jetonFournisseurApns = ({ teamId, keyId, privateKey, maintenantSecondes = Math.floor(Date.now() / 1000) }) => {
  const entete = b64url({ alg: 'ES256', kid: keyId });
  const charge = b64url({ iss: teamId, iat: maintenantSecondes });
  const signature = crypto
    .sign('sha256', Buffer.from(`${entete}.${charge}`), { key: pem(privateKey), dsaEncoding: 'ieee-p1363' })
    .toString('base64url');
  return `${entete}.${charge}.${signature}`;
};

/* ─────────────────────── messages (purs, testés) ─────────────────────── */

/** FCM n'accepte que des valeurs CHAÎNES dans `data`. */
const donneesChaines = (donnees = {}) =>
  Object.fromEntries(
    Object.entries(donnees)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]),
  );

/**
 * Message FCM v1. `notification` absent = message de DONNÉES (traité par
 * l'application même fermée, indispensable à l'écran d'appel plein écran).
 */
export const messageFcm = ({ token, donnees, priorite = 'HIGH', ttlSecondes = 60, notification = null, collapseKey = null }) => ({
  message: {
    token,
    data: donneesChaines(donnees),
    ...(notification ? { notification: { title: notification.titre, body: notification.corps } } : {}),
    android: {
      priority: priorite,
      ttl: `${Math.max(0, Math.floor(ttlSecondes))}s`,
      ...(collapseKey ? { collapse_key: collapseKey } : {}),
    },
  },
});

/**
 * Requête APNs. `type` : `voip` (sujet `<bundle>.voip`, priorité 10),
 * `alert` (priorité 10) ou `background` (priorité 5, contenu disponible).
 */
export const requeteApns = ({ token, type, bundleId, donnees = {}, alerte = null, expirationSecondes = 60, collapseId = null, maintenantSecondes = Math.floor(Date.now() / 1000) }) => {
  const aps =
    type === 'alert' ? { alert: { title: alerte?.titre, body: alerte?.corps }, sound: 'default' }
      : type === 'background' ? { 'content-available': 1 }
        : undefined; // VoIP : charge libre, l'application la lit et signale l'appel à CallKit
  return {
    path: `/3/device/${token}`,
    headers: {
      'apns-push-type': type,
      'apns-topic': type === 'voip' ? `${bundleId}.voip` : bundleId,
      'apns-priority': type === 'background' ? '5' : '10',
      'apns-expiration': String(maintenantSecondes + Math.max(0, Math.floor(expirationSecondes))),
      ...(collapseId ? { 'apns-collapse-id': String(collapseId).slice(0, 64) } : {}),
    },
    body: { ...(aps ? { aps } : {}), ...donnees },
  };
};

/** Le fournisseur a-t-il définitivement refusé ce jeton ? (→ révocation) */
export const doitRevoquer = (fournisseur, statut, corps) => {
  if (fournisseur === 'FCM') {
    if (statut === 404) return true;
    const codes = (corps?.error?.details ?? []).map((d) => d?.errorCode);
    return codes.includes('UNREGISTERED');
  }
  if (statut === 410) return true;
  return statut === 400 && ['BadDeviceToken', 'DeviceTokenNotForTopic'].includes(corps?.reason);
};

/* ─────────────────────── transport (réel / test) ─────────────────────── */

const HOTES_APNS = { production: 'https://api.push.apple.com', sandbox: 'https://api.sandbox.push.apple.com' };

const transportReel = {
  oauth: async (assertion) => {
    const reponse = await fetch(URL_JETON_GOOGLE, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
      signal: AbortSignal.timeout(10_000),
    });
    return { status: reponse.status, body: await reponse.json().catch(() => ({})) };
  },
  fcm: async ({ projectId, accessToken, message }) => {
    const reponse = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10_000),
    });
    return { status: reponse.status, body: await reponse.json().catch(() => ({})) };
  },
  apns: ({ environnement, jetonFournisseur, requete }) =>
    new Promise((resolve, reject) => {
      const session = http2.connect(HOTES_APNS[environnement]);
      const fin = (resultat, erreur) => {
        session.close();
        if (erreur) reject(erreur);
        else resolve(resultat);
      };
      session.on('error', (erreur) => fin(null, erreur));
      const flux = session.request({
        ':method': 'POST',
        ':path': requete.path,
        authorization: `bearer ${jetonFournisseur}`,
        'content-type': 'application/json',
        ...requete.headers,
      });
      flux.setTimeout(10_000, () => flux.close(http2.constants.NGHTTP2_CANCEL));
      let statut = 0;
      let corps = '';
      flux.on('response', (entetes) => { statut = Number(entetes[':status']); });
      flux.setEncoding('utf8');
      flux.on('data', (morceau) => { corps += morceau; });
      flux.on('end', () => {
        let json = {};
        try { json = corps ? JSON.parse(corps) : {}; } catch { json = {}; }
        fin({ status: statut, body: json });
      });
      flux.on('error', (erreur) => fin(null, erreur));
      flux.end(JSON.stringify(requete.body));
    }),
};

let transport = transportReel;
/** Seam de test : remplace tout le transport (aucun appel réseau pendant les recettes). */
export const definirTransportPushPourTests = (faux) => {
  transport = faux ?? transportReel;
  cacheFcm = null;
  cacheApns = null;
};

let cacheFcm = null; // { jeton, expireA }
let cacheApns = null; // { jeton, emisA }

const jetonAccesFcm = async () => {
  if (cacheFcm && cacheFcm.expireA - 60_000 > Date.now()) return cacheFcm.jeton;
  const { status, body } = await transport.oauth(assertionGoogle({
    clientEmail: env.FCM_CLIENT_EMAIL,
    privateKey: env.FCM_PRIVATE_KEY,
  }));
  if (status !== 200 || !body?.access_token) throw new Error(`jeton OAuth FCM refusé (HTTP ${status})`);
  cacheFcm = { jeton: body.access_token, expireA: Date.now() + Number(body.expires_in ?? 3600) * 1000 };
  return cacheFcm.jeton;
};

const jetonApns = () => {
  // Apple : un jeton fournisseur vaut au plus 60 min ; on le renouvelle à 50 min.
  if (cacheApns && Date.now() - cacheApns.emisA < 50 * 60_000) return cacheApns.jeton;
  cacheApns = {
    jeton: jetonFournisseurApns({ teamId: env.APNS_TEAM_ID, keyId: env.APNS_KEY_ID, privateKey: env.APNS_PRIVATE_KEY }),
    emisA: Date.now(),
  };
  return cacheApns.jeton;
};

/* ─────────────────────── envoi ─────────────────────── */

export const GENRES = ['APPEL_ENTRANT', 'APPEL_TERMINE', 'NOTIFICATION'];

/** Plan d'envoi pour un appareil (pur, testé) : `null` = ne rien envoyer à cet appareil. */
export const planPourAppareil = (appareil, envoi, { installationsVoip = new Set() } = {}) => {
  const { genre } = envoi;
  if (appareil.provider === 'FCM') {
    return genre === 'NOTIFICATION' ? { canal: 'FCM', priorite: 'HIGH', notification: true } : { canal: 'FCM', priorite: 'HIGH', notification: false };
  }
  if (appareil.provider === 'APNS_VOIP') return genre === 'APPEL_ENTRANT' ? { canal: 'APNS', type: 'voip' } : null;
  // APNS classique
  if (genre === 'NOTIFICATION') return { canal: 'APNS', type: 'alert' };
  if (genre === 'APPEL_TERMINE') return { canal: 'APNS', type: 'background' };
  // APPEL_ENTRANT : repli en alerte seulement si l'installation n'a pas de jeton VoIP.
  return installationsVoip.has(appareil.installationId) ? null : { canal: 'APNS', type: 'alert' };
};

const envoyerA = async (appareil, plan, envoi) => {
  const ttl = envoi.ttlSecondes ?? 60;
  if (plan.canal === 'FCM') {
    if (!fcmConfigure()) return { ignore: 'FCM_NOT_CONFIGURED' };
    const message = messageFcm({
      token: appareil.token,
      donnees: { type: envoi.type ?? envoi.genre, genre: envoi.genre, ...envoi.donnees },
      priorite: plan.priorite,
      ttlSecondes: ttl,
      notification: plan.notification ? { titre: envoi.titre, corps: envoi.corps } : null,
      collapseKey: envoi.collapseId ?? null,
    });
    return transport.fcm({ projectId: env.FCM_PROJECT_ID, accessToken: await jetonAccesFcm(), message });
  }
  if (!apnsConfigure()) return { ignore: 'APNS_NOT_CONFIGURED' };
  const requete = requeteApns({
    token: appareil.token,
    type: plan.type,
    bundleId: env.APNS_BUNDLE_ID,
    donnees: { type: envoi.type ?? envoi.genre, genre: envoi.genre, ...envoi.donnees },
    alerte: { titre: envoi.titre, corps: envoi.corps },
    expirationSecondes: ttl,
    collapseId: envoi.collapseId ?? null,
  });
  return transport.apns({ environnement: env.APNS_ENVIRONMENT, jetonFournisseur: jetonApns(), requete });
};

/**
 * Envoie à tous les appareils actifs d'un utilisateur. Jamais bloquant : une
 * erreur fournisseur est journalisée (jeton masqué) et comptée, pas levée.
 *
 * @param {string} userId
 * @param {{ genre: 'APPEL_ENTRANT'|'APPEL_TERMINE'|'NOTIFICATION', type?: string, titre?: string, corps?: string,
 *           donnees?: object, ttlSecondes?: number, collapseId?: string }} envoi
 */
export const envoyerAuxAppareils = async (userId, envoi) => {
  const bilan = { sent: 0, failed: 0, revoked: 0, skipped: 0 };
  if (!fcmConfigure() && !apnsConfigure()) return { ...bilan, disabled: true };
  if (!GENRES.includes(envoi?.genre)) throw new Error(`genre de push inconnu : ${envoi?.genre}`);

  const appareils = await prisma.pushDevice.findMany({ where: { userId, revokedAt: null } });
  const installationsVoip = new Set(appareils.filter((a) => a.provider === 'APNS_VOIP').map((a) => a.installationId));

  for (const appareil of appareils) {
    const plan = planPourAppareil(appareil, envoi, { installationsVoip });
    if (!plan) { bilan.skipped += 1; continue; }
    try {
      // eslint-disable-next-line no-await-in-loop
      const reponse = await envoyerA(appareil, plan, envoi);
      if (reponse?.ignore) { bilan.skipped += 1; continue; }
      if (reponse.status >= 200 && reponse.status < 300) { bilan.sent += 1; continue; }
      bilan.failed += 1;
      if (doitRevoquer(appareil.provider, reponse.status, reponse.body)) {
        // eslint-disable-next-line no-await-in-loop
        await prisma.pushDevice.updateMany({
          where: { id: appareil.id, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: `provider_${reponse.status}` },
        });
        bilan.revoked += 1;
      }
      logger.warn(`[push] ${appareil.provider} ${masquer(appareil.token)} refusé (HTTP ${reponse.status})`);
    } catch (erreur) {
      bilan.failed += 1;
      logger.warn(`[push] ${appareil.provider} ${masquer(appareil.token)} : ${erreur?.message ?? 'erreur'}`);
    }
  }
  return bilan;
};

/** Contradiction signalée au démarrage : demandé mais aucun fournisseur complet. */
export const avertissementPush = (cfg = env) => {
  if (cfg.PUSH_ENABLED !== 'true') return null;
  if (!fcmConfigure(cfg) && !apnsConfigure(cfg)) {
    return 'PUSH_ENABLED=true mais ni FCM (FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY) ni APNs '
      + '(APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY, APNS_BUNDLE_ID) n\'est complet : aucun push ne partira.';
  }
  return null;
};
