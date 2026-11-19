import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Accès PROTÉGÉ aux modules natifs des appels (iOS / Android).
 *
 * Désactivé par défaut. Les modules ne sont chargés que si :
 * 1. le build a été produit avec `EXPO_PUBLIC_NATIVE_CALLS=true` (voir
 *    app.config.ts : c'est aussi ce drapeau qui ajoute les plugins natifs) ;
 * 2. l'application n'est PAS Expo Go (qui ne contient ni WebRTC, ni CallKit,
 *    ni Firebase) : il faut un build de développement EAS.
 * Sinon chaque fonction renvoie `null` et l'interface d'appel reste masquée.
 *
 * Les `require` sont volontairement paresseux : un `import` en tête de fichier
 * ferait planter Expo Go au démarrage.
 */
export const APPELS_NATIFS_DEMANDES = process.env.EXPO_PUBLIC_NATIVE_CALLS === 'true';

/**
 * Le raccord natif PushKit → CallKit (AppDelegate) est-il présent dans ce
 * build ? Tant qu'il ne l'est pas, aucun jeton VoIP n'est déclaré (pushPlan.ts).
 */
export const IOS_VOIP_PRET = process.env.EXPO_PUBLIC_IOS_VOIP_READY === 'true';

export function appelsNatifsPossibles(): boolean {
  if (!APPELS_NATIFS_DEMANDES) return false;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

type LiveKitClient = typeof import('livekit-client');
type LiveKitReactNative = typeof import('@livekit/react-native');
export type CallKeep = typeof import('react-native-callkeep').default;
type Messaging = typeof import('@react-native-firebase/messaging');
type VoipPush = typeof import('react-native-voip-push-notification').default;

function essayer<T>(charger: () => T): T | null {
  if (!appelsNatifsPossibles()) return null;
  try {
    return charger();
  } catch {
    return null;
  }
}

let globalesWebRtc = false;

/** SDK LiveKit + WebRTC natif (globales WebRTC enregistrées une seule fois). */
export function chargerLiveKit(): { client: LiveKitClient; rn: LiveKitReactNative } | null {
  return essayer(() => {
    const rn = require('@livekit/react-native') as LiveKitReactNative;
    if (!globalesWebRtc) {
      rn.registerGlobals();
      globalesWebRtc = true;
    }
    const client = require('livekit-client') as LiveKitClient;
    return { client, rn };
  });
}

export function chargerCallKeep(): CallKeep | null {
  return essayer(() => (require('react-native-callkeep') as { default: CallKeep }).default);
}

export function chargerMessaging(): Messaging | null {
  return essayer(() => require('@react-native-firebase/messaging') as Messaging);
}

export function chargerVoipPush(): VoipPush | null {
  if (Platform.OS !== 'ios' || !IOS_VOIP_PRET) return null;
  return essayer(() => (require('react-native-voip-push-notification') as { default: VoipPush }).default);
}
