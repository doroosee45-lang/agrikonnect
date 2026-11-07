/**
 * SPEC-SUPER-ADMIN M5 — Supervision et contrôle des modules et services (§3).
 *
 * RG-M5-1 : l'état affiché est **toujours lu en direct** — aucune copie du
 * rapport de démarrage n'est stockée ; `servicesState()` réévalue
 * `evaluerServicesExternes` à chaque appel, avec la même configuration que
 * `server.js` (miroir strict du bloc `evaluerServicesExternes({...})`).
 *
 * RG-M5-2 : le déclenchement manuel d'une tâche est audité (`admin.job.run`)
 * et verrouillé (jamais deux exécutions simultanées — `jobs/index.js`).
 */
import fs from 'node:fs';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { hardware } from '../../config/hardware.js';
import { logger } from '../../shared/http/logger.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { auditAs } from '../../shared/audit.js';
import { evaluerServicesExternes } from '../../shared/startup/degradedServices.js';
import { realtimeStats } from '../../realtime/bus.js';
import {
  listJobs,
  pauseJob,
  resumeJob,
  runJob,
  schedulerStatus,
} from '../../jobs/index.js';

/** Seuil U-M5-4 : un job en échec au-delà de ce nombre d'échecs consécutifs alerte. */
const JOB_ALERT_FAILURES = Number(process.env.JOB_ALERT_FAILURES ?? 3);

/**
 * Configuration des services externes — **miroir exact** de celle construite
 * dans `server.js` au démarrage. Le jour où le démarrage ajoute un champ, ce
 * bloc doit suivre (test de fumée : `servicesState()` renvoie les mêmes
 * services que le rapport de démarrage).
 */
export const servicesCfg = () => ({
  NODE_ENV: env.NODE_ENV,
  SMS_PROVIDER: env.SMS_PROVIDER,
  TWILIO_ACCOUNT_SID: env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: env.TWILIO_AUTH_TOKEN,
  EMAIL_PROVIDER: env.EMAIL_PROVIDER,
  EMAIL_API_KEY: env.EMAIL_API_KEY,
  SATELLITE_PROVIDER: env.SATELLITE_PROVIDER,
  SATELLITE_API_KEY: env.SATELLITE_API_KEY,
  GEOAI_URL: env.GEOAI_URL,
  GEOSPATIAL_STORAGE_DRIVER: env.GEOSPATIAL_STORAGE_DRIVER,
  GEOSPATIAL_STORAGE_DIR: env.GEOSPATIAL_STORAGE_DIR,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  simulationAllowed: hardware.simulationAllowed,
  hardwareMode: hardware.mode,
  /* Même normalisation que `resolveEncryptionMaterial` : une chaîne vide n'est pas `null`. */
  mfaKeyFournie: Boolean((process.env.MFA_ENCRYPTION_KEY ?? '').trim()),
});

/**
 * U-M5-1 — état **en direct** de chaque service externe : SMS (fournisseur,
 * mode réel/console), e-mail, satellite, capteurs (simulation/réel), stockage
 * géospatial, MFA (clé dérivée ou clé propre). Repris du rapport de
 * démarrage (`degradedServices`), avec la cause et la marche à suivre.
 */
export const servicesState = () => {
  const services = evaluerServicesExternes(servicesCfg());
  return {
    generatedAt: new Date().toISOString(),
    source: 'evaluerServicesExternes — réévalué à chaque appel (RG-M5-1)',
    summary: {
      total: services.length,
      ok: services.filter((f) => f.niveau === 'ok').length,
      degrade: services.filter((f) => f.niveau === 'degrade').length,
      incomplet: services.filter((f) => f.niveau === 'incomplet').length,
    },
    services,
  };
};

/** Sonde base de données : connexion + latence (requête la plus légère possible). */
const dbProbe = async () => {
  const startedAt = Date.now();
  try {
    await prisma.setting.findFirst({ select: { key: true } });
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - startedAt, error: error.message };
  }
};

/** Sonde stockage : répertoire géospatial accessible en écriture + espace libre. */
const storageProbe = () => {
  const dir = env.GEOSPATIAL_STORAGE_DIR ?? './storage/geospatial';
  const out = { driver: env.GEOSPATIAL_STORAGE_DRIVER ?? 'local', dir, writable: false, freeBytes: null, totalBytes: null };
  try {
    fs.accessSync(dir, fs.constants.W_OK);
    out.writable = true;
  } catch (error) {
    out.error = error.message;
  }
  try {
    // Node ≥ 18.15 : espace libre du volume hébergeant le répertoire.
    const stat = fs.statfsSync(dir);
    out.freeBytes = Number(stat.bavail) * Number(stat.bsize);
    out.totalBytes = Number(stat.blocks) * Number(stat.bsize);
  } catch {
    /* statfs indisponible sur certains systèmes : laissons null, jamais inventé */
  }
  return out;
};

/** Comptage d'usage API sur 24 h (top routes inclus — réduit côté serveur). */
const usageProbe = async () => {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [apiCalls24h, lignes, resourceUsages] = await Promise.all([
    prisma.apiUsage.count({ where: { at: { gte: since } } }),
    prisma.apiUsage.findMany({ where: { at: { gte: since } }, select: { route: true, status: true }, take: 500 }),
    prisma.resourceUsage.findMany({ select: { resource: true, usedBytes: true }, take: 500 }),
  ]);
  const parRoute = new Map();
  for (const l of lignes) parRoute.set(l.route, (parRoute.get(l.route) ?? 0) + 1);
  return {
    apiCalls24h,
    topRoutes24h: [...parRoute.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([route, calls]) => ({ route, calls })),
    resourceBytes: resourceUsages.reduce((acc, r) => acc + Number(r.usedBytes ?? 0), 0),
    sampleCappedAt: 500,
  };
};

/**
 * U-M5-4 — alertes de supervision calculées en direct : services dégradés,
 * jobs en erreur consécutive (≥ seuil), jobs en pause (oubli visible).
 */
export const supervisionAlerts = () => {
  const alerts = [];
  for (const f of evaluerServicesExternes(servicesCfg())) {
    if (f.niveau !== 'ok') {
      alerts.push({
        type: 'service_degraded',
        severity: f.niveau === 'degrade' ? 'warning' : 'error',
        service: f.service,
        mode: f.mode,
        message: f.consequence,
        howToFix: f.pourRetablir ?? null,
      });
    }
  }
  for (const job of listJobs()) {
    if (job.lastOk === false && job.consecutiveFailures >= JOB_ALERT_FAILURES) {
      alerts.push({
        type: 'job_failing',
        severity: 'error',
        service: job.name,
        mode: `${job.consecutiveFailures} échecs consécutifs`,
        message: job.lastError ?? 'Échec répété',
        howToFix: 'Consulte les journaux du backend, corrige puis déclenche la tâche manuellement.',
      });
    } else if (job.lastOk === false) {
      alerts.push({
        type: 'job_error',
        severity: 'warning',
        service: job.name,
        mode: `${job.consecutiveFailures} échec(s) consécutif(s)`,
        message: job.lastError ?? 'Dernier passage en échec',
        howToFix: null,
      });
    }
    if (job.paused) {
      alerts.push({
        type: 'job_paused',
        severity: 'warning',
        service: job.name,
        mode: 'en pause',
        message: `La tâche « ${job.name} » est en pause : elle ne s'exécutera ni à la cadence ni manuellement.`,
        howToFix: 'Reprends la tâche depuis la console des jobs.',
      });
    }
  }
  return alerts;
};

/**
 * U-M5-3 — santé technique : uptime API, base de données (connexion, latence),
 * stockage, connectivité temps réel (Socket.IO), compteurs d'usage API.
 */
export const healthState = async () => {
  const [database, usage] = await Promise.all([dbProbe(), usageProbe()]);
  const jobs = listJobs();
  return {
    generatedAt: new Date().toISOString(),
    api: {
      uptimeSeconds: Math.round(process.uptime()),
      node: process.version,
      environment: env.NODE_ENV,
    },
    database,
    storage: storageProbe(),
    realtime: { ...realtimeStats(), path: '/realtime' },
    usage,
    jobs: {
      total: jobs.length,
      running: jobs.filter((j) => j.running).length,
      paused: jobs.filter((j) => j.paused).length,
      inError: jobs.filter((j) => j.lastOk === false).length,
    },
    alerts: supervisionAlerts(),
  };
};

/** Vue console des jobs (M5 U-M5-2) — état, cadence, dernier passage, prochaine échéance. */
export const jobsView = () => schedulerStatus();

/**
 * U-M5-2 / RG-M5-2 — déclenchement manuel d'une tâche : exécution réelle,
 * audit `admin.job.run` (acteur + motif), verrou anti double-exécution.
 * Un nom inconnu lève 404 ; une tâche en pause ou déjà en cours est signalée
 * par `skipped` sans jamais être lancée.
 */
export const runJobManually = async (name, { reason } = {}, req) => {
  const outcome = await runJob(name, { actorId: req.user.id, req, reason: reason ?? null });
  if (outcome === null) throw ApiError.notFound(`Tâche inconnue : ${name}`);
  if (outcome.skipped) logger.warn(`[admin] ${name} non déclenchée : ${outcome.reason}`);
  return outcome;
};

/**
 * U-M5-2 — pause / reprise (palier 2) : la tâche est retirée/replacée dans le
 * circuit d'exécution, l'action est auditée (`admin.job.pause`/`resume`).
 */
export const pauseJobByName = async (name, req) => {
  const outcome = pauseJob(name);
  if (outcome === null) throw ApiError.notFound(`Tâche inconnue : ${name}`);
  await auditAs(req, {
    action: 'admin.job.pause',
    resource: 'jobs',
    resourceId: name,
    newValue: { paused: true },
  });
  return { ...outcome, jobs: listJobs().filter((j) => j.name === name) };
};

export const resumeJobByName = async (name, req) => {
  const outcome = resumeJob(name);
  if (outcome === null) throw ApiError.notFound(`Tâche inconnue : ${name}`);
  await auditAs(req, {
    action: 'admin.job.resume',
    resource: 'jobs',
    resourceId: name,
    newValue: { paused: false },
  });
  return { ...outcome, jobs: listJobs().filter((j) => j.name === name) };
};
