import { createApp } from './app.js';
import { attachRealtime } from './realtime/index.js';
import { startScheduler, stopScheduler } from './jobs/index.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { logger } from './shared/http/logger.js';
import {
  evaluerServicesExternes,
  formaterRapport,
} from './shared/startup/degradedServices.js';
import {
  HARDWARE_CONFIG_REVISED_AT,
  HARDWARE_CONFIG_VERSION,
  assertHardwareConfigReady,
  hardware,
  pendingConfirmations,
} from './config/hardware.js';

/**
 * Garde de démarrage matériel.
 *
 * Vérifiée **avant** d'ouvrir le port : un serveur qui écoute alors que sa
 * configuration matériel est incomplète accepterait des mesures qu'il ne sait
 * pas interpréter.
 *
 *  • mode `SIMULATION` en production → arrêt (aucune donnée générée ne doit
 *    entrer en base de production) ;
 *  • mode `REAL` avec des champs obligatoires manquants → arrêt, avec la liste
 *    exacte de ce qui manque.
 */
try {
  const { mode } = assertHardwareConfigReady({ isProd: env.isProd });
  const pending = pendingConfirmations();
  logger.info(
    `Configuration matériel v${HARDWARE_CONFIG_VERSION} (révisée le ${HARDWARE_CONFIG_REVISED_AT}) — `
    + `mode ${mode}, ${pending.length} valeur(s) à confirmer.`,
  );
} catch (error) {
  logger.error(`\n${error.message}\n`);
  process.exit(1);
}

const app = createApp();

/**
 * État des services externes.
 *
 * Affiché **avant** l'ouverture du port : un opérateur qui découvre l'URL dans
 * ses journaux doit savoir dans la foulée que les SMS et les e-mails ne partent
 * pas. `logger.warn` plutôt que `info` — ces lignes doivent survivre à un
 * `LOG_LEVEL=warn`.
 */
const rapportServices = evaluerServicesExternes({
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
  /*
   * Même normalisation que `resolveEncryptionMaterial` : `.env.example` livre
   * `MFA_ENCRYPTION_KEY=` **vide**, et une chaîne vide n'est pas `null`.
   */
  mfaKeyFournie: Boolean((process.env.MFA_ENCRYPTION_KEY ?? '').trim()),
});
const rapportFormate = formaterRapport(rapportServices);
if (rapportFormate) {
  const degrades = rapportServices.filter((f) => f.niveau !== 'ok');
  if (env.isProd) {
    logger.error(rapportFormate);
  } else {
    logger.warn(rapportFormate);
  }
  if (degrades.length > 0) {
    logger.warn(
      `Démarrage local sans service externe : ${degrades.map((f) => f.service).join(', ')}. `
      + 'Voir LISEZMOI-DEMARRAGE.md §4.',
    );
  }
}

const server = app.listen(env.PORT, '0.0.0.0', () => {
  logger.info(`AGRIKONNECT API démarrée sur http://localhost:${env.PORT}${env.apiPrefix} (${env.NODE_ENV})`);
});

/**
 * Temps réel (V2 §8.7) : Socket.IO partage le serveur HTTP, sur le chemin
 * `/realtime`. La clé est un jeton Supabase passé dans `auth.token`.
 */
const io = env.REALTIME_ENABLED === 'false' ? null : attachRealtime(server);

/** Tâches planifiées (expirations, SLO, purges) — voir `src/jobs/index.js`. */
startScheduler();

/** Arrêt propre : on cesse d'accepter des requêtes, puis on ferme la base. */
const shutdown = async (signal) => {
  logger.warn(`${signal} reçu — arrêt en cours…`);

  stopScheduler();
  io?.close();
  server.close(async () => {
    try {
      await prisma.$disconnect();
      logger.info('Connexions fermées. Bye 👋');
      process.exit(0);
    } catch (error) {
      logger.error('Erreur lors de l\'arrêt :', error);
      process.exit(1);
    }
  });

  // Filet de sécurité si des connexions traînent.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error('UnhandledRejection :', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('UncaughtException :', error);
  shutdown('uncaughtException');
});

export { app, server };
