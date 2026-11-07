/**
 * Exigences CDC couvertes : NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';

/**
 * NOTIF-01 → NOTIF-04 — Centre de notifications.
 * - Liste des notifications de l'utilisateur courant uniquement.
 * - Préférences par type × canal (email, SMS, push, in-app).
 * - Marquage lu idempotent.
 */

export const list = async (query, req) => {
  const { page, limit } = query;
  const where = {
    userId: req.user.id,
    channel: 'IN_APP',
    ...(query.unread === 'true' ? { readAt: null } : {}),
  };

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: req.user.id, channel: 'IN_APP', readAt: null } }),
  ]);

  return { items, total, page, limit, unreadCount };
};

export const markRead = async (id, req) => {
  const notification = await prisma.notification.findUnique({ where: { id } });
  // 404 et non 403 : on ne révèle pas l'existence d'une notification d'autrui
  if (!notification || notification.userId !== req.user.id) {
    throw ApiError.notFound('Notification introuvable');
  }

  if (notification.readAt) return notification;

  return prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
};

export const markAllRead = async (req) => {
  const result = await prisma.notification.updateMany({
    where: { userId: req.user.id, channel: 'IN_APP', readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
};

export const getPreferences = async (req) => {
  const preferences = await prisma.notificationPreference.findMany({
    where: { userId: req.user.id },
    orderBy: [{ type: 'asc' }, { channel: 'asc' }],
  });
  return {
    preferences,
    // Absence de ligne = valeur par défaut activée (opt-out explicite)
    default: { enabled: true },
  };
};

export const setPreferences = async (preferences, req) => {
  const results = [];

  for (const pref of preferences) {
    // eslint-disable-next-line no-await-in-loop
    const saved = await prisma.notificationPreference.upsert({
      where: { userId_type_channel: { userId: req.user.id, type: pref.type, channel: pref.channel } },
      update: { enabled: pref.enabled },
      create: { userId: req.user.id, type: pref.type, channel: pref.channel, enabled: pref.enabled },
    });
    results.push(saved);
  }

  return { preferences: results };
};
