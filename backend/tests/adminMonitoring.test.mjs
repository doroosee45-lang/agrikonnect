/**
 * SPEC-SUPER-ADMIN M5 — supervision (unitaire).
 *
 * Ce que garantit ce test :
 *   1. `servicesState()` réévalue `evaluerServicesExternes` **en direct** avec
 *      la même configuration que `server.js` (RG-M5-1) ;
 *   2. `healthState()` expose uptime, DB (connexion + latence), stockage,
 *      temps réel, usage API et compteurs de jobs (U-M5-3) ;
 *   3. `supervisionAlerts()` remonte services dégradés, jobs en erreur et
 *      jobs en pause (U-M5-4) ;
 *   4. pause/reprise : une tâche en pause n'est **jamais** exécutée (U-M5-2) ;
 *   5. le déclenchement manuel est audité `admin.job.run` avec le motif, un
 *      nom inconnu lève 404, et le verrou interdit toute double exécution
 *      (RG-M5-2) ;
 *   6. `runJobSchema` valide le motif (§10) sans le rendre obligatoire.
 */
import './helpers/pinTestEnv.mjs';

import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/config/prisma.js';
import * as service from '../src/modules/admin/admin.monitoring.service.js';
import { runJobSchema, jobNameParam } from '../src/modules/admin/admin.monitoring.schema.js';
import {
  JOBS,
  listJobs,
  pauseJob,
  resumeJob,
  runJob,
  schedulerStatus,
} from '../src/jobs/index.js';
import { evaluerServicesExternes } from '../src/shared/startup/degradedServices.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';

const acteur = (roles = ['ADMIN']) => ({
  user: {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'm5@agrikonnect.test',
    roles,
    profile: { id: '22222222-2222-4222-8222-222222222222', mfaEnabled: true },
  },
  headers: { 'user-agent': 'test-m5', 'x-forwarded-for': '127.0.0.1' },
  ip: '127.0.0.1',
});

const monter = (initial = {}) =>
  withFakePrisma(prisma, {
    setting: [],
    auditLog: [],
    apiUsage: [],
    resourceUsage: [],
    notification: [],
    membership: [],
    profile: [],
    listing: [],
    order: [],
    orderEvent: [],
    dataRoomAccessRequest: [],
    dataRoomAccessLog: [],
    apiKey: [],
    dispute: [],
    ...initial,
  });

/** Garde-fou : aucune tâche laissée en pause d'un test à l'autre. */
const reprendreTout = () => {
  for (const name of Object.keys(JOBS)) resumeJob(name);
};

/* ═══════════════ 1. Services externes (RG-M5-1) ═══════════════ */

test('servicesState : évaluation en direct, identique au rapport de démarrage', () => {
  // Configuration de test déterministe : clé MFA absente → le finding `mfa`
  // décrit la clé dérivée (lecture à l'appel, `servicesCfg`).
  delete process.env.MFA_ENCRYPTION_KEY;

  const etat = service.servicesState();
  const attendus = evaluerServicesExternes(service.servicesCfg());

  assert.ok(etat.generatedAt);
  assert.deepEqual(
    etat.services.map((f) => f.service),
    attendus.map((f) => f.service),
    'mêmes services que `evaluerServicesExternes` (miroir de server.js)',
  );
  assert.deepEqual(etat.services, attendus, 'findings identiques (cause + marche à suivre)');
  assert.equal(etat.summary.total, attendus.length);
  assert.equal(
    etat.summary.ok + etat.summary.degrade + etat.summary.incomplet,
    attendus.length,
    'somme des niveaux = total',
  );

  // U-M5-1 : les services nommés par la spec sont tous couverts.
  const noms = etat.services.map((f) => f.service);
  for (const attendu of ['sms', 'email', 'satellite', 'capteurs', 'geospatial', 'mfa', 'geoai']) {
    assert.ok(noms.includes(attendu), `service « ${attendu} » présent`);
  }
  for (const f of etat.services) {
    assert.ok(f.mode, 'mode déclaré');
    assert.ok(f.consequence.length > 10, 'conséquence explicite (pas seulement « démo »)');
    if (f.niveau !== 'ok') assert.ok(f.pourRetablir, 'marche à suivre fournie');
  }
});

/* ═══════════════ 2. Santé technique (U-M5-3) ═══════════════ */

test('healthState : DB, stockage, temps réel, usage API et jobs', async () => {
  const { restore } = await monter({
    setting: [{ key: 'platform.name', value: 'X', updatedAt: new Date() }],
    apiUsage: [
      { id: 'u1', clientId: 'c1', route: '/api/v1/farms', status: 200, at: new Date() },
      { id: 'u2', clientId: 'c1', route: '/api/v1/farms', status: 200, at: new Date() },
      { id: 'u3', clientId: 'c1', route: '/api/v1/listings', status: 404, at: new Date() },
      { id: 'u4', clientId: 'c1', route: '/api/v1/old', status: 200, at: new Date('2020-01-01') },
    ],
    resourceUsage: [
      { id: 'r1', organizationId: 'o1', resource: 'GEOSPATIAL_IMPORT', usedBytes: 512, updatedAt: new Date() },
    ],
  });
  try {
    const sante = await service.healthState();

    assert.ok(sante.api.uptimeSeconds >= 0);
    assert.equal(sante.api.node, process.version);
    assert.equal(sante.database.ok, true, 'sonde DB : connexion OK');
    assert.equal(typeof sante.database.latencyMs, 'number');
    assert.equal(sante.storage.writable !== undefined, true, 'sonde stockage présente');
    assert.equal(typeof sante.realtime.connections, 'number', 'connexions Socket.IO (bus)');
    assert.equal(sante.usage.apiCalls24h, 3, '3 appels sur 24 h (la ligne de 2020 est hors fenêtre)');
    assert.equal(sante.usage.topRoutes24h[0].route, '/api/v1/farms');
    assert.equal(sante.usage.topRoutes24h[0].calls, 2);
    assert.equal(sante.usage.resourceBytes, 512);
    assert.equal(sante.jobs.total, Object.keys(JOBS).length);
    assert.ok(Array.isArray(sante.alerts));
  } finally {
    restore();
    reprendreTout();
  }
});

/* ═══════════════ 3. Alertes (U-M5-4) ═══════════════ */

test('supervisionAlerts : services dégradés, jobs en erreur, jobs en pause', async () => {
  const { restore } = await monter();
  try {
    // Job en échec ×3 (seuil d'alerte) : sabotage ciblé de la tâche listings.expire.
    const original = prisma.listing.updateMany;
    prisma.listing.updateMany = async () => {
      throw new Error('panne simulée listings');
    };
    try {
      for (let i = 0; i < 3; i += 1) {
        await assert.rejects(() => runJob('listings.expire'), /panne simulée/);
      }
    } finally {
      prisma.listing.updateMany = original;
    }

    pauseJob('notifications.purge');

    const alertes = service.supervisionAlerts();
    const services = alertes.filter((a) => a.type === 'service_degraded');
    assert.ok(services.length >= 1, 'services dégradés visibles');
    assert.ok(services.every((a) => a.message && a.severity));

    const enErreur = alertes.find((a) => a.service === 'listings.expire' && a.type === 'job_failing');
    assert.ok(enErreur, 'job avec 3 échecs consécutifs → alerte `job_failing`');
    assert.equal(enErreur.severity, 'error');

    const enPause = alertes.find((a) => a.type === 'job_paused' && a.service === 'notifications.purge');
    assert.ok(enPause, 'job en pause signalé (oubli visible)');
  } finally {
    reprendreTout();
    restore();
  }
});

/* ═══════════════ 4. Pause / reprise (U-M5-2) ═══════════════ */

test('pause/reprise : une tâche en pause n’est jamais exécutée', async () => {
  const { fake, restore } = await monter();
  try {
    const nom = 'notifications.purge';
    assert.deepEqual(pauseJob(nom), { name: nom, paused: true });
    assert.equal(pauseJob('tâche.inconnue'), null, 'nom inconnu → null');

    const liste = listJobs().find((j) => j.name === nom);
    assert.equal(liste.paused, true);
    assert.equal(liste.nextRunAt, null, 'pas de prochaine échéance en pause');

    const outcome = await runJob(nom, { actorId: 'a', req: acteur() });
    assert.equal(outcome.skipped, true);
    assert.match(outcome.reason, /pause/);

    resumeJob(nom);
    const repris = await runJob(nom);
    assert.equal(repris.ok, true, 'reprise effective : la tâche repart');

    // journal d'absence d'écriture pendant la pause : l'appel ignoré n'audite rien
    assert.equal(fake._store.auditLog.length, 0);
  } finally {
    reprendreTout();
    restore();
  }
});

/* ═══════════════ 5. Déclenchement manuel + verrou (RG-M5-2) ═══════════════ */

test('runJobManually : audit `admin.job.run` avec motif, 404 si inconnu', async () => {
  const { fake, restore } = await monter();
  try {
    const outcome = await service.runJobManually('notifications.purge', { reason: 'purge demandée' }, acteur());
    assert.equal(outcome.ok, true);

    const ligne = fake._store.auditLog[0];
    assert.equal(ligne.action, 'admin.job.run');
    assert.equal(ligne.resource, 'jobs');
    assert.equal(ligne.resourceId, 'notifications.purge');
    assert.equal(ligne.newValue.manual, true);
    assert.equal(ligne.newValue.reason, 'purge demandée');

    await assert.rejects(
      () => service.runJobManually('tâche.inconnue', {}, acteur()),
      (e) => e.status === 404 && e.code === 'NOT_FOUND',
    );
  } finally {
    reprendreTout();
    restore();
  }
});

test('RG-M5-2 : verrou — jamais deux exécutions simultanées du même job', async () => {
  const { restore } = await monter();
  try {
    let liberer;
    const barriere = new Promise((resolve) => {
      liberer = resolve;
    });
    const original = prisma.listing.updateMany;
    prisma.listing.updateMany = async () => {
      await barriere;
      return { count: 0 };
    };
    try {
      const premiere = runJob('listings.expire');
      const seconde = await runJob('listings.expire');
      assert.equal(seconde.skipped, true);
      assert.match(seconde.reason, /en cours/);
      liberer();
      const resultat = await premiere;
      assert.equal(resultat.ok, true);
    } finally {
      prisma.listing.updateMany = original;
    }
  } finally {
    reprendreTout();
    restore();
  }
});

test('jobsView : cadence, dernier passage et prochaine échéance', async () => {
  const { restore } = await monter();
  try {
    const avant = Date.now();
    await runJob('listings.expire');
    const vue = service.jobsView();
    assert.equal(typeof vue.enabled, 'boolean');
    assert.equal(vue.jobs.length, Object.keys(JOBS).length);

    const entry = vue.jobs.find((j) => j.name === 'listings.expire');
    assert.ok(entry.lastRunAt, 'dernier passage remonté');
    assert.equal(entry.lastOk, true);
    assert.equal(entry.consecutiveFailures, 0);
    const next = new Date(entry.nextRunAt).getTime();
    assert.ok(next >= avant + entry.intervalMs - 1000, 'prochaine échéance = dernier passage + cadence');

    assert.equal(schedulerStatus().jobs.length, Object.keys(JOBS).length);
  } finally {
    reprendreTout();
    restore();
  }
});

/* ═══════════════ 6. Schémas (§10) ═══════════════ */

test('runJobSchema : motif validé mais facultatif ; jobNameParam borne le nom', () => {
  assert.ok(runJobSchema.safeParse(undefined).success, 'corps absent accepté');
  assert.ok(runJobSchema.safeParse({}).success);
  assert.ok(runJobSchema.safeParse({ reason: 'maintenance planifiée' }).success);
  assert.ok(!runJobSchema.safeParse({ reason: 'ab' }).success, 'motif trop court refusé');
  assert.ok(!runJobSchema.safeParse({ reason: 'x'.repeat(201) }).success, 'motif trop long refusé');

  assert.ok(jobNameParam.safeParse({ name: 'notifications.purge' }).success);
  assert.ok(!jobNameParam.safeParse({ name: 'ab' }).success);
});
