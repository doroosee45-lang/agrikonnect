import { Server } from 'socket.io';
import { supabase } from '../config/supabase.js';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../shared/http/logger.js';
import {
  setIo,
  roomForOrganization,
  roomForConversation,
  roomForUser,
  realtimeStats,
} from './bus.js';

/**
 * Couche temps réel (CDC V2 §8.7) — Socket.IO.
 *
 * Principes :
 *  - **Les écritures passent par l'API REST** : validation Zod, permissions,
 *    audit et idempotence restent centralisés. Le WebSocket ne sert qu'à
 *    pousser les nouveautés et les indicateurs de saisie.
 *  - **Authentification identique au REST** : jeton Supabase dans
 *    `handshake.auth.token`. Aucun accès anonyme.
 *  - **Cloisonnement** : chaque socket rejoint une room par organisation et
 *    une room par conversation à laquelle son organisation participe. Aucun
 *    message n'est diffusé en dehors de ces rooms.
 */

/** Durée de validité d'un indicateur de saisie (côté client). */
export const TYPING_TTL_MS = 5000;

/** Charge l'utilisateur applicatif à partir du jeton Supabase. */
const authenticateSocket = async (token) => {
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  const profile = await prisma.profile.findUnique({
    where: { id: data.user.id },
    include: {
      memberships: {
        where: { status: 'ACTIVE', organization: { deletedAt: null } },
        include: { organization: { select: { id: true, name: true } } },
      },
    },
  });

  if (!profile || profile.status !== 'ACTIVE') return null;
  return profile;
};

/** Conversations ouvertes de l'utilisateur (par organisation). */
const loadConversationRooms = async (organizationIds) => {
  if (organizationIds.length === 0) return [];

  const conversations = await prisma.conversation.findMany({
    where: {
      participantOrgIds: { hasSome: organizationIds },
      status: { in: ['OPEN', 'BLOCKED'] },
    },
    select: { id: true },
    take: 500,
    orderBy: { updatedAt: 'desc' },
  });

  return conversations.map((c) => c.id);
};

export const attachRealtime = (httpServer) => {
  const io = new Server(httpServer, {
    path: '/realtime',
    cors: {
      origin: env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? '*',
      credentials: true,
    },
    // Payloads courts : on ne transporte que des identifiants et statuts.
    maxHttpBufferSize: 1e5,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token ?? socket.handshake.headers?.authorization?.slice(7);
      const profile = await authenticateSocket(token);
      if (!profile) return next(new Error('UNAUTHORIZED'));

      socket.data.userId = profile.id;
      socket.data.organizationIds = profile.memberships.map((m) => m.organizationId);
      return next();
    } catch (error) {
      logger.warn('[realtime] échec d\'authentification :', error.message);
      return next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId, organizationIds } = socket.data;

    socket.join(roomForUser(userId));
    organizationIds.forEach((organizationId) => socket.join(roomForOrganization(organizationId)));

    const conversationIds = await loadConversationRooms(organizationIds).catch(() => []);
    conversationIds.forEach((id) => socket.join(roomForConversation(id)));
    socket.data.conversationIds = new Set(conversationIds);

    socket.emit('ready', {
      userId,
      organizations: organizationIds,
      conversations: conversationIds.length,
      at: new Date().toISOString(),
    });

    /**
     * Indicateur de saisie. On vérifie l'appartenance avant diffusion :
     * un socket ne peut pas « typer » dans une conversation qui n'est pas la sienne.
     */
    socket.on('typing', (payload = {}) => {
      const { conversationId, isTyping = true } = payload;
      if (!conversationId || !socket.data.conversationIds.has(conversationId)) return;

      socket.to(roomForConversation(conversationId)).emit('typing', {
        conversationId,
        userId,
        isTyping: Boolean(isTyping),
        at: new Date().toISOString(),
      });
    });

    /** Rejoindre un fil créé après la connexion (nouvelle commande, par ex.). */
    socket.on('conversation:join', async ({ conversationId } = {}, ack) => {
      if (!conversationId) return ack?.({ ok: false, error: 'MISSING_ID' });

      const conversation = await prisma.conversation
        .findUnique({ where: { id: conversationId }, select: { participantOrgIds: true } })
        .catch(() => null);

      const allowed =
        conversation && conversation.participantOrgIds.some((id) => organizationIds.includes(id));

      if (!allowed) return ack?.({ ok: false, error: 'FORBIDDEN' });

      socket.join(roomForConversation(conversationId));
      socket.data.conversationIds.add(conversationId);
      return ack?.({ ok: true });
    });

    socket.on('conversation:leave', ({ conversationId } = {}) => {
      if (!conversationId) return;
      socket.leave(roomForConversation(conversationId));
      socket.data.conversationIds.delete(conversationId);
    });

    /** Battement de cœur applicatif : utile derrière un proxy mobile instable. */
    socket.on('ping:app', (ack) => ack?.({ at: new Date().toISOString() }));

    socket.on('disconnect', (reason) => {
      logger.debug?.(`[realtime] déconnexion ${userId} (${reason})`);
    });
  });

  setIo(io);
  logger.info(`[realtime] Socket.IO actif sur le chemin /realtime (${realtimeStats().connections} connexion(s))`);

  return io;
};

export { realtimeStats };
