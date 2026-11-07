import { io, type Socket } from 'socket.io-client';

import { REALTIME_URL } from '@/lib/config';
import { queryClient, queryKeys } from '@/services/query';

import { sessionStore } from './api/session';

/**
 * Temps réel Socket.IO.
 *
 * Contrat serveur (`backend/src/realtime/index.js` + `bus.js`) :
 * - chemin `/realtime`, authentification par `handshake.auth.token` (aucun accès
 *   anonyme), payload ≤ 100 ko ;
 * - le serveur ne pousse que des identifiants et des statuts : le détail est
 *   toujours rechargé via l'API (d'où les invalidations ci-dessous) ;
 * - événements réellement émis : `ready`, `typing`, `message:new`,
 *   `message:read`, `conversation:new`, `conversation:blocked`, `order:new`,
 *   `order:updated`, `order:disputed`.
 */

export interface RealtimeEvent {
  at: string;
  [key: string]: unknown;
}

type Listener = (payload: RealtimeEvent) => void;

let socket: Socket | null = null;
const listeners = new Map<string, Set<Listener>>();

export const REALTIME_EVENTS = [
  'ready',
  'typing',
  'message:new',
  'message:read',
  'conversation:new',
  'conversation:blocked',
  'order:new',
  'order:updated',
  'order:disputed',
] as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[number];

function emitLocal(event: RealtimeEventName, payload: RealtimeEvent) {
  listeners.get(event)?.forEach((listener) => listener(payload));
}

export const realtime = {
  get connected(): boolean {
    return Boolean(socket?.connected);
  },

  /** Connexion idempotente : appelée après le login et au retour au premier plan. */
  connect(): void {
    const token = sessionStore.accessToken;
    if (!token || socket?.connected) return;

    if (socket) {
      socket.auth = { token };
      socket.connect();
      return;
    }

    socket = io(REALTIME_URL, {
      path: '/realtime',
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1_500,
      reconnectionDelayMax: 15_000,
    });

    // Un événement serveur invalide le cache concerné : l'UI recharge la donnée
    // fraîche plutôt que de faire confiance au payload poussé.
    socket.on('message:new', (payload: RealtimeEvent) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.conversations });
      if (typeof payload.conversationId === 'string') {
        queryClient.invalidateQueries({
          queryKey: queryKeys.messaging.messages(payload.conversationId),
        });
      }
      emitLocal('message:new', payload);
    });

    socket.on('message:read', (payload: RealtimeEvent) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.conversations });
      emitLocal('message:read', payload);
    });

    socket.on('conversation:new', (payload: RealtimeEvent) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.conversations });
      emitLocal('conversation:new', payload);
    });

    socket.on('conversation:blocked', (payload: RealtimeEvent) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.conversations });
      emitLocal('conversation:blocked', payload);
    });

    for (const event of ['order:new', 'order:updated', 'order:disputed'] as const) {
      socket.on(event, (payload: RealtimeEvent) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
        emitLocal(event, payload);
      });
    }

    socket.on('ready', (payload: RealtimeEvent) => emitLocal('ready', payload));
    socket.on('typing', (payload: RealtimeEvent) => emitLocal('typing', payload));
  },

  disconnect(): void {
    socket?.disconnect();
    socket?.removeAllListeners();
    socket = null;
  },

  on(event: RealtimeEventName, listener: Listener): () => void {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(listener);
    return () => listeners.get(event)?.delete(listener);
  },

  /** Indicateur de saisie : accepté par le serveur uniquement dans nos fils. */
  setTyping(conversationId: string, isTyping: boolean): void {
    socket?.emit('typing', { conversationId, isTyping });
  },

  /** Rejoint un fil ouvert après la connexion (nouvelle commande, par exemple). */
  joinConversation(conversationId: string): void {
    socket?.emit('conversation:join', { conversationId });
  },
};
