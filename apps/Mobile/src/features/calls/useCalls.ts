import { AppState, Vibration } from 'react-native';
import { create } from 'zustand';
import type { Room } from 'livekit-client';

import { realtime } from '@/services/realtime';

import { callsApi } from './callsApi';
import { ETAT_INITIAL, codeErreur, estTermine, reduire, type CallEvent, type CallUiState } from './callMachine';
import { appelsNatifsPossibles, chargerLiveKit, chargerMessaging } from './native';
import { enregistrerCetAppareil } from './pushDevices';
import { lireInvitation } from './pushPlan';
import { ecouterReponsesSysteme, marquerAppelSystemeActif, retirerAppelSysteme } from './systemCall';
import type { CallsConfig, CallView, LiveKitAccess } from './types';

/**
 * Magasin des appels audio (mobile). Même contrat que le web :
 * - AUDIO SEULEMENT (micro ; jamais de caméra) ;
 * - le serveur décide, l'appareil affiche ;
 * - désactivé par défaut : il faut `enabled: true` côté serveur ET un build
 *   natif construit avec EXPO_PUBLIC_NATIVE_CALLS=true (pas Expo Go).
 */

const INTERVALLE_SONDAGE_MS = 15_000;
const VIBRATION_SONNERIE = [0, 800, 1200];

interface CallsStore extends CallUiState {
  config: CallsConfig | null;
  demarre: boolean;
  disponible: boolean;
  demarrer: () => Promise<void>;
  arreter: () => void;
  appeler: (conversationId: string, inviteeUserIds: string[]) => Promise<void>;
  accepter: (callId?: string) => Promise<void>;
  refuser: (callId?: string) => Promise<void>;
  raccrocher: () => Promise<void>;
  basculerMicro: () => Promise<void>;
  fermer: () => void;
  rafraichir: (id?: string) => Promise<void>;
}

let salle: Room | null = null;
let sondage: ReturnType<typeof setInterval> | null = null;
let fermetureAuto: ReturnType<typeof setTimeout> | null = null;
let nettoyages: Array<() => void> = [];

async function quitterSalle(): Promise<void> {
  const courante = salle;
  salle = null;
  if (courante) {
    courante.removeAllListeners();
    await courante.disconnect().catch(() => undefined);
    await chargerLiveKit()?.rn.AudioSession.stopAudioSession().catch(() => undefined);
  }
}

export const useCalls = create<CallsStore>((set, get) => {
  const appliquer = (evenement: CallEvent) => {
    const avant = get();
    const apres = reduire(avant, evenement);
    set(apres);
    if (apres.phase === 'incoming' && avant.phase !== 'incoming') Vibration.vibrate(VIBRATION_SONNERIE, true);
    if (apres.phase !== 'incoming') Vibration.cancel();
    if (apres.phase === 'in_call' && apres.call) marquerAppelSystemeActif(apres.call.id);
    if (apres.phase === 'ended' && avant.phase !== 'ended') {
      if (apres.call) retirerAppelSysteme(apres.call.id, apres.endStatus === 'MISSED' ? 'missed' : 'ended');
      void quitterSalle();
      if (fermetureAuto) clearTimeout(fermetureAuto);
      fermetureAuto = setTimeout(() => get().fermer(), 4000);
    }
  };

  const depuisServeur = (call: CallView) => appliquer({ type: 'SERVER', call, connected: Boolean(salle) });

  const rejoindreSalle = async (acces: LiveKitAccess) => {
    await quitterSalle();
    const livekit = chargerLiveKit();
    if (!livekit) throw Object.assign(new Error('native-calls-unavailable'), { status: 503 });
    const { Room, RoomEvent } = livekit.client;
    await livekit.rn.AudioSession.startAudioSession();
    const room = new Room({ adaptiveStream: false, dynacast: false });
    room.on(RoomEvent.Reconnecting, () => appliquer({ type: 'RECONNECTING' }));
    room.on(RoomEvent.Reconnected, () => appliquer({ type: 'RECONNECTED' }));
    room.on(RoomEvent.Disconnected, () => {
      if (salle === room) {
        salle = null;
        void get().rafraichir();
      }
    });
    salle = room;
    // Les pistes audio distantes sont jouées par WebRTC natif : rien à attacher.
    await room.connect(acces.url, acces.token, { autoSubscribe: true });
    await room.localParticipant.setMicrophoneEnabled(true);
    appliquer({ type: 'CONNECTED' });
  };

  const echec = async (erreur: unknown) => {
    await quitterSalle();
    appliquer({ type: 'ERROR', code: codeErreur(erreur) });
  };

  const sonder = async () => {
    if (AppState.currentState !== 'active') return;
    try {
      const appels = (await callsApi.list()).data;
      const courant = get().call;
      if (courant) {
        const frais = appels.find((a) => a.id === courant.id);
        if (frais) depuisServeur(frais);
        else if (!estTermine(courant.status)) await get().rafraichir(courant.id);
      } else {
        const entrant = appels.find((a) => a.me?.status === 'INVITED');
        if (entrant) depuisServeur(entrant);
      }
    } catch {
      /* réseau : on retentera */
    }
  };

  return {
    ...ETAT_INITIAL,
    config: null,
    demarre: false,
    disponible: false,

    async demarrer() {
      if (get().demarre) return;
      set({ demarre: true });
      if (!appelsNatifsPossibles()) return; // Expo Go, web, ou build sans appels
      let config: CallsConfig | null = null;
      try {
        config = (await callsApi.config()).data;
      } catch {
        config = null;
      }
      set({ config, disponible: Boolean(config?.enabled) });
      if (!config?.enabled) return;

      void enregistrerCetAppareil();

      nettoyages.push(
        realtime.on('call:incoming', (evenement) => {
          if (typeof evenement.callId === 'string') void get().rafraichir(evenement.callId);
        }),
        realtime.on('call:updated', (evenement) => {
          if (evenement.callId === get().call?.id) void get().rafraichir(evenement.callId as string);
        }),
        // Réponse donnée depuis l'écran d'appel du système (CallKit / ConnectionService).
        ecouterReponsesSysteme(({ callId, action }) => {
          if (action === 'answer') void get().accepter(callId);
          else if (get().call?.id === callId && get().phase !== 'incoming') void get().raccrocher();
          else void get().refuser(callId);
        }),
      );

      // Push reçu application OUVERTE : on relit l'appel (l'écran in-app suffit).
      const firebase = chargerMessaging();
      if (firebase) {
        nettoyages.push(
          firebase.onMessage(firebase.getMessaging(), (message) => {
            const invitation = lireInvitation(message.data);
            if (invitation) void get().rafraichir(invitation.callId);
          }),
        );
      }

      const abonnement = AppState.addEventListener('change', (etat) => {
        if (etat === 'active') void sonder();
      });
      nettoyages.push(() => abonnement.remove());

      void sonder();
      sondage = setInterval(() => void sonder(), INTERVALLE_SONDAGE_MS);
    },

    arreter() {
      nettoyages.forEach((nettoyer) => nettoyer());
      nettoyages = [];
      if (sondage) clearInterval(sondage);
      sondage = null;
      Vibration.cancel();
      void quitterSalle();
      set({ ...ETAT_INITIAL, config: null, demarre: false, disponible: false });
    },

    async rafraichir(id) {
      const cible = id ?? get().call?.id;
      if (!cible) return;
      try {
        depuisServeur((await callsApi.get(cible)).data);
      } catch {
        /* appel invisible ou réseau */
      }
    },

    async appeler(conversationId, inviteeUserIds) {
      try {
        const { data } = await callsApi.create({ conversationId, inviteeUserIds });
        depuisServeur(data.call);
        await rejoindreSalle(data.livekit);
      } catch (erreur) {
        await echec(erreur);
      }
    },

    async accepter(callId) {
      const id = callId ?? get().call?.id;
      if (!id) return;
      Vibration.cancel();
      try {
        const { data } = await callsApi.accept(id);
        depuisServeur(data.call);
        await rejoindreSalle(data.livekit);
      } catch (erreur) {
        retirerAppelSysteme(id, 'ended');
        await echec(erreur);
      }
    },

    async refuser(callId) {
      const id = callId ?? get().call?.id;
      if (!id) return;
      Vibration.cancel();
      try {
        const appel = (await callsApi.decline(id)).data;
        if (get().call?.id === id || !get().call) depuisServeur(appel);
      } catch {
        /* déjà terminé côté serveur */
      } finally {
        retirerAppelSysteme(id, 'ended');
      }
    },

    async raccrocher() {
      const appel = get().call;
      if (!appel) return;
      try {
        const reponse = appel.status === 'RINGING' && appel.me?.isHost === true
          ? await callsApi.cancel(appel.id)
          : await callsApi.leave(appel.id);
        await quitterSalle();
        depuisServeur(reponse.data);
      } catch (erreur) {
        await echec(erreur);
      } finally {
        retirerAppelSysteme(appel.id, 'ended');
      }
    },

    async basculerMicro() {
      if (!salle) return;
      const coupe = !get().muted;
      try {
        await salle.localParticipant.setMicrophoneEnabled(!coupe);
        appliquer({ type: 'MUTE', muted: coupe });
      } catch (erreur) {
        await echec(erreur);
      }
    },

    fermer() {
      if (fermetureAuto) clearTimeout(fermetureAuto);
      fermetureAuto = null;
      Vibration.cancel();
      void quitterSalle();
      const { config, demarre, disponible } = get();
      set({ ...ETAT_INITIAL, config, demarre, disponible });
    },
  };
});
