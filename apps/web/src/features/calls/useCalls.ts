import { create } from 'zustand';
import type { RemoteTrack, Room } from 'livekit-client';

import { callsApi } from './callsApi';
import { ETAT_INITIAL, codeErreur, estTermine, reduire, type CallEvent, type CallUiState } from './callMachine';
import { arreterSonnerie, demarrerSonnerie } from './ringtone';
import { connecterTempsReel, deconnecterTempsReel } from './realtime';
import type { CallsConfig, CallView, LiveKitAccess } from './types';

/**
 * Magasin des appels audio (web).
 *
 * - AUDIO SEULEMENT : seul le micro est activé (`setMicrophoneEnabled`) ; aucune
 *   caméra, aucun partage d'écran n'est jamais demandé.
 * - Le serveur est l'autorité : chaque action passe par l'API, l'état affiché
 *   vient de sa réponse (ou des événements temps réel `call:*`).
 * - Désactivé par défaut : rien ne démarre si `GET /calls/config` ne renvoie pas
 *   `enabled: true` (CALLS_ENABLED + LiveKit + modules.appels côté serveur).
 */

const INTERVALLE_SONDAGE_MS = 15_000;

interface CallsStore extends CallUiState {
  config: CallsConfig | null;
  demarre: boolean;
  demarrer: () => Promise<void>;
  arreter: () => void;
  appeler: (conversationId: string, inviteeUserIds: string[]) => Promise<void>;
  accepter: () => Promise<void>;
  refuser: () => Promise<void>;
  raccrocher: () => Promise<void>;
  basculerMicro: () => Promise<void>;
  fermer: () => void;
  rafraichir: (id?: string) => Promise<void>;
}

let salle: Room | null = null;
let sondage: ReturnType<typeof setInterval> | null = null;
let fermetureAuto: ReturnType<typeof setTimeout> | null = null;

const elementsAudio = new Set<HTMLMediaElement>();

const detacherAudio = () => {
  elementsAudio.forEach((el) => el.remove());
  elementsAudio.clear();
};

async function quitterSalle(): Promise<void> {
  const courante = salle;
  salle = null;
  if (courante) {
    courante.removeAllListeners();
    await courante.disconnect().catch(() => undefined);
  }
  detacherAudio();
}

export const useCalls = create<CallsStore>((set, get) => {
  const appliquer = (evenement: CallEvent) => {
    const avant = get();
    const apres = reduire(avant, evenement);
    set(apres);
    // Sonnerie : seulement pendant une invitation entrante.
    if (apres.phase === 'incoming') demarrerSonnerie();
    else arreterSonnerie();
    if (apres.phase === 'ended' && avant.phase !== 'ended') {
      void quitterSalle();
      if (fermetureAuto) clearTimeout(fermetureAuto);
      fermetureAuto = setTimeout(() => get().fermer(), 4000);
    }
  };

  const depuisServeur = (call: CallView) => appliquer({ type: 'SERVER', call, connected: Boolean(salle) });

  const rejoindreSalle = async (acces: LiveKitAccess) => {
    await quitterSalle();
    // Chargé à la demande : le SDK n'alourdit pas le premier chargement des pages.
    const { Room, RoomEvent, Track } = await import('livekit-client');
    const room = new Room({
      adaptiveStream: false,
      dynacast: false,
      audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return; // audio uniquement
      const element = track.attach();
      element.style.display = 'none';
      document.body.appendChild(element);
      elementsAudio.add(element);
    });
    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      track.detach().forEach((el) => {
        el.remove();
        elementsAudio.delete(el);
      });
    });
    room.on(RoomEvent.Reconnecting, () => appliquer({ type: 'RECONNECTING' }));
    room.on(RoomEvent.Reconnected, () => appliquer({ type: 'RECONNECTED' }));
    room.on(RoomEvent.Disconnected, () => {
      if (salle === room) {
        salle = null;
        // Déconnexion inattendue : l'état serveur décide (fin ou reconnexion manuelle).
        void get().rafraichir();
      }
    });

    salle = room;
    await room.connect(acces.url, acces.token, { autoSubscribe: true });
    await room.startAudio().catch(() => undefined);
    await room.localParticipant.setMicrophoneEnabled(true);
    appliquer({ type: 'CONNECTED' });
  };

  const echec = async (erreur: unknown) => {
    await quitterSalle();
    appliquer({ type: 'ERROR', code: codeErreur(erreur) });
  };

  return {
    ...ETAT_INITIAL,
    config: null,
    demarre: false,

    async demarrer() {
      if (get().demarre) return;
      set({ demarre: true });
      let config: CallsConfig | null = null;
      try {
        config = (await callsApi.config()).data;
      } catch {
        config = null; // module coupé par l'administration (403) ou API indisponible
      }
      set({ config });
      if (!config?.enabled) return;

      connecterTempsReel({
        onIncoming: (evenement) => void get().rafraichir(evenement.callId),
        onUpdated: (evenement) => {
          if (get().call?.id === evenement.callId) void get().rafraichir(evenement.callId);
        },
      });
      // Repli sans temps réel : interroger les appels en cours.
      const sonder = async () => {
        if (document.visibilityState !== 'visible') return;
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
      void sonder();
      sondage = setInterval(() => void sonder(), INTERVALLE_SONDAGE_MS);
    },

    arreter() {
      deconnecterTempsReel();
      if (sondage) clearInterval(sondage);
      sondage = null;
      arreterSonnerie();
      void quitterSalle();
      set({ ...ETAT_INITIAL, config: null, demarre: false });
    },

    async rafraichir(id) {
      const cible = id ?? get().call?.id;
      if (!cible) return;
      try {
        depuisServeur((await callsApi.get(cible)).data);
      } catch {
        /* appel invisible ou réseau : état inchangé */
      }
    },

    async appeler(conversationId, inviteeUserIds) {
      try {
        const { data } = await callsApi.create({ conversationId, inviteeUserIds });
        depuisServeur(data.call);
        await rejoindreSalle(data.livekit); // l'hôte attend dans la salle
      } catch (erreur) {
        await echec(erreur);
      }
    },

    async accepter() {
      const appel = get().call;
      if (!appel) return;
      arreterSonnerie();
      try {
        const { data } = await callsApi.accept(appel.id);
        depuisServeur(data.call);
        await rejoindreSalle(data.livekit);
      } catch (erreur) {
        await echec(erreur);
      }
    },

    async refuser() {
      const appel = get().call;
      if (!appel) return;
      arreterSonnerie();
      try {
        depuisServeur((await callsApi.decline(appel.id)).data);
      } catch (erreur) {
        await echec(erreur);
      }
    },

    async raccrocher() {
      const appel = get().call;
      if (!appel) return;
      try {
        const hote = appel.me?.isHost === true;
        const reponse = appel.status === 'RINGING' && hote
          ? await callsApi.cancel(appel.id)
          : await callsApi.leave(appel.id);
        await quitterSalle();
        depuisServeur(reponse.data);
      } catch (erreur) {
        await echec(erreur);
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
      arreterSonnerie();
      void quitterSalle();
      set({ ...ETAT_INITIAL, config: get().config, demarre: get().demarre });
    },
  };
});
