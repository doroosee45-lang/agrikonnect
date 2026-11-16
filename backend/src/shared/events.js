import { prisma } from '../config/prisma.js';
import { logger } from './http/logger.js';
import { sendEmail } from '../integrations/email.js';
import { emitToUser } from '../realtime/bus.js';
import { envoyerAuxAppareils } from '../integrations/push.js';
import { DEFAULT_LOCALE, normalizeLocale, translateMessage } from './i18n/index.js';

/** Langue enregistrée sur le profil du destinataire (repli : français). */
const recipientLocale = async (userId) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { id: userId }, select: { locale: true } });
    return normalizeLocale(profile?.locale) ?? DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
};

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
  /**
   * Canal PUSH (FCM / APNs, src/integrations/push.js) : `genre` APPEL_ENTRANT
   * (sonnerie : FCM priorité haute, VoIP iOS), APPEL_TERMINE ou NOTIFICATION
   * (défaut) ; `ttlSecondes`, `collapseId` facultatifs.
   */
  push = null,
}) => {
  const created = [];

  /*
   * I18N-01 — une notification est écrite dans la langue du **destinataire**
   * (`Profile.locale`), pas dans celle de la requête qui l'a déclenchée. Les
   * textes source restent français ; repli français si la langue est inconnue.
   */
  const locale = await recipientLocale(userId);
  title = translateMessage(title, locale);
  body = body ? translateMessage(body, locale) : body;

  for (const channel of channels) {
    // Préférence explicite : si désactivée, on n'envoie pas sur ce canal.
    const pref = await prisma.notificationPreference.findUnique({
      where: { userId_type_channel: { userId, type, channel } },
    }).catch(() => null);

    if (pref && pref.enabled === false) continue;

    let creee = false;
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
      creee = true;

      // Temps réel : la pastille de notification se met à jour sans polling
      emitToUser(userId, 'notification:new', {
        id: notification.id,
        type,
        channel,
      });
    } catch (error) {
      // P2002 = doublon de dedupeKey : comportement attendu, on ignore.
      if (error.code !== 'P2002') logger.warn('Notification :', error.message);
    }

    if (channel === 'EMAIL' && email) {
      await sendEmail({ to: email, subject: title, text: body ?? title });
    }

    // Push : seulement pour une notification NOUVELLE (un doublon dédupliqué ne resonne pas).
    if (channel === 'PUSH' && creee) {
      await envoyerAuxAppareils(userId, {
        genre: push?.genre ?? 'NOTIFICATION',
        type,
        titre: title,
        corps: body ?? title,
        donnees: payload ?? {},
        ttlSecondes: push?.ttlSecondes,
        collapseId: push?.collapseId,
      }).catch((erreur) => logger.warn('Push :', erreur.message));
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
