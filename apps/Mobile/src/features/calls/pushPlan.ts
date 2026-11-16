/**
 * Appels — logique PURE côté mobile (testée par `npm test`, sans module natif).
 *
 * Aucun import d'exécution ici : ce fichier doit rester chargeable par
 * `node --test` (suppression des types) comme par Metro.
 */

export type FournisseurPush = 'FCM' | 'APNS' | 'APNS_VOIP';

export interface JetonsNatifs {
  fcm?: string | null;
  apns?: string | null;
  voip?: string | null;
}

/** Bornes acceptées par `POST /me/push-devices` (backend). */
const JETON_MIN = 32;
const JETON_MAX = 4096;
const jetonValide = (jeton: string | null | undefined): jeton is string =>
  typeof jeton === 'string' && jeton.length >= JETON_MIN && jeton.length <= JETON_MAX;

/**
 * Jetons à déclarer au serveur pour CET appareil.
 *
 * - Android : FCM (messages « data » prioritaires → écran d'appel natif).
 * - iOS : APNs (alerte) toujours ; APNs VoIP UNIQUEMENT si le raccord natif
 *   PushKit → CallKit est présent dans le build (`voipPret`). Sans lui, iOS
 *   termine l'application à chaque push VoIP non signalé à CallKit puis cesse
 *   de les livrer : mieux vaut alors le repli « alerte » prévu par le serveur.
 */
export function jetonsAEnregistrer(
  plateforme: string,
  jetons: JetonsNatifs,
  options: { voipPret: boolean },
): Array<{ provider: FournisseurPush; token: string }> {
  const sortie: Array<{ provider: FournisseurPush; token: string }> = [];
  if (plateforme === 'android') {
    if (jetonValide(jetons.fcm)) sortie.push({ provider: 'FCM', token: jetons.fcm });
  } else if (plateforme === 'ios') {
    if (jetonValide(jetons.apns)) sortie.push({ provider: 'APNS', token: jetons.apns });
    if (options.voipPret && jetonValide(jetons.voip)) sortie.push({ provider: 'APNS_VOIP', token: jetons.voip });
  }
  return sortie;
}

export interface InvitationPush {
  callId: string;
  conversationId: string | null;
  callerName: string | null;
  ringExpiresAt: string | null;
}

/**
 * Lit une invitation d'appel dans les données d'un push (FCM `data` ou charge
 * APNs). Renvoie `null` si ce n'est pas une invitation ou si elle a expiré :
 * on n'affiche jamais d'écran d'appel pour une sonnerie déjà terminée.
 */
export function lireInvitation(donnees: unknown, maintenant: number = Date.now()): InvitationPush | null {
  if (!donnees || typeof donnees !== 'object') return null;
  const d = donnees as Record<string, unknown>;
  if (d.genre !== 'APPEL_ENTRANT' || typeof d.callId !== 'string' || d.callId.length < 10 || d.callId.length > 60) return null;
  const expire = typeof d.ringExpiresAt === 'string' ? Date.parse(d.ringExpiresAt) : NaN;
  if (Number.isFinite(expire) && expire <= maintenant) return null;
  return {
    callId: d.callId,
    conversationId: typeof d.conversationId === 'string' ? d.conversationId : null,
    callerName: typeof d.callerName === 'string' && d.callerName.trim() ? d.callerName.trim().slice(0, 80) : null,
    ringExpiresAt: typeof d.ringExpiresAt === 'string' ? d.ringExpiresAt : null,
  };
}

/** Fin de sonnerie annoncée par push (`APPEL_TERMINE`) : identifiant de l'appel, sinon null. */
export function lireFinAppel(donnees: unknown): string | null {
  if (!donnees || typeof donnees !== 'object') return null;
  const d = donnees as Record<string, unknown>;
  return d.genre === 'APPEL_TERMINE' && typeof d.callId === 'string' ? d.callId : null;
}

/**
 * UUID stable dérivé de l'identifiant d'appel (CallKit / ConnectionService
 * exigent un UUID). Déterministe : le même appel donne le même UUID dans le
 * processus de fond comme dans l'application, sans stockage partagé.
 */
export function uuidDepuisAppel(callId: string): string {
  const fnv = (graine: number) => {
    let h = (0x811c9dc5 ^ graine) >>> 0;
    for (let i = 0; i < callId.length; i += 1) {
      h ^= callId.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  };
  const hex = (fnv(1) + fnv(2) + fnv(3) + fnv(4)).split('');
  hex[12] = '4'; // version 4
  hex[16] = ['8', '9', 'a', 'b'][parseInt(hex[16], 16) % 4]; // variante RFC 4122
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}
