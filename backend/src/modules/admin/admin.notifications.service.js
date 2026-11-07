/**
 * SPEC-SUPER-ADMIN M7 — notifications système : annonces internes ciblées
 * (U-M7-1), historique d'envois et taux de délivrance (via `sms_batch_logs`
 * et `sms_messages`).
 *
 * RG-M4-2 s'applique aussi ici : chaque diffusion est auditée
 * (`admin.notification.broadcast`) comme toute action sensible.
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { auditAs } from '../../shared/audit.js';
import { notifyMany } from '../../shared/events.js';

/**
 * U-M7-1 — annonce interne ciblée par rôle et/ou par pays.
 * Le ciblage est résolu ici (rôles d'adhésion actifs, profils par pays) puis
 * la remise passe par `notifyMany` (préférences utilisateur respectées).
 */
export const broadcast = async ({ title, body, role, country, channels }, req) => {
  assertCiblage({ role, country });
  // Cibles : rôles d'adhésion actifs, profils par pays ; intersection si les deux.
  let cibles = null;
  if (role) {
    const adhesions = await prisma.membership.findMany({
      where: { status: 'ACTIVE' },
      select: { userId: true, roles: true },
      take: 5000,
    });
    cibles = new Set(adhesions.filter((m) => (m.roles ?? []).includes(role)).map((m) => m.userId));
  }
  if (country) {
    const profils = await prisma.profile.findMany({
      where: { countryCode: country },
      select: { id: true },
      take: 5000,
    });
    const ids = new Set(profils.map((p) => p.id));
    cibles = cibles ? new Set([...cibles].filter((id) => ids.has(id))) : ids;
  }

  const destinataires = [...(cibles ?? [])];
  const remises = await notifyMany(destinataires, {
    type: 'admin.announcement',
    title,
    body,
    channels,
    dedupeKey: `announce:${Date.now().toString(36)}`,
  });

  await auditAs(req, {
    action: 'admin.notification.broadcast',
    resource: 'notifications',
    oldValue: null,
    newValue: {
      title,
      role: role ?? null,
      country: country ?? null,
      channels,
      targeted: destinataires.length,
      delivered: remises.length,
    },
  });

  return {
    title,
    role: role ?? null,
    country: country ?? null,
    channels,
    targeted: destinataires.length,
    delivered: remises.length,
  };
};

/**
 * U-M7-1 — historique d'envois + taux de délivrance.
 * Annonces : journal d'audit `admin.notification.broadcast` (source de
 * vérité des diffusions). SMS : `sms_batch_logs` agrégés + états
 * `sms_messages` (délivré / en cours / échoué).
 */
export const history = async ({ limit }) => {
  const annonces = await prisma.auditLog.findMany({
    where: { action: 'admin.notification.broadcast' },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const batchs = await prisma.smsBatchLog.findMany({
    orderBy: { startedAt: 'desc' },
    take: limit,
  });

  const messages = await prisma.smsMessage.findMany({ select: { status: true }, take: 5000 });
  const etats = { delivered: 0, pending: 0, failed: 0 };
  for (const m of messages) {
    if (m.status === 'DELIVERED') etats.delivered += 1;
    else if (m.status === 'FAILED' || m.status === 'UNDELIVERED') etats.failed += 1;
    else etats.pending += 1;
  }
  const total = etats.delivered + etats.pending + etats.failed;

  return {
    annonces: annonces.map((row) => ({
      at: row.createdAt,
      actorId: row.actorId,
      title: row.newValue?.title ?? null,
      role: row.newValue?.role ?? null,
      country: row.newValue?.country ?? null,
      channels: row.newValue?.channels ?? null,
      targeted: row.newValue?.targeted ?? null,
      delivered: row.newValue?.delivered ?? null,
    })),
    sms: {
      batches: batchs.map((b) => ({
        batchId: b.batchId,
        candidates: b.candidates,
        sent: b.sent,
        skipped: b.skipped,
        failed: b.failed,
        startedAt: b.startedAt,
        mode: b.mode,
      })),
      messages: {
        ...etats,
        total,
        deliveryRate: total > 0 ? Math.round((etats.delivered / total) * 1000) / 1000 : null,
        sampleCappedAt: 5000,
      },
    },
  };
};

/** Filet : un ciblage absent est déjà refusé par le schéma (refine) ; double garde ici. */
export const assertCiblage = ({ role, country }) => {
  if (!role && !country) {
    throw ApiError.badRequest('Ciblage requis : un rôle et/ou un pays');
  }
};
