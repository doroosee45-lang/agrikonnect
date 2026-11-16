import { io, type Socket } from 'socket.io-client';

import { REALTIME_PATH, REALTIME_URL } from '@/lib/config';
import { sessionStore } from '@/services/session';

import type { CallUpdatedEvent, IncomingCallEvent } from './types';

/**
 * Temps réel des appels (bus Socket.IO EXISTANT du backend, chemin `/realtime`).
 * Le serveur authentifie le socket avec le jeton Supabase et ne le fait
 * rejoindre que SON salon utilisateur : aucun salon n'est choisi ici.
 *
 * Si le temps réel est indisponible (désactivé en production aujourd'hui), le
 * magasin d'appels se rabat sur une interrogation périodique de `GET /calls`.
 */
let socket: Socket | null = null;

export interface RealtimeHandlers {
  onIncoming: (event: IncomingCallEvent) => void;
  onUpdated: (event: CallUpdatedEvent) => void;
}

export function connecterTempsReel(handlers: RealtimeHandlers): () => void {
  deconnecterTempsReel();
  if (!sessionStore.accessToken) return () => undefined;

  const client = io(REALTIME_URL, {
    path: REALTIME_PATH,
    transports: ['websocket', 'polling'],
    // Jeton relu à CHAQUE (re)connexion : il change au rafraîchissement.
    auth: (callback) => callback({ token: sessionStore.accessToken }),
    reconnectionDelayMax: 15_000,
  });

  client.on('call:incoming', handlers.onIncoming);
  client.on('call:updated', handlers.onUpdated);
  client.on('connect_error', (erreur) => {
    if (erreur?.message === 'UNAUTHORIZED') {
      // Jeton expiré : on le rafraîchit puis on retente une fois.
      void sessionStore.refresh().then((jeton) => {
        if (jeton) client.connect();
      });
    }
  });

  socket = client;
  return deconnecterTempsReel;
}

export function deconnecterTempsReel(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
