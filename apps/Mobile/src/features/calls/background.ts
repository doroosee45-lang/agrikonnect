import { Platform } from 'react-native';

import { appelsNatifsPossibles, chargerMessaging } from './native';
import { lireFinAppel, lireInvitation } from './pushPlan';
import { afficherAppelEntrant, configurerAppelSysteme, retirerAppelSysteme } from './systemCall';

/**
 * Réception des push d'appel quand l'application est en arrière-plan ou
 * FERMÉE (Android). Doit être enregistré au tout début du bundle, avant
 * l'application React : c'est fait dans `index.js`.
 *
 * Android : le serveur envoie un message FCM « data » prioritaire ; ce
 * gestionnaire s'exécute en tâche de fond et affiche l'écran d'appel natif.
 *
 * iOS : la sonnerie application fermée passe par PushKit (VoIP) et DOIT être
 * signalée à CallKit en code natif (AppDelegate) — voir
 * backend/docs/APPELS_AUDIO.md §8.3. Rien n'est fait ici pour iOS.
 */
export function enregistrerReceptionEnArrierePlan(): void {
  if (Platform.OS !== 'android' || !appelsNatifsPossibles()) return;
  const firebase = chargerMessaging();
  if (!firebase) return;
  void configurerAppelSysteme();
  firebase.setBackgroundMessageHandler(firebase.getMessaging(), async (message) => {
    const invitation = lireInvitation(message.data);
    if (invitation) {
      await afficherAppelEntrant(invitation.callId, invitation.callerName);
      return;
    }
    const fin = lireFinAppel(message.data);
    if (fin) retirerAppelSysteme(fin, 'elsewhere');
  });
}

// Effet de bord voulu : importé en premier par index.js.
enregistrerReceptionEnArrierePlan();
