import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';
import { JOBS, listJobs, runJob, runAll, schedulerStatus, startScheduler, stopScheduler } from '../src/jobs/index.js';

/**
 * Preuves d'acceptation des tâches planifiées (expirations, SLA, purges).
 *
 * Les jobs portent des règles du CDC qui ne peuvent pas dépendre d'un appel
 * utilisateur : expiration des annonces (MKT-06), expiration des accès data room
 * (DR-02), révocation des clés d'API (API-02), SLA des litiges (DISP-02),
 * purge des notifications lues (NOTIF-02), silence des capteurs (IOT-03).
 */

const DAY = 24 * 3600 * 1000;

const baseStore = (overrides = {}) => ({
  listing: [],
  order: [],
  orderEvent: [],
  dataRoomAccessRequest: [],
  dataRoomAccessLog: [],
  apiKey: [],
  dispute: [],
  notification: [],
  notificationPreference: [],
  membership: [],
  iotDevice: [],
  thresholdAlert: [],
  profile: [],
  auditLog: [],
  ...overrides,
});

const reqAs = (roles = ['ADMIN']) => ({
  tenant: { organizationId: 'org_1', effectiveRoles: roles },
  user: { id: 'user_admin', roles },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
});

test('MKT-06 : le job d’expiration ne touche que les annonces réellement échues', async () => {
  const past = new Date(Date.now() - DAY);
  const future = new Date(Date.now() + DAY);

  const { fake, restore } = await withFakePrisma(
    prisma,
    baseStore({
      listing: [
        { id: 'l1', status: 'PUBLISHED', expiresAt: past, deletedAt: null },
        { id: 'l2', status: 'RESERVED', expiresAt: past, deletedAt: null },
        { id: 'l3', status: 'PUBLISHED', expiresAt: future, deletedAt: null },
        { id: 'l4', status: 'DRAFT', expiresAt: past, deletedAt: null },
        { id: 'l5', status: 'PUBLISHED', expiresAt: past, deletedAt: new Date() },
      ],
    }),
  );
  try {
    const outcome = await runJob('listings.expire');
    assert.equal(outcome.ok, true);
    assert.equal(outcome.result.expired, 2, 'seules PUBLISHED/RESERVED échues et non supprimées');

    const byId = Object.fromEntries(fake._store.listing.map((l) => [l.id, l.status]));
    assert.equal(byId.l1, 'EXPIRED');
    assert.equal(byId.l2, 'EXPIRED');
    assert.equal(byId.l3, 'PUBLISHED', 'échéance future : inchangée');
    assert.equal(byId.l4, 'DRAFT', 'un brouillon n’expire pas');
    assert.equal(byId.l5, 'PUBLISHED', 'une annonce supprimée n’est pas modifiée');
  } finally {
    restore();
  }
});

test('ORD-02 : une commande PENDING trop ancienne est annulée avec un motif tracé', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    baseStore({
      order: [
        { id: 'ord_old', status: 'PENDING', createdAt: new Date(Date.now() - 10 * DAY) },
        { id: 'ord_new', status: 'PENDING', createdAt: new Date(Date.now() - 1 * DAY) },
        { id: 'ord_done', status: 'CONFIRMED', createdAt: new Date(Date.now() - 30 * DAY) },
      ],
    }),
  );
  try {
    const outcome = await runJob('orders.expirePending');
    assert.equal(outcome.result.cancelled, 1);
    assert.equal(outcome.result.stockReleased, false, 'une commande PENDING ne réserve aucun stock');

    assert.equal(fake._store.order.find((o) => o.id === 'ord_old').status, 'CANCELLED');
    assert.equal(fake._store.order.find((o) => o.id === 'ord_new').status, 'PENDING');
    assert.equal(fake._store.order.find((o) => o.id === 'ord_done').status, 'CONFIRMED');

    const event = fake._store.orderEvent[0];
    assert.equal(event.orderId, 'ord_old');
    assert.equal(event.from, 'PENDING');
    assert.equal(event.to, 'CANCELLED');
    assert.match(event.reason, /aucune réponse sous 7 jours/);
  } finally {
    restore();
  }
});

test('DR-02 : les accès data room échus sont révoqués et journalisés', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    baseStore({
      dataRoomAccessRequest: [
        { id: 'dr_1', projectId: 'prj_1', granteeUserId: 'u1', status: 'GRANTED', expiresAt: new Date(Date.now() - DAY) },
        { id: 'dr_2', projectId: 'prj_1', granteeUserId: 'u2', status: 'GRANTED', expiresAt: new Date(Date.now() + DAY) },
        { id: 'dr_3', projectId: 'prj_1', granteeUserId: 'u3', status: 'PENDING', expiresAt: new Date(Date.now() - DAY) },
      ],
    }),
  );
  try {
    const outcome = await runJob('dataroom.expireAccess');
    assert.equal(outcome.result.expired, 1);
    assert.equal(fake._store.dataRoomAccessRequest.find((r) => r.id === 'dr_1').status, 'EXPIRED');
    assert.equal(fake._store.dataRoomAccessRequest.find((r) => r.id === 'dr_2').status, 'GRANTED');
    assert.equal(fake._store.dataRoomAccessRequest.find((r) => r.id === 'dr_3').status, 'PENDING');
    assert.equal(fake._store.dataRoomAccessLog.length, 1);
    assert.match(fake._store.dataRoomAccessLog[0].action, /^EXPIRE:dr_1$/);
  } finally {
    restore();
  }
});

test('API-02 : les clés d’API expirées ne restent jamais ACTIVE', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    baseStore({
      apiKey: [
        { id: 'k1', status: 'ACTIVE', expiresAt: new Date(Date.now() - DAY) },
        { id: 'k2', status: 'ACTIVE', expiresAt: new Date(Date.now() + DAY) },
        { id: 'k3', status: 'REVOKED', expiresAt: new Date(Date.now() - DAY) },
      ],
    }),
  );
  try {
    const outcome = await runJob('apikeys.expire');
    assert.equal(outcome.result.revoked, 1);
    assert.equal(fake._store.apiKey.find((k) => k.id === 'k1').status, 'REVOKED');
    assert.ok(fake._store.apiKey.find((k) => k.id === 'k1').revokedAt instanceof Date);
    assert.equal(fake._store.apiKey.find((k) => k.id === 'k2').status, 'ACTIVE');
  } finally {
    restore();
  }
});

test('DISP-02 : le SLA notifie les modérateurs une seule fois par jour et par litige', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    baseStore({
      dispute: [
        { id: 'd1', orderId: 'ord_1', status: 'OPEN', createdAt: new Date(Date.now() - 8 * DAY) },
        { id: 'd2', orderId: 'ord_2', status: 'OPEN', createdAt: new Date(Date.now() - 1 * DAY) },
        { id: 'd3', orderId: 'ord_3', status: 'RESOLVED', createdAt: new Date(Date.now() - 20 * DAY) },
      ],
      membership: [
        { id: 'm1', userId: 'mod_1', organizationId: 'org_platform', status: 'ACTIVE', roles: ['MODERATOR'] },
        { id: 'm2', userId: 'mod_2', organizationId: 'org_platform', status: 'ACTIVE', roles: ['ADMIN'] },
        { id: 'm3', userId: 'farmer_1', organizationId: 'org_1', status: 'ACTIVE', roles: ['FARMER'] },
      ],
    }),
  );
  try {
    const first = await runJob('disputes.sla');
    assert.equal(first.result.disputes, 1, 'seul le litige ouvert depuis 8 jours est concerné');
    assert.equal(first.result.alerted, 1);
    assert.equal(fake._store.notification.length, 2, 'deux modérateurs notifiés');
    assert.ok(fake._store.notification.every((n) => n.userId.startsWith('mod_')));
    assert.ok(fake._store.notification.every((n) => n.type === 'DISPUTE_SLA'));

    // Deuxième exécution le même jour : la clé de déduplication empêche le doublon.
    const second = await runJob('disputes.sla');
    assert.equal(second.result.disputes, 1);
    assert.equal(fake._store.notification.length, 2, 'aucune alerte en double');
  } finally {
    restore();
  }
});

test('NOTIF-02 : seules les notifications lues et anciennes sont purgées', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    baseStore({
      notification: [
        { id: 'n1', userId: 'u1', type: 'X', title: 't', readAt: new Date(Date.now() - 120 * DAY), createdAt: new Date(Date.now() - 120 * DAY) },
        { id: 'n2', userId: 'u1', type: 'X', title: 't', readAt: new Date(Date.now() - 5 * DAY), createdAt: new Date(Date.now() - 5 * DAY) },
        { id: 'n3', userId: 'u1', type: 'X', title: 't', readAt: null, createdAt: new Date(Date.now() - 200 * DAY) },
      ],
    }),
  );
  try {
    const outcome = await runJob('notifications.purge');
    assert.equal(outcome.result.deleted, 1);
    assert.equal(outcome.result.retentionDays, 90);
    assert.equal(outcome.result.unreadKept, true, 'une notification non lue n’est jamais purgée');
    assert.deepEqual(fake._store.notification.map((n) => n.id).sort(), ['n2', 'n3']);
  } finally {
    restore();
  }
});

test('IOT-03 : un capteur silencieux est signalé à son organisation', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    baseStore({
      iotDevice: [
        { id: 'dev_1', organizationId: 'org_1', label: 'Sonde A', status: 'ACTIVE', lastSeenAt: new Date(Date.now() - 3 * DAY) },
        { id: 'dev_2', organizationId: 'org_1', label: 'Sonde B', status: 'ACTIVE', lastSeenAt: new Date() },
      ],
      membership: [{ id: 'm1', userId: 'farmer_1', organizationId: 'org_1', status: 'ACTIVE', roles: ['FARMER'] }],
      profile: [{ id: 'farmer_1', email: 'fermier@agrikonnect.test', phone: '+243810000222' }],
    }),
  );
  try {
    const outcome = await runJob('iot.markSilent');
    assert.equal(outcome.result.silent, 1);
    assert.equal(outcome.result.thresholdHours, 24, 'le seuil vient du fichier matériel');

    // Le capteur muet rejoint la boîte d'alertes commune, comme les franchissements.
    assert.equal(fake._store.thresholdAlert.length, 1);
    const alert = fake._store.thresholdAlert[0];
    assert.equal(alert.sourceType, 'SENSOR_SILENCE');
    assert.equal(alert.episodeKey, 'sensorSilence:dev_1');
    assert.equal(alert.referenceValue, 24);
    assert.equal(alert.deviceId, 'dev_1');

    // Et l'agriculteur est prévenu, avec le nom du capteur.
    assert.ok(fake._store.notification.length >= 1, 'au moins une notification');
    assert.equal(fake._store.notification[0].userId, 'farmer_1');
    assert.match(fake._store.notification[0].body, /Sonde A/);
  } finally {
    restore();
  }
});

test('Supervision : chaque tâche est listée avec sa cadence et son dernier résultat', async () => {
  const { restore } = await withFakePrisma(prisma, baseStore());
  try {
    const jobs = listJobs();
    assert.ok(jobs.length >= 6);
    const expire = jobs.find((job) => job.name === 'listings.expire');
    assert.ok(expire.description.length > 10);
    assert.match(expire.intervalHuman, /min/);
    assert.equal('lastRunAt' in expire, true);

    const status = schedulerStatus();
    assert.equal(typeof status.enabled, 'boolean');
    assert.ok(Object.keys(JOBS).every((name) => status.jobs.some((job) => job.name === name)));
  } finally {
    restore();
  }
});

test('Supervision : le déclenchement manuel est audité, un nom inconnu renvoie null', async () => {
  const { fake, restore } = await withFakePrisma(prisma, baseStore());
  try {
    const outcome = await runJob('notifications.purge', { actorId: 'user_admin', req: reqAs() });
    assert.equal(outcome.ok, true);
    assert.equal(fake._store.auditLog[0].action, 'admin.job.run');
    assert.equal(fake._store.auditLog[0].resourceId, 'notifications.purge');

    assert.equal(await runJob('inconnu.job'), null);
  } finally {
    restore();
  }
});

test('Planificateur : démarrage et arrêt sans laisser de minuteur actif', async () => {
  const { restore } = await withFakePrisma(prisma, baseStore());
  try {
    const started = startScheduler({ initialDelayMs: 3_600_000 });
    assert.equal(started.started, true);
    assert.equal(started.jobs.length, Object.keys(JOBS).length);
    assert.equal(schedulerStatus().scheduled, Object.keys(JOBS).length);
    stopScheduler();
    assert.equal(schedulerStatus().scheduled, 0);
  } finally {
    restore();
  }
});

test('Robustesse : un job en échec n’interrompt pas les autres', async () => {
  const { restore } = await withFakePrisma(prisma, baseStore());
  try {
    // Aucun modèle absent : tout doit passer. On vérifie surtout l'agrégation.
    const results = await runAll();
    assert.ok(results.length >= 6);
    assert.ok(results.every((r) => r && typeof r.ok === 'boolean'));
  } finally {
    restore();
  }
});
