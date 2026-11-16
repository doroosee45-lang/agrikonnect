import { PermissionsAndroid, Platform } from 'react-native';

import { APP } from '@/lib/config';
import { secureStorage } from '@/lib/secure-storage';
import { ulid } from '@/lib/ulid';
import { api } from '@/services/api/http';
import { useI18nStore } from '@/i18n';

import { IOS_VOIP_PRET, appelsNatifsPossibles, chargerMessaging, chargerVoipPush } from './native';
import { jetonsAEnregistrer, type JetonsNatifs } from './pushPlan';

/**
 * Déclaration des jetons push de CET appareil (`/me/push-devices`).
 *
 * - L'identifiant d'installation est aléatoire, local, sans lien avec le
 *   matériel ; il permet au serveur de remplacer un jeton qui tourne.
 * - Le serveur rattache le jeton à l'utilisateur AUTHENTIFIÉ (jamais à un
 *   identifiant envoyé par l'appareil).
 * - À la déconnexion, les jetons de cette installation sont retirés.
 */
const CLE_INSTALLATION = 'ak.installation_id';

interface AppareilServeur {
  id: string;
  installationId: string;
}

async function identifiantInstallation(): Promise<string> {
  const existant = await secureStorage.get(CLE_INSTALLATION);
  if (existant) return existant;
  const nouveau = `ak-${ulid()}`;
  await secureStorage.set(CLE_INSTALLATION, nouveau);
  return nouveau;
}

async function autorisationNotifications(): Promise<boolean> {
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    const resultat = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as never);
    return resultat === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
}

async function jetonVoip(): Promise<string | null> {
  const voip = chargerVoipPush();
  if (!voip) return null;
  return new Promise((resolve) => {
    const delai = setTimeout(() => resolve(null), 10_000);
    voip.addEventListener('register', (jeton) => {
      clearTimeout(delai);
      resolve(jeton);
    });
    voip.registerVoipToken();
  });
}

/** Déclare (ou rafraîchit) les jetons de l'appareil. Sans effet si les appels natifs sont désactivés. */
export async function enregistrerCetAppareil(): Promise<number> {
  const firebase = chargerMessaging();
  if (!appelsNatifsPossibles() || !firebase) return 0;
  if (!(await autorisationNotifications())) return 0;

  const messaging = firebase.getMessaging();
  const statut = await firebase.requestPermission(messaging);
  if (Platform.OS === 'ios' && statut === firebase.AuthorizationStatus.DENIED) return 0;

  const jetons: JetonsNatifs = {};
  if (Platform.OS === 'android') jetons.fcm = await firebase.getToken(messaging).catch(() => null);
  if (Platform.OS === 'ios') {
    jetons.apns = await firebase.getAPNSToken(messaging).catch(() => null);
    jetons.voip = await jetonVoip();
  }

  const installationId = await identifiantInstallation();
  const locale = useI18nStore.getState().locale;
  let declares = 0;
  for (const { provider, token } of jetonsAEnregistrer(Platform.OS, jetons, { voipPret: IOS_VOIP_PRET })) {
    try {
      await api.post('/me/push-devices', { provider, token, installationId, appVersion: APP.version, locale });
      declares += 1;
    } catch {
      /* réessayé au prochain démarrage */
    }
  }
  return declares;
}

/** Retire les jetons de cette installation (à appeler AVANT la déconnexion). */
export async function retirerCetAppareil(): Promise<void> {
  if (!appelsNatifsPossibles()) return;
  try {
    const installationId = await secureStorage.get(CLE_INSTALLATION);
    if (!installationId) return;
    const { data } = await api.get<AppareilServeur[]>('/me/push-devices');
    await Promise.all(
      (data ?? [])
        .filter((appareil) => appareil.installationId === installationId)
        .map((appareil) => api.delete(`/me/push-devices/${encodeURIComponent(appareil.id)}`).catch(() => undefined)),
    );
    const firebase = chargerMessaging();
    if (firebase) await firebase.deleteToken(firebase.getMessaging()).catch(() => undefined);
  } catch {
    /* hors ligne : le serveur révoquera le jeton au premier échec d'envoi */
  }
}
