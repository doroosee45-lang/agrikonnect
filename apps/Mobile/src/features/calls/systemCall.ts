import { tr } from '@/i18n';

import { chargerCallKeep } from './native';
import { uuidDepuisAppel } from './pushPlan';

/**
 * Écran d'appel du SYSTÈME (CallKit sur iOS, ConnectionService sur Android)
 * via react-native-callkeep. C'est lui qui fait sonner le téléphone quand
 * l'application est en arrière-plan ou fermée ; une simple notification ne le
 * permet pas de façon fiable.
 *
 * L'appareil ne décide de rien : « Répondre » / « Refuser » ne font que
 * relayer le choix à l'API, qui vérifie l'invitation.
 */

type Reponse = { callId: string; action: 'answer' | 'end' };
type Ecouteur = (reponse: Reponse) => void;

const appelsAffiches = new Map<string, string>(); // uuid → callId
const ecouteurs = new Set<Ecouteur>();
/** Réponses données avant que l'écran React ne soit prêt (démarrage à froid). */
const enAttente: Reponse[] = [];
let configure: Promise<boolean> | null = null;

const diffuser = (reponse: Reponse) => {
  if (ecouteurs.size === 0) enAttente.push(reponse);
  ecouteurs.forEach((ecouteur) => ecouteur(reponse));
};

export function configurerAppelSysteme(): Promise<boolean> {
  const callKeep = chargerCallKeep();
  if (!callKeep) return Promise.resolve(false);
  if (configure) return configure;
  configure = callKeep
    .setup({
      ios: { appName: 'AgriKonnect', supportsVideo: false, maximumCallGroups: '1', maximumCallsPerCallGroup: '1', includesCallsInRecents: false },
      android: {
        alertTitle: tr('ui.appelAutorisationTitre'),
        alertDescription: tr('ui.appelAutorisationTexte'),
        cancelButton: tr('ui.appelFermer'),
        okButton: tr('ui.appelAutoriser'),
        additionalPermissions: [],
        selfManaged: false,
        foregroundService: {
          channelId: 'africa.agrikonnect.calls',
          channelName: tr('ui.appelAudio'),
          notificationTitle: tr('ui.appelEnCours'),
        },
      },
    })
    .then(() => {
      callKeep.addEventListener('answerCall', ({ callUUID }) => {
        const callId = appelsAffiches.get(callUUID);
        if (callId) {
          callKeep.backToForeground();
          diffuser({ callId, action: 'answer' });
        }
      });
      callKeep.addEventListener('endCall', ({ callUUID }) => {
        const callId = appelsAffiches.get(callUUID);
        appelsAffiches.delete(callUUID);
        if (callId) diffuser({ callId, action: 'end' });
      });
      return true;
    })
    .catch(() => {
      configure = null;
      return false;
    });
  return configure;
}

/** Fait sonner l'écran d'appel natif pour une invitation reçue par push. */
export async function afficherAppelEntrant(callId: string, nomAppelant: string | null): Promise<boolean> {
  const callKeep = chargerCallKeep();
  if (!callKeep || !(await configurerAppelSysteme())) return false;
  const uuid = uuidDepuisAppel(callId);
  if (appelsAffiches.has(uuid)) return true;
  appelsAffiches.set(uuid, callId);
  // Aucune donnée personnelle au-delà du nom déjà présent dans la notification.
  callKeep.displayIncomingCall(uuid, 'AgriKonnect', nomAppelant ?? tr('ui.appelAudio'), 'generic', false);
  return true;
}

/** Retire l'écran natif (appel accepté ailleurs, annulé, manqué ou terminé). */
export function retirerAppelSysteme(callId: string, raison: 'ended' | 'missed' | 'elsewhere' = 'ended'): void {
  const callKeep = chargerCallKeep();
  if (!callKeep) return;
  const uuid = uuidDepuisAppel(callId);
  if (!appelsAffiches.has(uuid)) return;
  appelsAffiches.delete(uuid);
  const code = raison === 'missed' ? 6 : raison === 'elsewhere' ? 4 : 2; // CONSTANTS.END_CALL_REASONS
  callKeep.reportEndCallWithUUID(uuid, code);
}

/** Signale au système que l'appel est établi (audio actif). */
export function marquerAppelSystemeActif(callId: string): void {
  const callKeep = chargerCallKeep();
  const uuid = uuidDepuisAppel(callId);
  if (callKeep && appelsAffiches.has(uuid)) callKeep.setCurrentCallActive(uuid);
}

export function ecouterReponsesSysteme(ecouteur: Ecouteur): () => void {
  ecouteurs.add(ecouteur);
  enAttente.splice(0).forEach(ecouteur);
  return () => ecouteurs.delete(ecouteur);
}
