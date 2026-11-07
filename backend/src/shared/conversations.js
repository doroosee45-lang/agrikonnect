import { prisma } from '../config/prisma.js';
import { resolveId } from './ids.js';
import { logger } from './http/logger.js';

/**
 * Conversations rattachées à un objet métier (MSG-01).
 *
 * Centralisé ici pour que les autres modules (commandes, transport, litiges)
 * puissent ouvrir un fil de discussion **sans importer le module messagerie**
 * (évite les dépendances circulaires) tout en gardant la même règle :
 * une conversation existe toujours pour un dossier, entre ses parties.
 */

export const SUBJECT_TYPES = ['LISTING', 'ORDER', 'TRANSPORT', 'DISPUTE', 'PROJECT'];

/**
 * Retourne la conversation ouverte du dossier, ou la crée.
 * Idempotent : deux appels simultanés ne créent pas deux fils.
 */
export const ensureBusinessConversation = async ({
  subjectType,
  subjectId,
  participantOrgIds,
  firstMessage = null,
  actorUserId = null,
}) => {
  const participants = [...new Set(participantOrgIds.filter(Boolean))];
  if (participants.length < 2) return null;

  const existing = await prisma.conversation.findFirst({
    where: {
      subjectType,
      subjectId,
      status: 'OPEN',
      participantOrgIds: { hasEvery: participants },
    },
  });
  if (existing) return existing;

  const conversation = await prisma.conversation.create({
    data: { id: resolveId(), subjectType, subjectId, participantOrgIds: participants, status: 'OPEN' },
  });

  if (firstMessage) {
    await prisma.message.create({
      data: {
        id: resolveId(),
        conversationId: conversation.id,
        senderId: actorUserId,
        senderOrgId: participants[0],
        body: firstMessage,
        attachments: [],
        readBy: actorUserId ? [actorUserId] : [],
      },
    });
  }

  return conversation;
};

/**
 * Ouverture « best effort » : un échec de création de conversation ne doit
 * jamais faire échouer l'opération métier (commande, litige…).
 */
export const ensureBusinessConversationSafe = async (params) => {
  try {
    return await ensureBusinessConversation(params);
  } catch (error) {
    logger.warn('Conversation métier non créée :', error.message);
    return null;
  }
};
