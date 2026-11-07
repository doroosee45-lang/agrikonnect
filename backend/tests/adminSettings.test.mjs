/**
 * SPEC-SUPER-ADMIN M3 — paramètres globaux et feature flags (unitaire).
 *
 * Ce que garantit ce test :
 *   1. le catalogue M3 est complet et cohérent (clés, sections, paliers,
 *      secrets, descriptions, défauts) ;
 *   2. `getSettingsView` expose les sections documentées + la surface de
 *      compatibilité `values` + `platform.maintenance` (RG-M3-4) ;
 *   3. l'écriture accepte les deux formes (`{key,value}` et
 *      `{section,values}`), journalise `setting_revisions` (avant → après)
 *      et `audit_logs` ;
 *   4. le palier 2 protège `security.*` et `integrations.*` (RG-M3-2) ;
 *   5. toute valeur hors plage est refusée (RG-M3-1) ;
 *   6. les secrets sont chiffrés AES-256-GCM au repos et masqués partout,
 *      révisions comprises (RG-M3-3) ;
 *   7. la réinitialisation remet la valeur par défaut et est audité ;
 *   8. les effets réels : module désactivé → 403 `module_disabled` (AC-M3),
 *      maintenance → 403 `maintenance_mode` avec exemptions (RG-M3-4) ;
 *   9. les feature flags par zone passent par `zone_feature_flags` avec audit
 *      `admin.flag.update` (palier 2).
 */
import './helpers/pinTestEnv.mjs';

import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/config/prisma.js';
import * as service from '../src/modules/admin/admin.settings.service.js';
import {
  settingsEffects,
  invalidateSettingsCache,
  MODULE_PREFIXES,
} from '../src/middleware/settingsEffects.js';
import {
  SETTINGS_SECTIONS,
  SETTINGS_CATALOG,
  CATALOG_KEYS,
  SECRET_KEYS,
  tierOfKey,
  settingsUpdateSchema,
} from '../src/modules/admin/admin.settings.schema.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';

const acteur = (roles = ['ADMIN']) => ({
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'm3@agrikonnect.test',
    roles,
    profile: { id: '11111111-1111-4111-8111-111111111111', mfaEnabled: true },
  },
  headers: { 'user-agent': 'test-m3', 'x-forwarded-for': '127.0.0.1' },
  ip: '127.0.0.1',
});

const monter = (initial = {}) =>
  withFakePrisma(prisma, {
    setting: [],
    settingRevision: [],
    zoneFeatureFlag: [],
    auditLog: [],
    ...initial,
  });

const nexts = () => {
  const appels = [];
  return [appels, (err) => appels.push(err ?? null)];
};

const chemin = (method, path) => ({ method, originalUrl: `/api/v1${path}`, path });

/* ═══════════════ 1. Catalogue ═══════════════ */

test('catalogue M3 : clés, sections, paliers, secrets et défauts cohérents', () => {
  assert.ok(CATALOG_KEYS.length >= 20, `catalogue complet (≥ 20 clés), obtenu ${CATALOG_KEYS.length}`);
  for (const key of CATALOG_KEYS) {
    const entry = SETTINGS_CATALOG[key];
    const [section] = key.split('.');
    assert.equal(entry.section, section, `${key} rangé dans sa section`);
    assert.ok(SETTINGS_SECTIONS[section], `${key} : section connue`);
    assert.ok(entry.description?.length >= 5, `${key} : description présente`);
    assert.ok('default' in entry, `${key} : valeur par défaut présente`);
    assert.ok(typeof entry.requiresRestart === 'boolean', `${key} : indicateur de redémarrage`);
    if (section === 'security' || section === 'integrations') {
      assert.equal(tierOfKey(key), 2, `${key} en palier 2 (RG-M3-2)`);
    } else {
      assert.equal(tierOfKey(key), 1, `${key} en palier 1`);
    }
  }
  assert.deepEqual(
    [...SECRET_KEYS].sort(),
    ['integrations.emailApiKey', 'integrations.smsAuthToken'],
    'exactement les deux jetons de service sont des secrets',
  );
  assert.equal(tierOfKey('security.passwordMinLength'), 2);
  assert.equal(tierOfKey('modules.market'), 1);
});

test('settingsUpdateSchema accepte les deux formes et refuse le reste', () => {
  assert.ok(settingsUpdateSchema.safeParse({ key: 'platform.name', value: 'X' }).success);
  assert.ok(
    settingsUpdateSchema.safeParse({ section: 'platform', values: { 'platform.name': 'X' } }).success,
  );
  assert.ok(!settingsUpdateSchema.safeParse({ section: 'inconnue', values: {} }).success);
  assert.ok(!settingsUpdateSchema.safeParse({ values: {} }).success);
});

/* ═══════════════ 2. Lecture (vue + compat + maintenance) ═══════════════ */

test('getSettingsView : sections documentées + compat `values` + maintenance', async () => {
  const { restore } = await monter({
    setting: [
      { key: 'platform.name', value: 'AgriKonnect Test', updatedBy: 'u1', updatedAt: new Date() },
      { key: 'platform.maintenance', value: true, updatedBy: 'u1', updatedAt: new Date() },
    ],
  });
  try {
    const vue = await service.getSettingsView();
    assert.equal(vue.values['platform.name'], 'AgriKonnect Test');
    assert.equal(vue.values['platform.maintenance'], true);
    assert.equal(vue.maintenance, true, 'maintenance exposée (RG-M3-4)');
    assert.equal(vue.sections.platform.label, 'Plateforme');
    assert.equal(vue.sections.security.tier, 2);
    assert.equal(vue.sections.platform.values['platform.name'], 'AgriKonnect Test');
    assert.equal(vue.values['integrations.smsAuthToken'], '••••••••', 'secret masqué à la vue');
    assert.equal(vue.sections.integrations.settings['integrations.smsAuthToken'].secret, true);
  } finally {
    restore();
  }
});

/* ═══════════════ 3. Écriture : deux formes + révision + audit ═══════════════ */

test('écriture forme historique : valeur, révision avant→après et audit', async () => {
  const { restore } = await monter();
  try {
    await service.updateSettings({ key: 'platform.name', value: 'Nouveau Nom' }, acteur());
    const ligne = await prisma.setting.findUnique({ where: { key: 'platform.name' } });
    assert.equal(ligne.value, 'Nouveau Nom');

    const revisions = await prisma.settingRevision.findMany({});
    assert.equal(revisions.length, 1);
    assert.equal(revisions[0].key, 'platform.name');
    assert.equal(revisions[0].previousValue, 'AGRIKONNECT AFRICA', 'avant = défaut');
    assert.equal(revisions[0].newValue, 'Nouveau Nom');

    const audits = await prisma.auditLog.findMany({});
    assert.ok(
      audits.some((a) => a.action === 'admin.setting.update' && a.resourceId === 'platform.name'),
      'audit admin.setting.update',
    );
  } finally {
    restore();
  }
});

test('écriture forme par sections : clés complètes, refus hors section et clé inconnue', async () => {
  const { restore } = await monter();
  try {
    await service.updateSettings(
      { section: 'limits', values: { 'limits.maxUploadMb': 128 } },
      acteur(),
    );
    assert.equal((await prisma.setting.findUnique({ where: { key: 'limits.maxUploadMb' } })).value, 128);

    await assert.rejects(
      () => service.updateSettings({ section: 'limits', values: { 'platform.name': 'X' } }, acteur()),
      (e) => e.status === 422 && e.code === 'VALIDATION_ERROR',
      'clé hors section refusée',
    );
    await assert.rejects(
      () => service.updateSettings({ section: 'limits', values: { 'limits.inconnu': 1 } }, acteur()),
      (e) => e.code === 'NOT_FOUND',
      'clé inconnue refusée',
    );
  } finally {
    restore();
  }
});

/* ═══════════════ 4. Palier 2 (RG-M3-2) ═══════════════ */

test('palier 2 : security.* refusé à un ADMIN, accordé à un SUPER_ADMIN', async () => {
  const { restore } = await monter();
  try {
    await assert.rejects(
      () => service.updateSettings({ key: 'security.passwordMinLength', value: 10 }, acteur(['ADMIN'])),
      (e) => e.status === 403 && e.details?.requires === 'super_admin',
      'ADMIN refusé sur security.*',
    );
    await service.updateSettings(
      { key: 'security.passwordMinLength', value: 10 },
      acteur(['SUPER_ADMIN']),
    );
    assert.equal(
      (await prisma.setting.findUnique({ where: { key: 'security.passwordMinLength' } })).value,
      10,
    );
  } finally {
    restore();
  }
});

/* ═══════════════ 5. Plages (RG-M3-1) ═══════════════ */

test('RG-M3-1 : valeurs hors plage ou de mauvais type refusées', async () => {
  const { restore } = await monter();
  try {
    await assert.rejects(
      () => service.updateSettings({ key: 'limits.maxUploadMb', value: 99999 }, acteur()),
      (e) => e.status === 422 && e.code === 'VALIDATION_ERROR',
    );
    await assert.rejects(
      () => service.updateSettings({ key: 'modules.market', value: 'oui' }, acteur()),
      (e) => e.status === 422,
    );
    await assert.rejects(
      () => service.updateSettings({ key: 'platform.languages', value: [] }, acteur()),
      (e) => e.status === 422,
    );
  } finally {
    restore();
  }
});

/* ═══════════════ 6. Secrets (RG-M3-3) ═══════════════ */

test('RG-M3-3 : secret chiffré au repos, masqué à la vue et dans les révisions', async () => {
  const { restore } = await monter();
  try {
    await service.updateSettings(
      { section: 'integrations', values: { 'integrations.smsAuthToken': 'twilio-token-123' } },
      acteur(['SUPER_ADMIN']),
    );
    const ligne = await prisma.setting.findUnique({ where: { key: 'integrations.smsAuthToken' } });
    assert.match(String(ligne.value), /^v1\./, 'chiffré AES-256-GCM (v1.…)');
    assert.ok(!String(ligne.value).includes('twilio-token-123'), 'jamais en clair en base');

    const vue = await service.getSettingsView();
    assert.equal(vue.values['integrations.smsAuthToken'], '••••••••', 'masqué à la vue');

    const revisions = await prisma.settingRevision.findMany({ where: { key: 'integrations.smsAuthToken' } });
    assert.equal(revisions.length, 1);
    assert.deepEqual(revisions[0].newValue, { masked: true }, 'révision stockée masquée');
    assert.ok(!JSON.stringify(revisions[0]).includes('twilio-token-123'));

    const historique = await service.settingsHistory({ key: 'integrations.smsAuthToken' });
    for (const item of historique.items) {
      assert.deepEqual(item.newValue, { masked: true });
    }
  } finally {
    restore();
  }
});

/* ═══════════════ 7. Réinitialisation ═══════════════ */

test('reset : retour au défaut + audit, clé inconnue en 404', async () => {
  const { restore } = await monter({
    setting: [{ key: 'platform.name', value: 'À oublier', updatedBy: 'u1', updatedAt: new Date() }],
  });
  try {
    const retour = await service.resetSetting('platform.name', acteur(['SUPER_ADMIN']));
    assert.equal(retour.value, SETTINGS_CATALOG['platform.name'].default);
    assert.equal(await prisma.setting.findUnique({ where: { key: 'platform.name' } }), null);

    const audits = await prisma.auditLog.findMany({});
    assert.ok(audits.some((a) => a.action === 'admin.setting.reset'), 'audit admin.setting.reset');

    await assert.rejects(
      () => service.resetSetting('platform.inconnu', acteur(['SUPER_ADMIN'])),
      (e) => e.code === 'NOT_FOUND',
    );
  } finally {
    restore();
  }
});

/* ═══════════════ 8. Effets réels (AC-M3 / RG-M3-4) ═══════════════ */

test('AC-M3 : module désactivé → 403 module_disabled sur ses routes, ailleurs OK', async () => {
  const { restore } = await monter({
    setting: [{ key: 'modules.market', value: false, updatedBy: 'u1', updatedAt: new Date() }],
  });
  try {
    await invalidateSettingsCache();
    for (const prefix of MODULE_PREFIXES.find((m) => m.module === 'market').prefixes) {
      const [appels, next] = nexts();
      await settingsEffects(chemin('POST', `${prefix}/x`), {}, next);
      assert.equal(appels.at(-1)?.status, 403, `POST ${prefix}/x refusé`);
      assert.equal(appels.at(-1)?.details?.code, 'module_disabled');
    }
    const [lecture, nextLecture] = nexts();
    await settingsEffects(chemin('GET', '/listings/123'), {}, nextLecture);
    assert.equal(lecture.at(-1)?.details?.code, 'module_disabled', 'lecture du module coupée aussi');

    const [autre, nextAutre] = nexts();
    await settingsEffects(chemin('GET', '/crops'), {}, nextAutre);
    assert.equal(autre.at(-1) ?? null, null, 'les autres modules restent ouverts');
  } finally {
    restore();
  }
});

test('RG-M3-4 : maintenance → mutations refusées, lectures et exemptions ouvertes', async () => {
  const { restore } = await monter({
    setting: [{ key: 'platform.maintenance', value: true, updatedBy: 'u1', updatedAt: new Date() }],
  });
  try {
    await invalidateSettingsCache();
    const [mutation, nextMutation] = nexts();
    await settingsEffects(chemin('POST', '/listings'), {}, nextMutation);
    assert.equal(mutation.at(-1)?.status, 403);
    assert.equal(mutation.at(-1)?.details?.code, 'maintenance_mode');

    const [lecture, nextLecture] = nexts();
    await settingsEffects(chemin('GET', '/listings'), {}, nextLecture);
    assert.equal(lecture.at(-1) ?? null, null, 'lecture autorisée en maintenance');

    for (const exempt of ['/auth/login', '/admin/settings', '/webhooks/twilio', '/health']) {
      const [appels, next] = nexts();
      await settingsEffects(chemin('POST', exempt), {}, next);
      assert.equal(appels.at(-1) ?? null, null, `${exempt} exempté`);
    }
  } finally {
    restore();
  }
});

test('effets : défaillant-libre (panne de lecture = requêtes admises)', async () => {
  const { fake, restore } = await monter();
  try {
    await invalidateSettingsCache();
    fake.setting.findMany = async () => {
      throw new Error('base indisponible');
    };
    const [appels, next] = nexts();
    await settingsEffects(chemin('POST', '/listings'), {}, next);
    assert.equal(appels.at(-1) ?? null, null, 'pas de coupure générale');
  } finally {
    restore();
  }
});

test('régression : le service invalide seul le cache des effets', async () => {
  const { restore } = await monter();
  try {
    // Amorçage du cache d'effets (tout actif).
    const [amorcage, nextAmorcage] = nexts();
    await settingsEffects(chemin('POST', '/listings'), {}, nextAmorcage);
    assert.equal(amorcage.at(-1) ?? null, null);

    // Écriture par le SEUL service : sans invalidation, le cache mentirait.
    await service.updateSettings({ key: 'modules.market', value: false }, acteur());
    const [appels, next] = nexts();
    await settingsEffects(chemin('POST', '/listings'), {}, next);
    assert.equal(
      appels.at(-1)?.details?.code,
      'module_disabled',
      'updateSettings doit invalider le cache du middleware',
    );
  } finally {
    restore();
  }
});

/* ═══════════════ 9. Feature flags par zone ═══════════════ */

test('flags : écriture par lot dans zone_feature_flags + audit + lecture filtrée', async () => {
  const { restore } = await monter();
  try {
    const ecrit = await service.updateZoneFlags(
      {
        items: [
          { key: 'modules.market', scope: 'COUNTRY', scopeValue: 'CD', enabled: false, reason: 'Recette M3' },
          { key: 'modules.market', scope: 'COUNTRY', scopeValue: 'CI', enabled: true, reason: 'Ouverture' },
        ],
      },
      acteur(['SUPER_ADMIN']),
    );
    assert.equal(ecrit.total, 2);

    const audits = await prisma.auditLog.findMany({});
    assert.equal(
      audits.filter((a) => a.action === 'admin.flag.update').length,
      2,
      'audit admin.flag.update par drapeau',
    );

    const cd = await service.getZoneFlags({ scopeValue: 'CD' });
    assert.equal(cd.items.length, 1);
    assert.equal(cd.items[0].enabled, false);
    assert.equal(cd.items[0].reason, 'Recette M3');

    // Mise à jour du même drapeau : pas de doublon.
    await service.updateZoneFlags(
      { items: [{ key: 'modules.market', scope: 'COUNTRY', scopeValue: 'CD', enabled: true, reason: 'Réouverture' }] },
      acteur(['SUPER_ADMIN']),
    );
    const apres = await prisma.zoneFeatureFlag.findMany({ where: { scopeValue: 'CD' } });
    assert.equal(apres.length, 1);
    assert.equal(apres[0].enabled, true);
  } finally {
    restore();
  }
});

test('flags : refusé sans la permission admin.flags', async () => {
  const { restore } = await monter();
  try {
    await assert.rejects(
      () =>
        service.updateZoneFlags(
          { items: [{ key: 'modules.market', scope: 'COUNTRY', scopeValue: 'CD', enabled: false }] },
          acteur(['ADMIN']),
        ),
      (e) => e.status === 403,
    );
  } finally {
    restore();
  }
});
