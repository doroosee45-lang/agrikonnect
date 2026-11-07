import { logger } from '../shared/http/logger.js';

/**
 * Bus temps réel (Socket.IO) — CDC V2 §8.7.
 *
 * Les services publient des événements métier (`order.updated`,
 * `message.new`, `notification.new`) sans connaître le transport. Si le
 * serveur Socket.IO n'est pas monté (tests, scripts, démarrage partiel),
 * l'émission est simplement ignorée : l'API REST reste la source de vérité.
 */

let io = null;

export const setIo = (instance) => {
  io = instance;
};

export const getIo = () => io;

export const roomForOrganization = (organizationId) => `org:${organizationId}`;
export const roomForConversation = (conversationId) => `conversation:${conversationId}`;
export const roomForUser = (userId) => `user:${userId}`;

/**
 * Émet vers toutes les sessions d'une organisation.
 * Aucune donnée sensible n'est poussée : uniquement des identifiants et des
 * statuts, le client recharge le détail via l'API.
 */
export const emitToOrganization = (organizationId, event, payload) => {
  if (!io || !organizationId) return false;
  io.to(roomForOrganization(organizationId)).emit(event, { ...payload, at: new Date().toISOString() });
  return true;
};

export const emitToConversation = (conversationId, event, payload) => {
  if (!io || !conversationId) return false;
  io.to(roomForConversation(conversationId)).emit(event, { ...payload, at: new Date().toISOString() });
  return true;
};

export const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return false;
  io.to(roomForUser(userId)).emit(event, { ...payload, at: new Date().toISOString() });
  return true;
};

/** Émission multi-organisations (les deux parties d'une commande). */
export const emitToOrganizations = (organizationIds, event, payload) => {
  const sent = (organizationIds ?? []).filter(Boolean).map((id) => emitToOrganization(id, event, payload));
  return sent.some(Boolean);
};

export const realtimeStats = () => ({
  enabled: Boolean(io),
  connections: io?.engine?.clientsCount ?? 0,
  rooms: io?.sockets?.adapter?.rooms?.size ?? 0,
});

export const logRealtime = (message) => logger.info(`[realtime] ${message}`);
