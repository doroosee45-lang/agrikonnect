import { prisma } from '../config/prisma.js';
import { logger } from './http/logger.js';
import { sendEmail } from '../integrations/email.js';
import { emitToUser } from '../realtime/bus.js';

/**
 * Modèle d'événements central (NOTIF-02) : un événement → N canaux,
 * avec déduplication par `dedupeKey`.
 *
 * Les préférences utilisateur (canal × type) sont respectées : un canal
 * désactivé ne reçoit rien, y compris le SMS.
 */
export const notify = async ({
  userId,
  type,
  title,
  body = null,
  channels = ['IN_APP'],
  payload = null,
  dedupeKey = null,
  email = null,
}) => {
  const created = [];

  for (const channel of channels) {
    // Préférence explicite : si désactivée, on n'envoie pas sur ce canal.
    const pref = await prisma.notificationPreference.findUnique({
      where: { userId_type_channel: { userId, type, channel } },
    }).catch(() => null);

    if (pref && pref.enabled === false) continue;

    try {
      const notification = await prisma.notification.create({
        data: {
          id: `ntf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          userId,
          type,
          title,
          body,
          channel,
          payload: payload ?? undefined,
          // La clé est unique par utilisateur et par canal : deux destinataires
          // du même événement doivent chacun recevoir leur notification.
          dedupeKey: dedupeKey ? `${dedupeKey}:${userId}:${channel}` : null,
        },
      });
      created.push(notification);

      // Temps réel : la pastille de notification se met à jour sans polling
      emitToUser(userId, 'notification:new', {
        id: notification.id,
        type,
        title,
        channel,
        payload: payload ?? null,
      });
    } catch (error) {
      // P2002 = doublon de dedupeKey : comportement attendu, on ignore.
      if (error.code !== 'P2002') logger.warn('Notification :', error.message);
    }

    if (channel === 'EMAIL' && email) {
      await sendEmail({ to: email, subject: title, text: body ?? title });
    }

    if (channel === 'SMS') {
      const { sendSms } = await import('../integrations/sms.js');
      await sendSms(payload?.phone ?? null, body ?? title);
    }
  }

  return created;
};

/** Diffuse un événement métier à plusieurs utilisateurs. */
export const notifyMany = async (userIds, event) => {
  const results = [];
  for (const userId of userIds.filter(Boolean)) {
    // eslint-disable-next-line no-await-in-loop
    results.push(...(await notify({ ...event, userId })));
  }
  return results;
};
