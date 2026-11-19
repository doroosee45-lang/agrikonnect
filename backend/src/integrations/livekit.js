/**
 * Intégration LiveKit Cloud — transport de l'AUDIO uniquement.
 *
 * LiveKit n'est pas un backend métier : il ne décide de rien. PostgreSQL
 * (via `modules/calls`) décide qui peut appeler qui, et ce module ne fait que :
 *   1. signer des jetons d'accès COURTS, limités à UNE salle et au micro ;
 *   2. vérifier la signature des webhooks avec le mécanisme officiel du SDK ;
 *   3. créer / fermer une salle au mieux (best effort, jamais bloquant).
 *
 * Sécurité :
 *   - les secrets (`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`) ne quittent jamais
 *     le serveur et ne sont jamais journalisés ;
 *   - le transport est chiffré (TLS / DTLS-SRTP) mais ce n'est PAS un
 *     chiffrement de bout en bout : l'infrastructure LiveKit voit le flux ;
 *   - aucun enregistrement, aucune transcription : aucun droit `roomRecord`,
 *     aucun appel à l'API Egress.
 *
 * Pour les tests, `definirClientLiveKitPourTests()` remplace le service de
 * salles (aucun appel réseau vers LiveKit pendant les recettes).
 */
import { AccessToken, RoomServiceClient, TrackSource, WebhookReceiver } from 'livekit-server-sdk';

import { env } from '../config/env.js';
import { logger } from '../shared/http/logger.js';

/** Vrai si les trois réglages LiveKit sont présents (valeurs jamais exposées). */
export const liveKitConfigure = (cfg = env) =>
  Boolean(cfg.LIVEKIT_URL && cfg.LIVEKIT_API_KEY && cfg.LIVEKIT_API_SECRET);

/**
 * Droits d'un participant : rejoindre UNE salle, publier le MICRO seulement,
 * écouter. Tout le reste est explicitement refusé.
 * Fonction pure, testée (`tests/calls.test.mjs`).
 */
export const droitsAudioSeulement = (salle) => ({
  roomJoin: true,
  room: salle,
  canPublish: true,
  canPublishSources: [TrackSource.MICROPHONE],
  canSubscribe: true,
  canPublishData: false,
  canUpdateOwnMetadata: false,
  roomCreate: false,
  roomList: false,
  roomRecord: false,
  roomAdmin: false,
  ingressAdmin: false,
  hidden: false,
  recorder: false,
  agent: false,
});

/**
 * Jeton d'accès LiveKit pour (utilisateur, salle). L'identité est l'identifiant
 * Supabase VÉRIFIÉ par l'API ; le nom affiché vient de la base.
 */
export const creerJetonAudio = async ({ salle, identite, nom, dureeSecondes = env.CALL_TOKEN_TTL_SECONDS }) => {
  if (!liveKitConfigure()) throw new Error('LiveKit non configuré');
  const jeton = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: identite,
    name: nom ?? undefined,
    ttl: dureeSecondes,
  });
  jeton.addGrant(droitsAudioSeulement(salle));
  return jeton.toJwt();
};

/**
 * Vérification officielle d'un webhook LiveKit (`WebhookReceiver.receive`) :
 * signature JWT de l'en-tête `Authorization` + empreinte SHA-256 du corps BRUT.
 * Lève une erreur si la signature ou l'empreinte ne correspondent pas.
 */
export const verifierWebhook = async (corpsBrut, enteteAuthorization) => {
  if (!liveKitConfigure()) throw new Error('LiveKit non configuré');
  const recepteur = new WebhookReceiver(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
  return recepteur.receive(String(corpsBrut ?? ''), enteteAuthorization ?? undefined);
};

/* ─────────────────────── salles (best effort) ─────────────────────── */

let serviceSallesForce = null;

/** Seam de test : remplace le client de salles (aucun appel réseau). */
export const definirClientLiveKitPourTests = (client) => {
  serviceSallesForce = client;
};

const serviceSalles = () => {
  if (serviceSallesForce) return serviceSallesForce;
  if (!liveKitConfigure()) return null;
  return new RoomServiceClient(env.LIVEKIT_URL, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
};

/**
 * Crée la salle avec ses limites (participants max, fermeture si vide).
 * Échec non bloquant : LiveKit crée aussi la salle au premier participant.
 */
export const creerSalle = async ({ salle, participantsMax }) => {
  const client = serviceSalles();
  if (!client) return false;
  try {
    await client.createRoom({ name: salle, maxParticipants: participantsMax, emptyTimeout: 60, departureTimeout: 20 });
    return true;
  } catch (erreur) {
    logger.warn(`[livekit] création de salle non confirmée : ${erreur?.message ?? 'erreur inconnue'}`);
    return false;
  }
};

/** Ferme la salle (fin d'appel) : déconnecte les participants restants. */
export const fermerSalle = async (salle) => {
  const client = serviceSalles();
  if (!client) return false;
  try {
    await client.deleteRoom(salle);
    return true;
  } catch (erreur) {
    logger.warn(`[livekit] fermeture de salle non confirmée : ${erreur?.message ?? 'erreur inconnue'}`);
    return false;
  }
};

/** Adresse publique du serveur LiveKit (wss://…) à transmettre au client avec son jeton. */
export const urlLiveKit = () => env.LIVEKIT_URL ?? null;
