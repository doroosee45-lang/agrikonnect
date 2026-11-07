/**
 * SPEC-SUPER-ADMIN M6 — sécurité et audit (unitaire).
 *
 * Ce que garantit ce test :
 *   1. la gravité (`auditSeverity`) est déterministe et **cohérente** avec le
 *      filtre `severityWhere` (même règle, test de partition) ;
 *   2. la recherche avancée filtre par acteur (identifiant ou fragment
 *      d'e-mail/nom), action, ressource, date et gravité (U-M6-1) ;
 *   3. l'export CSV/JSON est borné, complet (avant/après) et **audité**
 *      (`admin.audit.export`) — RG-S2 : aucune écriture ni suppression ;
 *   4. la vue sécurité remonte connexions, échecs, verrous, MFA de la
 *      gouvernance (alerte si absente), clés API et sessions (U-M6-2) ;
 *   5. la politique `security.*` est lue/écrite via le service de paramètres
 *      (palier 2, validation de plage, révision + audit) — U-M6-3 ;
 *   6. RG-S1 : un compte de gouvernance sans MFA est refusé (`mfaRequired`).
 */
import './helpers/pinTestEnv.mjs';

import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/config/prisma.js';
import * as service from '../src/modules/admin/admin.security.service.js';
import { listAuditLogs } from '../src/modules/admin/admin.service.js';
import {
  auditSeverity,
  severityWhere,
  auditQuerySchema,
  auditExportSchema,
  policyUpdateSchema,
} from '../src/modules/admin/admin.security.schema.js';
import { requireSuperAdmin } from '../src/middleware/authorize.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';

const ACTEUR_ID = '33333333-3333-4333-8333-333333333333';
const CIBLE_ID = '44444444-4444-4444-8444-444444444444';
const GOUVERnant_ID = '55555555-5555-4555-8555-555555555555';

const acteur = (roles = ['ADMIN']) => ({
  user: {
    id: ACTEUR_ID,
    email: 'm6@agrikonnect.test',
    roles,
    profile: { id: ACTEUR_ID, mfaEnabled: true },
  },
  headers: { 'user-agent': 'test-m6', 'x-forwarded-for': '127.0.0.1' },
  ip: '127.0.0.1',
});

const jour = (j, h = 12) => new Date(Date.UTC(2026, 9, 10 + j, h, 0, 0));

const monter = (initial = {}) =>
  withFakePrisma(prisma, {
    setting: [],
    settingRevision: [],
    auditLog: [],
    profile: [],
    membership: [],
    apiKey: [],
    token: [],
    ...initial,
  });

/* ═══════════════ 1. Gravité dérivée (U-M6-1) ═══════════════ */

test('auditSeverity : classification déterministe des actions', () => {
  assert.equal(auditSeverity('auth.login'), 'info');
  assert.equal(auditSeverity('auth.register'), 'info');
  assert.equal(auditSeverity('admin.user.deleted'), 'haute');
  assert.equal(auditSeverity('admin.superadmin.granted'), 'haute');
  assert.equal(auditSeverity('admin.role.revoked'), 'haute');
  assert.equal(auditSeverity('admin.user.force_logout'), 'haute');
  assert.equal(auditSeverity('auth.login.locked'), 'haute');
  assert.equal(auditSeverity('admin.user.status'), 'haute');
  assert.equal(auditSeverity('mfa.disable'), 'haute');
  assert.equal(auditSeverity('auth.login.failed'), 'moyenne');
  assert.equal(auditSeverity('admin.setting.update'), 'moyenne');
  assert.equal(auditSeverity('admin.job.run'), 'moyenne');
  assert.equal(auditSeverity('admin.audit.export'), 'moyenne');
  assert.equal(auditSeverity(undefined), 'info');
});

test('severityWhere filtre exactement comme auditSeverity classe (partition)', async () => {
  const actions = [
    'auth.login',
    'admin.user.deleted',
    'auth.login.failed',
    'admin.setting.update',
    'auth.login.locked',
    'admin.dashboard.export',
    'mfa.confirm',
  ];
  const { fake, restore } = await monter({
    auditLog: actions.map((action, i) => ({
      id: `log-${i}`,
      actorId: ACTEUR_ID,
      action,
      resource: 'profiles',
      resourceId: CIBLE_ID,
      ip: null,
      device: null,
      oldValue: null,
      newValue: null,
      createdAt: jour(i),
    })),
  });
  try {
    for (const severity of ['haute', 'moyenne', 'info']) {
      const { items } = await listAuditLogs({ page: 1, limit: 50, severity });
      for (const row of items) {
        assert.equal(row.severity, severity, `« ${row.action} » classée ${severity}`);
      }
    }
    const total = (
      await Promise.all(
        ['haute', 'moyenne', 'info'].map((s) => listAuditLogs({ page: 1, limit: 50, severity: s })),
      )
    ).reduce((acc, r) => acc + r.total, 0);
    assert.equal(total, actions.length, 'partition complète : chaque ligne a exactement une gravité');
    assert.ok(fake._store.auditLog.length === actions.length);
  } finally {
    restore();
  }
});

/* ═══════════════ 2. Recherche avancée (U-M6-1) ═══════════════ */

test('listAuditLogs : filtres acteur (e-mail/nom), action, ressource, dates', async () => {
  const { restore } = await monter({
    profile: [
      { id: ACTEUR_ID, email: 'amina@example.cd', firstName: 'Amina', lastName: 'Kabila', mfaEnabled: true },
      { id: GOUVERnant_ID, email: 'boss@example.cd', firstName: 'Boss', lastName: 'Admin', mfaEnabled: true },
    ],
    auditLog: [
      {
        id: 'log-a', actorId: ACTEUR_ID, action: 'admin.setting.update', resource: 'settings',
        resourceId: 'platform.name', ip: null, device: null, oldValue: null, newValue: null, createdAt: jour(0),
      },
      {
        id: 'log-b', actorId: GOUVERnant_ID, action: 'auth.login', resource: 'profiles',
        resourceId: GOUVERnant_ID, ip: null, device: null, oldValue: null, newValue: null, createdAt: jour(1),
      },
      {
        id: 'log-c', actorId: GOUVERnant_ID, action: 'auth.login', resource: 'profiles',
        resourceId: GOUVERnant_ID, ip: null, device: null, oldValue: null, newValue: null, createdAt: jour(5),
      },
    ],
  });
  try {
    // acteur = fragment d'e-mail
    const parEmail = await listAuditLogs({ page: 1, limit: 10, actor: 'amina' });
    assert.equal(parEmail.total, 1);
    assert.equal(parEmail.items[0].id, 'log-a');

    // acteur = fragment de nom
    const parNom = await listAuditLogs({ page: 1, limit: 10, actor: 'Kabila' });
    assert.equal(parNom.total, 1);

    // actorId exact (alias historique)
    const parId = await listAuditLogs({ page: 1, limit: 10, actorId: GOUVERnant_ID });
    assert.equal(parId.total, 2);

    // action (contient) + ressource
    const parAction = await listAuditLogs({ page: 1, limit: 10, action: 'login' });
    assert.equal(parAction.total, 2);
    const parRessource = await listAuditLogs({ page: 1, limit: 10, resource: 'settings' });
    assert.equal(parRessource.total, 1);

    // bornes de date (du 10 au 12 octobre inclus)
    const parPeriode = await listAuditLogs({
      page: 1, limit: 10, from: '2026-10-11', to: '2026-10-12',
    });
    assert.equal(parPeriode.total, 1, 'seule la journée du 11 tombe dans la fenêtre');
    assert.equal(parPeriode.items[0].id, 'log-b');

    // combinaison
    const combine = await listAuditLogs({
      page: 1, limit: 10, actor: 'boss', action: 'login', from: '2026-10-14',
    });
    assert.equal(combine.total, 1);
    assert.equal(combine.items[0].id, 'log-c');
    assert.equal(combine.items[0].severity, 'info', 'gravité dérivée sur chaque ligne');
  } finally {
    restore();
  }
});

test('schémas de recherche : dates calendrier et gravité validées', () => {
  assert.ok(auditQuerySchema.safeParse({ from: '2026-10-10', to: '2026-10-12' }).success);
  assert.ok(!auditQuerySchema.safeParse({ from: '2026-13-45' }).success, 'date impossible refusée');
  assert.ok(!auditQuerySchema.safeParse({ from: '2026-02-31' }).success, '31 février refusé');
  assert.ok(auditQuerySchema.safeParse({ severity: 'haute' }).success);
  assert.ok(!auditQuerySchema.safeParse({ severity: 'catastrophe' }).success);
  assert.ok(auditExportSchema.safeParse({ format: 'json' }).success);
  assert.ok(!auditExportSchema.safeParse({ format: 'xlsx' }).success);
});

/* ═══════════════ 3. Export audité (U-M6-1, RG-S2) ═══════════════ */

test('exportAudit : CSV/JSON borné, avec avant/après, et journalisé', async () => {
  const { fake, restore } = await monter({
    profile: [{ id: ACTEUR_ID, email: 'm6@agrikonnect.test', firstName: 'M6', lastName: 'Test', mfaEnabled: true }],
    auditLog: [
      {
        id: 'log-1', actorId: ACTEUR_ID, action: 'admin.setting.update', resource: 'settings',
        resourceId: 'platform.name', ip: '127.0.0.1', device: 'test',
        oldValue: { 'platform.name': 'A' }, newValue: { 'platform.name': 'B' }, createdAt: jour(0),
      },
      {
        id: 'log-2', actorId: ACTEUR_ID, action: 'auth.login', resource: 'profiles',
        resourceId: ACTEUR_ID, ip: null, device: null, oldValue: null, newValue: null, createdAt: jour(1),
      },
    ],
  });
  try {
    const csv = await service.exportAudit({ format: 'csv' }, acteur());
    assert.match(csv.contentType, /text.csv/);
    assert.match(csv.filename, /^audit-[0-9]{4}-[0-9]{2}-[0-9]{2}.csv$/);
    const lignes = csv.content.split(String.fromCharCode(10));
    assert.equal(lignes.length, 3, 'en-tête + 2 lignes');
    assert.match(lignes[0], /^id,createdAt,actorId,actorEmail,severity,action,/);
    assert.match(csv.content, /admin.setting.update/);
    assert.match(csv.content, /"platform.name":"B"|""platform.name"":""B""/, 'nouvelle valeur exportée');

    const json = await service.exportAudit({ format: 'json', action: 'login' }, acteur());
    const donnees = JSON.parse(json.content);
    assert.equal(donnees.length, 1, 'filtre `action` appliqué à l’export');
    assert.equal(donnees[0].severity, 'info');

    // L'export est lui-même audité (U-M6-1) : la trace porte les filtres.
    const trace = fake._store.auditLog.filter((l) => l.action === 'admin.audit.export');
    assert.equal(trace.length, 2, 'une trace par export');
    assert.equal(trace[0].newValue.format, 'csv');
    assert.equal(trace[0].newValue.count, 2);
    assert.equal(trace[1].newValue.filtres.action, 'login');
  } finally {
    restore();
  }
});

/* ═══════════════ 4. Vue sécurité (U-M6-2) ═══════════════ */

test('securityOverview : connexions, verrous, MFA gouvernance, clés, sessions', async () => {
  const maintenant = new Date();
  const { restore } = await monter({
    profile: [
      {
        id: ACTEUR_ID, email: 'amina@example.cd', firstName: 'Amina', lastName: 'K.', mfaEnabled: true,
        failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date(maintenant.getTime() - 3600e3), deletedAt: null,
      },
      {
        id: CIBLE_ID, email: 'verrouille@example.cd', firstName: 'V.', lastName: 'L.', mfaEnabled: false,
        failedLoginAttempts: 0, lockedUntil: new Date(maintenant.getTime() + 900e3), lastLoginAt: null, deletedAt: null,
      },
      {
        id: GOUVERnant_ID, email: 'boss@example.cd', firstName: 'Boss', lastName: 'Admin', mfaEnabled: false,
        failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date(maintenant.getTime() - 7200e3), deletedAt: null,
      },
    ],
    membership: [
      { id: 'm1', userId: GOUVERnant_ID, organizationId: 'o1', roles: ['SUPER_ADMIN'], status: 'ACTIVE' },
    ],
    auditLog: [
      {
        id: 'login-1', actorId: ACTEUR_ID, action: 'auth.login', resource: 'profiles', resourceId: ACTEUR_ID,
        ip: '127.0.0.1', device: null, oldValue: null, newValue: null, createdAt: maintenant,
      },
      {
        id: 'fail-1', actorId: CIBLE_ID, action: 'auth.login.failed', resource: 'profiles', resourceId: CIBLE_ID,
        ip: '127.0.0.1', device: null, oldValue: null, newValue: null, createdAt: maintenant,
      },
      {
        id: 'fail-2', actorId: CIBLE_ID, action: 'auth.login.locked', resource: 'profiles', resourceId: CIBLE_ID,
        ip: '127.0.0.1', device: null, oldValue: null, newValue: null, createdAt: maintenant,
      },
    ],
    apiKey: [
      {
        id: 'k1', clientId: 'c1', label: 'Principale', prefix: 'ak_live_', keyHash: 'x', status: 'ACTIVE',
        lastUsedAt: null, revokedAt: null, expiresAt: new Date(maintenant.getTime() + 86400e3), createdAt: maintenant,
      },
      {
        id: 'k2', clientId: 'c1', label: 'Périmée', prefix: 'ak_old_', keyHash: 'y', status: 'ACTIVE',
        lastUsedAt: null, revokedAt: null, expiresAt: new Date(maintenant.getTime() - 86400e3), createdAt: maintenant,
      },
      {
        id: 'k3', clientId: 'c1', label: 'Révoquée', prefix: 'ak_dead_', keyHash: 'z', status: 'REVOKED',
        lastUsedAt: null, revokedAt: maintenant, expiresAt: null, createdAt: maintenant,
      },
    ],
    token: [
      {
        id: 't1', userId: ACTEUR_ID, identifier: null, tokenHash: 'h1', purpose: 'PASSWORD_RESET',
        expiresAt: new Date(maintenant.getTime() + 3600e3), consumedAt: null, metadata: null, createdAt: maintenant,
      },
    ],
  });
  try {
    const vue = await service.securityOverview();

    assert.equal(vue.connections.recent.length, 1, 'connexions réussies (auth.login)');
    assert.equal(vue.connections.recent[0].userId, ACTEUR_ID);
    assert.equal(vue.failures.last24h, 2, 'échecs + verrouillage sur 24 h');
    assert.equal(vue.failures.recent.length, 2);

    assert.equal(vue.lockedAccounts.length, 1);
    assert.equal(vue.lockedAccounts[0].id, CIBLE_ID);
    assert.ok(vue.lockedAccounts[0].lockedUntil > maintenant);

    // RG-S1 : le compte de gouvernance sans MFA est signalé.
    assert.equal(vue.governanceMfa.total, 1);
    assert.equal(vue.governanceMfa.withoutMfa.length, 1);
    assert.equal(vue.governanceMfa.withoutMfa[0].userId, GOUVERnant_ID);
    assert.deepEqual(vue.governanceMfa.withoutMfa[0].roles, ['SUPER_ADMIN']);

    assert.equal(vue.apiKeys.active, 1, 'clés utilisables (ACTIVE, non périmées)');
    assert.equal(vue.apiKeys.expiredStillActive, 1, 'clé ACTIVE périmée signalée (seau disjoint)');
    assert.equal(vue.apiKeys.recent.length, 3);
    assert.equal('keyHash' in vue.apiKeys.recent[0], false, 'aucun hash exposé (RG-S3)');

    assert.equal(vue.sessions.ttlHours, 12, 'fenêtre = politique security.sessionTtlHours (défaut)');
    assert.equal(vue.sessions.active.length, 2, 'deux connexions dans la fenêtre de 12 h');
    assert.equal(vue.sessions.pendingTokens.byPurpose.PASSWORD_RESET, 1);
    assert.equal(vue.sessions.pendingTokens.total, 1);
    assert.ok(vue.sessions.note.includes('Estimation'), 'dérivation documentée, jamais présentée comme les jetons');
  } finally {
    restore();
  }
});

/* ═══════════════ 5. Politique de sécurité (U-M6-3, palier 2) ═══════════════ */

test('getPolicy : section security du catalogue M3, lue telle quelle', async () => {
  const { restore } = await monter();
  try {
    const politique = await service.getPolicy();
    assert.equal(politique.section, 'security');
    assert.equal(politique.tier, 2);
    const cles = Object.keys(politique.values);
    assert.deepEqual(
      cles.sort(),
      [
        'security.lockoutMinutes',
        'security.mfaRequiredForGovernance',
        'security.passwordMinLength',
        'security.passwordRequireSpecial',
        'security.sessionTtlHours',
      ],
      'les cinq clés de la politique (U-M6-3)',
    );
    assert.equal(politique.settings['security.mfaRequiredForGovernance'].default, true);
    assert.equal(politique.settings['security.mfaRequiredForGovernance'].requiresRestart, false);
  } finally {
    restore();
  }
});

test('updatePolicy : écriture via le service de paramètres (révision + audit + plages)', async () => {
  const { fake, restore } = await monter();
  try {
    const miseAJour = await service.updatePolicy(
      { values: { 'security.lockoutMinutes': 30 }, reason: 'durcissement' },
      acteur(['SUPER_ADMIN']),
    );
    assert.equal(miseAJour.values['security.lockoutMinutes'], 30);
    assert.equal(miseAJour.lastReason, 'durcissement');

    assert.equal(fake._store.settingRevision.length, 1, 'révision avant → après (RG-M3-1)');
    assert.equal(fake._store.settingRevision[0].key, 'security.lockoutMinutes');
    const trace = fake._store.auditLog.find((l) => l.action === 'admin.setting.update');
    assert.ok(trace, 'audit de l’écriture (une seule source : le service de paramètres)');

    // Hors plage → refus (la validation reste celle du catalogue).
    await assert.rejects(
      () => service.updatePolicy({ values: { 'security.lockoutMinutes': 99999 } }, acteur(['SUPER_ADMIN'])),
      (e) => e.status === 422 || e.status === 400,
    );

    // Hors section → refus explicite.
    await assert.rejects(
      () => service.updatePolicy({ values: { 'platform.name': 'Hack' } }, acteur(['SUPER_ADMIN'])),
      (e) => e.status === 400 || e.status === 422,
    );

    // Valeurs vides → refus.
    await assert.rejects(
      () => service.updatePolicy({ values: {} }, acteur(['SUPER_ADMIN'])),
      (e) => e.status === 422 || e.status === 400,
    );
  } finally {
    restore();
  }
});

test('palier 2 : un ADMIN sans rôle SUPER_ADMIN ne modifie pas la politique', async () => {
  const { restore } = await monter();
  try {
    await assert.rejects(
      () => service.updatePolicy({ values: { 'security.lockoutMinutes': 30 } }, acteur(['ADMIN'])),
      (e) => e.status === 403,
    );
  } finally {
    restore();
  }
});

/* ═══════════════ 6. RG-S1 — MFA exigée (marqueur `mfaRequired`) ═══════════════ */

test('requireSuperAdmin : SUPER_ADMIN sans MFA → 403 `mfaRequired` (RG-S1)', () => {
  const req = acteur(['SUPER_ADMIN']);
  req.user.profile = { id: ACTEUR_ID, mfaEnabled: false };
  let erreur = null;
  requireSuperAdmin(req, {}, (err) => {
    erreur = err;
  });
  assert.ok(erreur, 'requête refusée');
  assert.equal(erreur.status, 403);
  assert.equal(erreur.details.mfaRequired, true, 'marqueur `details.mfaRequired` pour les clients');

  // Avec MFA active : la garde laisse passer.
  const reqMfa = acteur(['SUPER_ADMIN']);
  let suite = 'non';
  requireSuperAdmin(reqMfa, {}, () => {
    suite = 'oui';
  });
  assert.equal(suite, 'oui');
});

test('policyUpdateSchema : objet `values` requis', () => {
  assert.ok(policyUpdateSchema.safeParse({ values: { 'security.lockoutMinutes': 30 } }).success);
  assert.ok(policyUpdateSchema.safeParse({ values: { 'security.lockoutMinutes': 30 }, reason: 'conformité' }).success);
  assert.ok(!policyUpdateSchema.safeParse({}).success);
  assert.ok(!policyUpdateSchema.safeParse({ values: 'x' }).success);
});
