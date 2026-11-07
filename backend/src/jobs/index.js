/**
 * Exigences CDC couvertes : NFR-06.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../shared/http/logger.js';
import { notifyMany } from '../shared/events.js';
import { audit } from '../shared/audit.js';
import { runMonitoring, scanSilentSensors } from '../modules/alerts/alerts.service.js';
import { runAcquisition as runSatelliteAcquisition } from '../modules/satellite/acquisition.service.js';
import { runDetection as runAnomalyDetection } from '../modules/anomalies/anomalies.service.js';
import { escaladerAlertes } from '../modules/alerts/alertEscalation.service.js';

/**
 * Tâches planifiées (jobs) — règles du CDC qui ne peuvent pas dépendre d'un
 * appel utilisateur.
 *
 * Principes :
 *  - chaque tâche est **idempotente** : la relancer ne produit pas de doublon ;
 *  - chaque tâche renvoie un compte-rendu (`result`) journalisé et exposé via
 *    `GET /admin/jobs` (observabilité, pas de boîte noire) ;
 *  - aucune tâche ne contourne les règles métier : la plupart délèguent aux
 *    services (`listings.expire`) et les autres font des mises à jour
 *    conditionnelles (`updateMany`), jamais de suppression physique non prévue ;
 *  - un échec de tâche ne tue pas le processus : il est journalisé et visible.
 */

const DAY_MS = 24 * 3600 * 1000;

const RETENTION_DAYS = Number(process.env.NOTIFICATION_RETENTION_DAYS ?? 90);
const ORDER_RESPONSE_DAYS = Number(process.env.ORDER_RESPONSE_DAYS ?? 7);
const DISPUTE_SLA_DAYS = Number(process.env.DISPUTE_SLA_DAYS ?? 5);
const LISTING_EXPIRY_MINUTES = Number(process.env.LISTING_EXPIRY_MINUTES ?? 5);

/** Notifie les modérateurs (une seule fois par jour et par objet). */
const notifyModerators = async (event) => {
  const memberships = await prisma.membership.findMany({
    where: { status: 'ACTIVE', roles: { hasSome: ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'] } },
    take: 50,
  });
  return notifyMany(
    [...new Set(memberships.map((m) => m.userId))],
    event,
  );
};

export const JOBS = {
  /** V2 MKT-06 — expiration automatique des annonces arrivées à échéance. */
  'listings.expire': {
    description: 'Passe en EXPIRED les annonces dont la date de disponibilité est dépassée',
    intervalMs: LISTING_EXPIRY_MINUTES * 60 * 1000,
    run: async () => {
      const now = new Date();
      // `updateMany` conditionnel : seules les annonces encore actives changent,
      // et la date est re-testée dans la clause WHERE (pas de course).
      const updated = await prisma.listing.updateMany({
        where: {
          status: { in: ['PUBLISHED', 'RESERVED'] },
          expiresAt: { lt: now },
          deletedAt: null,
        },
        data: { status: 'EXPIRED' },
      });
      return { expired: updated.count ?? 0, at: now.toISOString() };
    },
  },

  /** V2 ORD-02 — une commande restée PENDING au-delà du délai est annulée. */
  'orders.expirePending': {
    description: 'Annule les commandes PENDING sans réponse au-delà du délai configuré',
    intervalMs: 15 * 60 * 1000,
    run: async () => {
      const cutoff = new Date(Date.now() - ORDER_RESPONSE_DAYS * DAY_MS);
      const pending = await prisma.order.findMany({
        where: { status: 'PENDING', createdAt: { lt: cutoff } },
        take: 500,
      });

      let cancelled = 0;
      for (const order of pending) {
        const updated = await prisma.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED', version: { increment: 1 } },
        });
        if (!updated) continue;

        // Journal append-only : la raison de l'annulation est explicite.
        await prisma.orderEvent.create({
          data: {
            id: `evt_${order.id}_auto_cancel`,
            orderId: order.id,
            from: 'PENDING',
            to: 'CANCELLED',
            actorId: null,
            reason: `Annulation automatique : aucune réponse sous ${ORDER_RESPONSE_DAYS} jours`,
          },
        });
        cancelled += 1;
      }

      return {
        cancelled,
        // Aucun stock n'est libéré : une commande PENDING ne réserve rien (STK-01).
        stockReleased: false,
        cutoff: cutoff.toISOString(),
      };
    },
  },

  /** V4 DR-02 — l'accès à une data room expire automatiquement. */
  'dataroom.expireAccess': {
    description: 'Passe en EXPIRED les accès data room échus et journalise la révocation',
    intervalMs: 60 * 60 * 1000,
    run: async () => {
      const now = new Date();
      const expired = await prisma.dataRoomAccessRequest.findMany({
        where: { status: 'GRANTED', expiresAt: { lt: now } },
        take: 500,
      });

      for (const request of expired) {
        await prisma.dataRoomAccessRequest.update({
          where: { id: request.id },
          data: { status: 'EXPIRED' },
        });
        await prisma.dataRoomAccessLog.create({
          data: {
            id: `drl_${request.id}_expire`,
            projectId: request.projectId,
            documentId: null,
            userId: request.granteeUserId,
            action: `EXPIRE:${request.id}`,
            ip: null,
            device: 'job:dataroom.expireAccess',
          },
        });
      }

      return { expired: expired.length, at: now.toISOString() };
    },
  },

  /** V5 API-02 — les clés d'API arrivées à échéance ne doivent plus fonctionner. */
  'apikeys.expire': {
    description: 'Révoque les clés d’API expirées (statut REVOKED, motif expédition)',
    intervalMs: 60 * 60 * 1000,
    run: async () => {
      const now = new Date();
      const updated = await prisma.apiKey.updateMany({
        where: { status: 'ACTIVE', expiresAt: { lt: now } },
        data: { status: 'REVOKED', revokedAt: now },
      });
      return { revoked: updated.count ?? 0, at: now.toISOString() };
    },
  },

  /** V2 DISP-02 — alerte SLA sur les litiges ouverts trop longtemps. */
  'disputes.sla': {
    description: 'Alerte les modérateurs sur les litiges ouverts au-delà du SLA',
    intervalMs: 6 * 60 * 60 * 1000,
    run: async () => {
      const cutoff = new Date(Date.now() - DISPUTE_SLA_DAYS * DAY_MS);
      const disputes = await prisma.dispute.findMany({
        where: { status: 'OPEN', createdAt: { lt: cutoff } },
        take: 200,
      });

      let alerted = 0;
      for (const dispute of disputes) {
        const day = new Date().toISOString().slice(0, 10);
        const sent = await notifyModerators({
          type: 'DISPUTE_SLA',
          title: 'Litige au-delà du délai de traitement',
          body: `Le litige ${dispute.id} est ouvert depuis plus de ${DISPUTE_SLA_DAYS} jours.`,
          payload: { disputeId: dispute.id, orderId: dispute.orderId ?? null },
          // Idempotence : une alerte par litige et par jour.
          dedupeKey: `dispute-sla:${dispute.id}:${day}`,
        });
        if (sent.length) alerted += 1;
      }

      return { disputes: disputes.length, alerted, slaDays: DISPUTE_SLA_DAYS };
    },
  },

  /** V2 NOTIF-02 — purge des notifications lues au-delà de la rétention. */
  'notifications.purge': {
    description: 'Supprime les notifications lues au-delà de la durée de rétention',
    intervalMs: DAY_MS,
    run: async () => {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * DAY_MS);
      const deleted = await prisma.notification.deleteMany({
        where: { readAt: { not: null, lt: cutoff } },
      });
      return {
        deleted: deleted.count ?? 0,
        retentionDays: RETENTION_DAYS,
        // Les notifications non lues ne sont jamais supprimées automatiquement.
        unreadKept: true,
      };
    },
  },

  /**
   * V3 IOT-03 — un capteur silencieux est signalé, jamais « inventé » comme actif.
   *
   * Délégué au service d'alertes : le capteur muet produit une ligne dans
   * `threshold_alerts` comme les autres alertes, donc l'agriculteur a une seule
   * boîte et une seule règle de re-notification. Le seuil de silence et la
   * logique de comparaison vivaient auparavant ici **et** dans le service —
   * deux implémentations de la même règle.
   */
  'iot.markSilent': {
    description: 'Signale les capteurs sans remontée au-delà du seuil de silence',
    intervalMs: 6 * 60 * 60 * 1000,
    run: async () => scanSilentSensors(),
  },

  /**
   * CDC §8 — surveillance des recommandations actives.
   *
   * Compare les nouvelles mesures **et les prévisions** aux seuils de chaque
   * recommandation `ACTIVE`, crée une alerte par paramètre et par épisode,
   * notifie (email obligatoire, SMS principal), puis recalcule une proposition
   * pour la période restante. Celle-ci reste `PENDING` : l'ancienne
   * recommandation demeure active jusqu'à acceptation explicite.
   */
  'recommendations.monitor': {
    description:
      'Compare mesures et prévisions aux seuils des recommandations actives, alerte et propose un recalcul',
    intervalMs: 60 * 60 * 1000,
    run: async () => runMonitoring(),
  },

  /**
   * Acquisition satellite planifiée.
   *
   * N'interroge que les parcelles **sans sonde** : le satellite complète les
   * zones non couvertes, il ne double pas une mesure existante. La cadence est
   * celle du sondage fournisseur (`SATELLITE_REFRESH_HOURS`), distincte de la
   * période de revisite du satellite.
   */
  'satellite.acquire': {
    description:
      'Acquiert une scène satellite pour les parcelles sans sonde (radar Sentinel-1 en tête)',
    intervalMs: env.SATELLITE_REFRESH_HOURS * 60 * 60 * 1000,
    run: async () => runSatelliteAcquisition(),
  },

  /**
   * Détection d'anomalies sur les mesures de sonde.
   *
   * Un capteur silencieux reste traité par `iot.markSilent` dans `ThresholdAlert`
   * : c'est l'absence de mesure. Ce job couvre les valeurs aberrantes et figées,
   * qui sont **écartées du calcul** tant qu'un agronome ne les a pas réhabilitées.
   * Les seuils sont provisoires — voir `hardware.anomalies`.
   */
  'sensors.detectAnomalies': {
    description:
      'Détecte valeurs aberrantes et capteurs figés, et écarte les mesures signalées du calcul',
    intervalMs: 6 * 60 * 60 * 1000,
    run: async () => runAnomalyDetection(),
  },

  /**
   * Escalade des alertes non traitées vers le rôle d'encadrement.
   *
   * Intervalle plus court que le délai d'escalade : une tâche qui tournerait
   * moins souvent que le délai ajouterait jusqu'à un intervalle entier de retard
   * à chaque escalade. 15 minutes pour un délai de 120 par défaut.
   */
  'alerts.escalate': {
    description:
      'Fait remonter au rôle d’encadrement les alertes non traitées au-delà du délai configuré',
    intervalMs: 15 * 60 * 1000,
    run: async () => escaladerAlertes(),
  },
};

/** Statistiques d'exécution en mémoire (exposées à l'administration). */
const stats = new Map();
const running = new Set();
/**
 * Tâches en pause (M5 U-M5-2 : pause/reprise, palier 2 côté route).
 * Une tâche en pause n'est ni planifiée ni déclençable manuellement tant
 * qu'elle n'est pas reprise — l'oubli d'une pause est visible dans
 * `listJobs()` et dans les alertes de supervision.
 */
const paused = new Set();

/** Seuil d'alerte : après N échecs consécutifs, les administrateurs sont notifiés (U-M5-4). */
const JOB_ALERT_FAILURES = Number(process.env.JOB_ALERT_FAILURES ?? 3);

export const listJobs = () =>
  Object.entries(JOBS).map(([name, job]) => {
    const s = stats.get(name);
    const estPause = paused.has(name);
    // Prochaine échéance estimée = dernier passage + cadence (le planificateur
    // est un intervalle, pas un cron : aucune date n'est stockée côté timer).
    const nextRunAt =
      !estPause && s?.lastRunAt ? new Date(new Date(s.lastRunAt).getTime() + job.intervalMs).toISOString() : null;
    return {
      name,
      description: job.description,
      intervalMs: job.intervalMs,
      intervalHuman: `${Math.round(job.intervalMs / 60000)} min`,
      lastRunAt: s?.lastRunAt ?? null,
      lastDurationMs: s?.lastDurationMs ?? null,
      lastOk: s?.lastOk ?? null,
      lastError: s?.lastError ?? null,
      lastResult: s?.lastResult ?? null,
      consecutiveFailures: s?.consecutiveFailures ?? 0,
      paused: estPause,
      nextRunAt,
      running: running.has(name),
    };
  });

/**
 * Exécute une tâche à la demande (cron ou administration).
 * Un nom inconnu renvoie `null` : l'appelant décide du statut HTTP.
 * Un déclenchement manuel est **audité** (`admin.job.run`) avec l'acteur et
 * le motif (RG-M5-2). Une tâche en pause ou déjà en cours est signalée par
 * `skipped` — jamais exécutée deux fois en parallèle (verrou `running`).
 */
export const runJob = async (name, { actorId = null, req = null, reason = null } = {}) => {
  const job = JOBS[name];
  if (!job) return null;
  if (paused.has(name)) {
    return { skipped: true, reason: 'Tâche en pause — reprends-la avant de la déclencher' };
  }
  if (running.has(name)) return { skipped: true, reason: 'déjà en cours' };

  running.add(name);
  const startedAt = Date.now();
  try {
    const result = await job.run();

    if (actorId) {
      await audit({
        actorId,
        action: 'admin.job.run',
        resource: 'jobs',
        resourceId: name,
        req,
        newValue: { manual: true, reason, result: result ?? null },
      });
    }

    stats.set(name, {
      lastRunAt: new Date().toISOString(),
      lastDurationMs: Date.now() - startedAt,
      lastOk: true,
      lastError: null,
      lastResult: result ?? null,
      consecutiveFailures: 0,
    });
    logger.info(`[job] ${name} terminé en ${Date.now() - startedAt} ms`, result ?? {});
    return { ok: true, name, durationMs: Date.now() - startedAt, result };
  } catch (error) {
    // U-M5-4 : un job en erreur ×N fait l'objet d'une alerte notifiée aux
    // administrateurs (déduction par jour et par tâche, jamais de bourrage).
    const echecs = (stats.get(name)?.consecutiveFailures ?? 0) + 1;
    stats.set(name, {
      lastRunAt: new Date().toISOString(),
      lastDurationMs: Date.now() - startedAt,
      lastOk: false,
      lastError: error.message,
      lastResult: null,
      consecutiveFailures: echecs,
    });
    logger.error(`[job] ${name} en échec : ${error.message}`);
    if (echecs >= JOB_ALERT_FAILURES) {
      const jour = new Date().toISOString().slice(0, 10);
      await notifyModerators({
        type: 'JOB_FAILURE',
        title: `Tâche ${name} en échec (${echecs} de suite)`,
        body: `La tâche planifiée « ${name} » a échoué ${echecs} fois consécutives : ${error.message}`,
        payload: { job: name, consecutiveFailures: echecs },
        dedupeKey: `job-failure:${name}:${jour}`,
      }).catch(() => {});
    }
    throw error;
  } finally {
    running.delete(name);
  }
};

/**
 * M5 U-M5-2 — pause / reprise d'une tâche (routes palier 2, auditées côté
 * module admin). Le nom inconnu renvoie `null`, comme `runJob`.
 */
export const pauseJob = (name) => {
  if (!JOBS[name]) return null;
  paused.add(name);
  return { name, paused: true };
};

export const resumeJob = (name) => {
  if (!JOBS[name]) return null;
  paused.delete(name);
  return { name, paused: false };
};

export const runAll = async () => {
  const results = [];
  for (const name of Object.keys(JOBS)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      results.push(await runJob(name));
    } catch (error) {
      results.push({ ok: false, name, error: error.message });
    }
  }
  return results;
};

const timers = [];

/**
 * Démarre le planificateur. Désactivable par `JOBS_ENABLED=false`
 * (utile en test ou pour un déploiement « worker » séparé).
 */
export const startScheduler = ({ initialDelayMs = 15_000 } = {}) => {
  if (String(env.JOBS_ENABLED ?? process.env.JOBS_ENABLED ?? 'true') === 'false') {
    logger.info('[jobs] planificateur désactivé (JOBS_ENABLED=false)');
    return { started: false, reason: 'JOBS_ENABLED=false' };
  }

  for (const [name, job] of Object.entries(JOBS)) {
    // Premier passage différé : ne pas concurrencer le démarrage HTTP.
    const initial = setTimeout(() => {
      runJob(name).catch(() => {});
    }, initialDelayMs);
    initial.unref?.();
    timers.push(initial);

    const timer = setInterval(() => {
      runJob(name).catch(() => {});
    }, job.intervalMs);
    timer.unref?.();
    timers.push(timer);
  }

  logger.info(`[jobs] planificateur démarré : ${Object.keys(JOBS).length} tâche(s)`);
  return { started: true, jobs: Object.keys(JOBS), initialDelayMs };
};

export const stopScheduler = () => {
  while (timers.length) {
    const timer = timers.pop();
    clearTimeout(timer);
    clearInterval(timer);
  }
};

export const schedulerStatus = () => ({
  enabled: String(env.JOBS_ENABLED ?? 'true') !== 'false',
  scheduled: timers.length / 2,
  jobs: listJobs(),
});
