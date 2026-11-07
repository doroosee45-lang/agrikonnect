import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';

import * as intelligence from '../src/modules/soil/intelligence.service.js';
import * as soilService from '../src/modules/soil/soil.service.js';
import * as channels from '../src/modules/channels/channels.service.js';
import * as mfa from '../src/modules/auth/mfa.service.js';
import * as groupOffers from '../src/modules/cooperatives/groupoffers.service.js';
import * as hub from '../src/modules/investors/hub.service.js';
import * as traceabilityService from '../src/modules/traceability/traceability.service.js';
import * as publicService from '../src/modules/public/public.service.js';
import * as billingService from '../src/modules/billing/billing.service.js';
import * as syncService from '../src/modules/sync/sync.service.js';

/**
 * Preuves d'acceptation — compléments apportés après la vérification du CDC
 * complet V1→V5 :
 *  - S2/S3 (SOIL-04 → SOIL-14) : règles validées, fusion des sources, fourchette ;
 *  - USSD-01 / WA-01 : canaux complémentaires ;
 *  - NFR-01 V4 : MFA TOTP réel (secret chiffré, codes de secours à usage unique) ;
 *  - COOP-10 : offre groupée consentie et répartition figée ;
 *  - INV-02/03 et PRJ-04 : suivi, matching sans score, mise en relation consentie ;
 *  - PUB-03, TRC-03, SOIL-16 : QR, page publique de lot, k-anonymat ;
 *  - BIL-01 (PDF) et SYNC-02 (pull).
 */

const ORG = 'org_1';
const OTHER = 'org_2';

const reqAs = (organizationId = ORG, roles = ['FARMER'], userId = 'user_1') => ({
  tenant: { organizationId, effectiveRoles: roles },
  user: { id: userId, roles, email: 'agri@example.org' },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
});

const expectStatus = async (promise, status, pattern = null) => {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, status, `statut attendu ${status}, reçu ${error.status} (${error.message})`);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
};

const baseStore = (overrides = {}) => ({
  plot: [],
  farm: [],
  crop: [],
  soilAssessment: [],
  soilParameter: [],
  agronomicRuleSet: [],
  cropSuitability: [],
  rotationPlan: [],
  farmingPlan: [],
  yieldEstimate: [],
  zoneFeatureFlag: [],
  auditLog: [],
  membership: [],
  profile: [],
  weatherData: [],
  marketPrice: [],
  traceabilityLot: [],
  lotEvent: [],
  channelSession: [],
  channelMessage: [],
  mfaSecret: [],
  cooperative: [],
  cooperativeMember: [],
  production: [],
  groupOffer: [],
  listing: [],
  project: [],
  projectFollow: [],
  projectContactRequest: [],
  notification: [],
  notificationPreference: [],
  invoice: [],
  organization: [],
  syncOperation: [],
  ...overrides,
});

const RULES = {
  criteria: [
    { key: 'ph', type: 'range', min: 5.5, max: 7.5, weight: 2, label: 'pH favorable' },
    { key: 'organicMatter', type: 'min', value: 2, weight: 1, label: 'Matière organique suffisante' },
  ],
  rotations: [
    {
      name: 'maïs → légumineuse',
      after: ['maize'],
      sequence: [
        { cropSlug: 'maize', family: 'céréale', rationale: 'culture de rente' },
        { cropSlug: 'beans', family: 'légumineuse', rationale: 'fixation d’azote' },
      ],
      assumptions: ['rotation sur 2 ans'],
    },
  ],
  calendar: [
    { cropSlug: 'maize', activity: 'semis', startMonth: 3, endMonth: 4, rationale: 'début des pluies' },
    { cropSlug: 'maize', activity: 'suivi', startMonth: 6, endMonth: 6, rationale: 'contrôle adventices' },
  ],
  yields: { lowKgPerHa: 1200, highKgPerHa: 2000 },
};

const plotStore = (overrides = {}) => ({
  ...baseStore(),
  // S2 : les recommandations sont déployées zone par zone ; la zone de test
  // (Nord-Kivu / maïs) est activée explicitement (SOIL-14).
  zoneFeatureFlag: [
    { id: 'flag_1', key: 'soil.recommendations', scope: 'crop_zone', scopeValue: 'Nord-Kivu::maize', enabled: true },
  ],
  plot: [
    {
      id: 'plot_1',
      organizationId: ORG,
      farmId: 'farm_1',
      name: 'Parcelle Kivu',
      areaHa: 2,
      zone: 'Nord-Kivu',
      deletedAt: null,
    },
  ],
  // Le schéma ne porte pas de colonne `zone` : la maille est la province (SOIL-05).
  farm: [{ id: 'farm_1', organizationId: ORG, countryCode: 'CD', province: 'Nord-Kivu' }],
  crop: [
    { id: 'crop_maize', slug: 'maize', name: 'Maïs' },
    { id: 'crop_beans', slug: 'beans', name: 'Haricot' },
  ],
  soilAssessment: [
    {
      id: 'sa_1',
      plotId: 'plot_1',
      organizationId: ORG,
      assessedAt: new Date('2026-02-01'),
      deletedAt: null,
    },
  ],
  soilParameter: [
    { id: 'sp_1', assessmentId: 'sa_1', key: 'ph', value: '6.2', numericValue: 6.2, unit: 'pH', source: 'declared', confidence: 'low' },
    { id: 'sp_2', assessmentId: 'sa_1', key: 'ph', value: '6.4', numericValue: 6.4, unit: 'pH', source: 'measured_lab', confidence: 'high' },
    { id: 'sp_3', assessmentId: 'sa_1', key: 'organicMatter', value: '1.2', numericValue: 1.2, unit: '%', source: 'declared', confidence: 'low' },
  ],
  agronomicRuleSet: [
    {
      id: 'rs_1',
      version: '2026.1',
      zone: 'Nord-Kivu',
      countryCode: 'CD',
      cropSlug: 'maize',
      status: 'validated',
      rules: RULES,
      validatedBy: ['user_agro'],
      validatedAt: new Date('2026-01-15'),
      createdBy: 'user_agro_2',
    },
  ],
  zoneFeatureFlag: [
    { id: 'flag_1', key: 'soil.recommendations', scope: 'zone', scopeValue: 'Nord-Kivu', enabled: true },
  ],
  ...overrides,
});

// ─── S2 / S3 ───────────────────────────────────────────────────────────────

test('SOIL3-01 (SOIL-10→13) : la fusion retient la source la plus fiable (labo > déclaré)', async () => {
  const { fake, restore } = await withFakePrisma(prisma, plotStore());
  try {
    const profile = await intelligence.fuseProfile('plot_1');
    assert.equal(profile.parameters.ph.source, 'measured_lab');
    assert.equal(profile.parameters.ph.numericValue, 6.4);
    assert.equal(profile.parameters.ph.alternatives.length, 1, 'les autres sources sont conservées');
    assert.equal(profile.parameters.ph.alternatives[0].source, 'declared');
    assert.deepEqual(profile.sourcesUsed.includes('measured_lab'), true);
    assert.equal(profile.priorityOrder[0].source, 'measured_lab');
    assert.ok(fake._store.soilAssessment.length === 1);
  } finally {
    restore();
  }
});

test('SOIL2-02 (SOIL-05/08) : compatibilité expliquée, avec critère non satisfait cité', async () => {
  const { fake, restore } = await withFakePrisma(prisma, plotStore());
  try {
    const result = await intelligence.computeSuitability(
      'plot_1',
      { cropId: 'crop_maize' },
      reqAs(ORG, ['FARMER']),
    );

    // pH favorable (2/2), matière organique insuffisante (0/1) => 2/3
    assert.equal(result.level, 'MEDIUM');
    assert.equal(result.ruleSetVersion, '2026.1');
    assert.equal(result.reasons.length, 2);
    assert.equal(result.reasons.find((r) => r.key === 'ph').met, true);
    assert.equal(result.reasons.find((r) => r.key === 'organicMatter').met, false);
    assert.match(result.explanation.summary, /1 critère\(s\) satisfait\(s\) sur 2/);
    assert.ok(result.explanation.unsatisfied.length >= 1);
    assert.match(result.disclaimer, /ne remplace pas/);
    assert.equal(fake._store.cropSuitability.length, 1);
  } finally {
    restore();
  }
});

test('SOIL2-03 (SOIL-09) : données insuffisantes => « insuffisamment documenté », jamais deviné', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    plotStore({
      soilAssessment: [
        {
          id: 'sa_1',
          plotId: 'plot_1',
          organizationId: ORG,
          assessedAt: new Date('2026-02-01'),
          deletedAt: null,
        },
      ],
      soilParameter: [],
    }),
  );
  try {
    const result = await intelligence.computeSuitability('plot_1', { cropId: 'crop_maize' }, reqAs());
    assert.equal(result.level, 'INSUFFICIENTLY_DOCUMENTED');
    assert.equal(result.reasons.length, 0);
    assert.equal(result.missingData.length, 2);
    assert.match(result.explanation.summary, /ne permettent pas de conclure/);
  } finally {
    restore();
  }
});

test('SOIL2-04 (§6.4) : sans activation de la zone, aucune recommandation n’est servie', async () => {
  const { fake, restore } = await withFakePrisma(prisma, plotStore({ zoneFeatureFlag: [] }));
  try {
    await expectStatus(
      intelligence.computeSuitability('plot_1', { cropId: 'crop_maize' }, reqAs()),
      403,
      /pas encore activées/,
    );
    assert.equal(fake._store.cropSuitability.length, 0);
  } finally {
    restore();
  }
});

test('SOIL2-05 (SOIL-04) : un jeu de règles non validé n’est jamais utilisé', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    plotStore({
      agronomicRuleSet: [{ ...plotStore().agronomicRuleSet[0], status: 'draft' }],
    }),
  );
  try {
    await expectStatus(
      intelligence.computeSuitability('plot_1', { cropId: 'crop_maize' }, reqAs()),
      409,
      /Aucun jeu de règles agronomiques validé/,
    );
  } finally {
    restore();
  }
});

test('SOIL2-06 (SOIL-04) : validation impossible par l’auteur du jeu de règles', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    plotStore({
      agronomicRuleSet: [{ ...plotStore().agronomicRuleSet[0], status: 'draft', createdBy: 'user_1' }],
    }),
  );
  try {
    await expectStatus(
      intelligence.validateRuleSet('rs_1', reqAs(ORG, ['AGRONOMIST'], 'user_1')),
      403,
      /séparation des rôles/,
    );
  } finally {
    restore();
  }
});

test('SOIL2-07 (SOIL-04) : validation par un agronome distinct => opposable et auditée', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    plotStore({
      agronomicRuleSet: [{ ...plotStore().agronomicRuleSet[0], status: 'draft', createdBy: 'user_agro_2' }],
    }),
  );
  try {
    const { ruleSet } = await intelligence.validateRuleSet(
      'rs_1',
      reqAs(ORG, ['AGRONOMIST'], 'user_agro'),
    );
    assert.equal(ruleSet.status, 'validated');
    assert.ok(ruleSet.validatedBy.includes('user_agro'));
    assert.ok(ruleSet.validatedAt instanceof Date);
    assert.equal(fake._store.auditLog[0].action, 'ruleset.validate');
  } finally {
    restore();
  }
});

test('SOIL2-08 (SOIL-06) : la rotation proposée est traçable et doit être acceptée', async () => {
  const { fake, restore } = await withFakePrisma(prisma, plotStore());
  try {
    const plan = await intelligence.proposeRotation(
      'plot_1',
      { cropId: 'crop_maize', horizonYears: 2 },
      reqAs(),
    );
    assert.equal(plan.status, 'PROPOSED');
    assert.equal(plan.ruleSetVersion, '2026.1');
    assert.equal(plan.steps.sequence.length, 2);
    assert.equal(plan.steps.sequence[1].family, 'légumineuse');

    const decided = await intelligence.decideRotation(
      'plot_1',
      plan.id,
      { decision: 'ACCEPTED' },
      reqAs(),
    );
    assert.equal(decided.status, 'ACCEPTED');
    await expectStatus(
      intelligence.decideRotation('plot_1', plan.id, { decision: 'REJECTED' }, reqAs()),
      409,
      /déjà été statué/,
    );
    assert.equal(fake._store.rotationPlan.length, 1);
  } finally {
    restore();
  }
});

test('SOIL2-09 (SOIL-07) : le plan agricole suit le calendrier du jeu de règles', async () => {
  const { restore } = await withFakePrisma(prisma, plotStore());
  try {
    const plan = await intelligence.proposeFarmingPlan('plot_1', { horizonYears: 2 }, reqAs());
    assert.equal(plan.horizonYears, 2);
    assert.ok(plan.calendar.entries.length >= 2);
    assert.ok(plan.calendar.entries.every((e) => e.window.startMonth >= 1 && e.window.endMonth <= 12));
    assert.ok(plan.checkpoints.items.length >= 1, 'les points de contrôle sont extraits du calendrier');
  } finally {
    restore();
  }
});

test('SOIL3-10 (SOIL-14) : rendement en fourchette, jamais un chiffre garanti', async () => {
  const { fake, restore } = await withFakePrisma(prisma, plotStore());
  try {
    const estimate = await intelligence.estimateYield(
      'plot_1',
      { cropId: 'crop_maize' },
      reqAs(),
    );
    assert.ok(estimate.lowKg < estimate.pointKg);
    assert.ok(estimate.pointKg < estimate.highKg);
    assert.equal(estimate.lowKg, 1200 * 2 * 0.8);
    assert.equal(estimate.highKg, 2000 * 2);
    assert.ok(estimate.uncertaintyPct > 0);
    assert.match(estimate.disclaimer, /garantie/i);
    assert.equal(estimate.sources.ruleSetVersion, '2026.1');
    assert.equal(fake._store.yieldEstimate.length, 1);
  } finally {
    restore();
  }
});

test('SOIL3-11 (SOIL-14) : sans référence de rendement, aucune estimation n’est inventée', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    plotStore({
      agronomicRuleSet: [
        { ...plotStore().agronomicRuleSet[0], rules: { criteria: RULES.criteria } },
      ],
    }),
  );
  try {
    await expectStatus(
      intelligence.estimateYield('plot_1', { cropId: 'crop_maize' }, reqAs()),
      409,
      /Aucune référence de rendement/,
    );
  } finally {
    restore();
  }
});

test('SOIL3-12 (SOIL-13) : GET /plots/:id/soil-profile expose le profil fusionné et ses priorités', async () => {
  const { restore } = await withFakePrisma(prisma, plotStore());
  try {
    const profile = await soilService.latestProfile('plot_1', reqAs());
    assert.equal(profile.plotId, 'plot_1');
    assert.equal(profile.fusedProfile.ph.source, 'measured_lab');
    assert.deepEqual(profile.missingParameters, ['texture', 'n', 'p', 'k']);
    assert.equal(profile.sourcePriority[0].source, 'measured_lab');
    assert.match(profile.disclaimer, /Aucune recommandation/);
  } finally {
    restore();
  }
});

// ─── USSD / WhatsApp ───────────────────────────────────────────────────────

test('USSD-01 : menu sans état, réponse courte, session et messages tracés', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    baseStore({ marketPrice: [], crop: [], weatherData: [] }),
  );
  try {
    const menu = await channels.ussd({ phoneNumber: '+243900000001', text: '' });
    assert.match(menu.body, /1\. Prix du marche/);
    assert.equal(menu.end, false);
    assert.ok(menu.body.length <= 182, 'réponse compatible USSD (182 caractères)');
    assert.equal(fake._store.channelSession.length, 1);

    const prices = await channels.ussd({ phoneNumber: '+243900000001', text: '1' });
    assert.match(prices.body, /Aucun prix publie/);

    const closed = await channels.ussd({ phoneNumber: '+243900000001', text: '0' });
    assert.equal(closed.end, true);
    assert.equal(closed.state, 'CLOSED');
    assert.equal(fake._store.channelMessage.length, 6, 'chaque entrée/sortie est journalisée');
  } finally {
    restore();
  }
});

test('USSD-01 (V3:NFR-07) : un menu ne dépasse jamais 4 niveaux', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    baseStore({ marketPrice: [], crop: [], weatherData: [] }),
  );
  try {
    assert.equal(channels.MAX_USSD_DEPTH, 4, 'profondeur annoncée par le CDC');

    // 4 niveaux : accepté (le service traite la saisie).
    const deep = await channels.ussd({ phoneNumber: '+243900000002', text: '4*AK-CD-2026-00001*1*1' });
    assert.notEqual(deep.state, 'MENU');

    // 5 niveaux : la session est ramenée au menu principal, sans erreur.
    const tooDeep = await channels.ussd({ phoneNumber: '+243900000002', text: '1*2*3*4*5' });
    assert.equal(tooDeep.state, 'MENU');
    assert.match(tooDeep.body, /1\. Prix du marche/);
    assert.ok(tooDeep.body.length <= 182, 'réponse toujours compatible agrégateur');

    const rejected = fake._store.channelMessage.filter(
      (message) => message.payload?.reason === 'depth_exceeded',
    );
    assert.equal(rejected.length, 1, 'le refus est journalisé');
  } finally {
    restore();
  }
});

test('WA-01 : le webhook répond sans exposer de donnée personnelle', async () => {
  const { fake, restore } = await withFakePrisma(prisma, baseStore());
  try {
    const payload = {
      entry: [{ changes: [{ value: { messages: [{ from: '+243900000002', id: 'wamid.1', type: 'text', text: { body: 'menu' } }] } }] }],
    };
    const result = await channels.whatsappWebhook(payload);
    assert.equal(result.received, 1);
    assert.match(result.processed[0].answer, /AGRIKONNECT/);
    assert.equal(result.processed[0].phone, '+243900000002');
    assert.equal(fake._store.channelMessage.length, 2);
    assert.equal(fake._store.channelMessage[0].direction, 'IN');
    assert.equal(fake._store.channelMessage[1].direction, 'OUT');
  } finally {
    restore();
  }
});

// ─── MFA TOTP (V4 NFR-01) ─────────────────────────────────────────────────

test('MFA-01 (NFR-01) : TOTP conforme RFC 6238 et secret jamais stocké en clair', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    baseStore({ profile: [{ id: 'user_inv', mfaEnabled: false }] }),
  );
  try {
    const enrollment = await mfa.setup(reqAs(ORG, ['INVESTOR'], 'user_inv'));
    assert.match(enrollment.otpauthUrl, /^otpauth:\/\/totp\//);
    assert.equal(enrollment.otpauthUrl.includes(enrollment.secret), true);

    const stored = fake._store.mfaSecret[0];
    assert.notEqual(stored.secretHash, enrollment.secret, 'secret chiffré en base');
    assert.match(stored.secretHash, /^v1:/);

    const code = mfa.currentCode(enrollment.secret);
    const confirmed = await mfa.confirm({ code }, reqAs(ORG, ['INVESTOR'], 'user_inv'));
    assert.equal(confirmed.mfaEnabled, true);
    assert.equal(confirmed.backupCodes.length, 8);
    assert.equal(fake._store.mfaSecret[0].backupCodesHashes.length, 8, 'codes de secours hachés');
    assert.notEqual(fake._store.mfaSecret[0].backupCodesHashes[0], confirmed.backupCodes[0]);
  } finally {
    restore();
  }
});

test('MFA-02 (NFR-01) : un code faux est refusé, un code de secours n’est utilisable qu’une fois', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({ profile: [{ id: 'user_inv', mfaEnabled: false }] }),
  );
  try {
    const enrollment = await mfa.setup(reqAs(ORG, ['INVESTOR'], 'user_inv'));
    const req = reqAs(ORG, ['INVESTOR'], 'user_inv');
    const confirmed = await mfa.confirm({ code: mfa.currentCode(enrollment.secret) }, req);

    await expectStatus(mfa.assertMfa('user_inv', '000000'), 401, /invalide/);

    const backup = confirmed.backupCodes[0];
    const first = await mfa.assertMfa('user_inv', backup);
    assert.equal(first.method, 'BACKUP_CODE');
    assert.equal(first.remainingBackupCodes, 7);
    await expectStatus(mfa.assertMfa('user_inv', backup), 401, /invalide/);
  } finally {
    restore();
  }
});

test('MFA-03 (NFR-01) : sans enrôlement, une opération sensible est refusée avec un code explicite', async () => {
  const { restore } = await withFakePrisma(prisma, baseStore());
  try {
    await expectStatus(mfa.assertMfa('user_sans_mfa', '123456'), 403, /Double authentification requise/);
  } finally {
    restore();
  }
});

test('MFA-04 (NFR-01 / SEC-08) : en production, aucune clé de chiffrement par défaut', () => {
  // Hors production : la clé de service ou la clé de développement suffit.
  assert.equal(
    mfa.resolveEncryptionMaterial({ isProd: false, serviceRoleKey: 'service-role' }),
    'service-role',
  );
  assert.equal(mfa.resolveEncryptionMaterial({ isProd: false }), 'agrikon-dev-mfa-key');

  // En production : seule une clé dédiée est acceptée, sinon refus explicite.
  assert.equal(
    mfa.resolveEncryptionMaterial({ isProd: true, dedicatedKey: 'cle-dediee' }),
    'cle-dediee',
  );
  assert.throws(
    () => mfa.resolveEncryptionMaterial({ isProd: true, serviceRoleKey: 'service-role' }),
    (error) => error.status === 500 && /MFA_ENCRYPTION_KEY/.test(error.message),
    'la clé de service ne doit pas servir de clé MFA en production',
  );
  assert.throws(
    () => mfa.resolveEncryptionMaterial({ isProd: true }),
    (error) => error.status === 500 && /MFA_ENCRYPTION_KEY/.test(error.message),
  );
});

// ─── COOP-10 ───────────────────────────────────────────────────────────────

const coopStore = (overrides = {}) => ({
  ...baseStore(),
  cooperative: [{ id: 'coop_1', organizationId: ORG, deletedAt: null }],
  cooperativeMember: [
    { id: 'cm_1', cooperativeId: 'coop_1', memberUserId: 'u1', status: 'ACTIVE', consentScopes: ['productions'] },
    { id: 'cm_2', cooperativeId: 'coop_1', memberUserId: 'u2', status: 'ACTIVE', consentScopes: ['productions'] },
    { id: 'cm_3', cooperativeId: 'coop_1', memberUserId: 'u3', status: 'ACTIVE', consentScopes: [] },
  ],
  membership: [
    { id: 'm1', userId: 'u1', organizationId: 'org_u1', status: 'ACTIVE' },
    { id: 'm2', userId: 'u2', organizationId: 'org_u2', status: 'ACTIVE' },
    { id: 'm3', userId: 'u3', organizationId: 'org_u3', status: 'ACTIVE' },
  ],
  production: [
    { id: 'p1', organizationId: 'org_u1', cropId: 'crop_maize', quantity: 1000, unit: 'kg', quantityKg: 1000, season: '2026A', harvestedAt: new Date('2026-06-01'), deletedAt: null, source: 'declared' },
    { id: 'p2', organizationId: 'org_u2', cropId: 'crop_maize', quantity: 2, unit: 't', quantityKg: 2000, season: '2026A', harvestedAt: new Date('2026-06-02'), deletedAt: null, source: 'declared' },
    { id: 'p3', organizationId: 'org_u3', cropId: 'crop_maize', quantity: 500, unit: 'kg', quantityKg: 500, season: '2026A', harvestedAt: new Date('2026-06-03'), deletedAt: null, source: 'declared' },
    { id: 'p4', organizationId: 'org_u1', cropId: 'crop_maize', quantity: 3, unit: 'sac', quantityKg: null, season: '2026A', harvestedAt: new Date('2026-06-04'), deletedAt: null, source: 'declared' },
  ],
  groupOffer: [],
  listing: [],
  organization: [{ id: ORG, name: 'Coopérative Kivu', countryCode: 'CD' }],
  auditLog: [],
  ...overrides,
});

test('COOPG-01 (COOP-10) : seules les productions des membres consentants sont agrégées', async () => {
  const { restore } = await withFakePrisma(prisma, coopStore());
  try {
    const pool = await groupOffers.previewPool('coop_1', { cropId: 'crop_maize' }, reqAs());
    assert.equal(pool.totalKg, 3000, 'u3 n’a pas consenti : sa production est exclue');
    assert.equal(pool.memberCount, 2);
    assert.equal(pool.excludedMembers.length, 1);
    assert.match(pool.excludedMembers[0].reason, /consentement/);
  } finally {
    restore();
  }
});

test('COOPG-02 (COOP-10) : répartition figée, traçable, et unités non convertibles signalées', async () => {
  const { fake, restore } = await withFakePrisma(prisma, coopStore());
  try {
    const { offer } = await groupOffers.createGroupOffer(
      'coop_1',
      { cropId: 'crop_maize', title: 'Maïs coop Kivu', season: '2026A' },
      reqAs(),
    );

    assert.equal(offer.quantity, 3000);
    const split = offer.split.members;
    assert.equal(split.length, 2);
    const u1 = split.find((s) => s.memberOrganizationId === 'org_u1');
    assert.equal(u1.quantityKg, 1000);
    assert.deepEqual(u1.productionIds, ['p1']);
    assert.ok(Math.abs(u1.share - 0.3333) < 0.001, 'part calculée sur le total réel');
    assert.equal(split.reduce((sum, s) => sum + s.share, 0).toFixed(2), '1.00');
    assert.equal(offer.split.unconvertible.length, 1, 'les sacs ne sont pas convertis arbitrairement');
    assert.equal(fake._store.auditLog[0].action, 'coop.groupoffer.create');
  } finally {
    restore();
  }
});

test('COOPG-03 (COOP-10) : la confirmation crée une annonce en brouillon, jamais publiée d’office', async () => {
  const { fake, restore } = await withFakePrisma(prisma, coopStore());
  try {
    const { offer } = await groupOffers.createGroupOffer(
      'coop_1',
      { cropId: 'crop_maize', title: 'Maïs coop Kivu' },
      reqAs(),
    );
    const result = await groupOffers.confirmGroupOffer('coop_1', offer.id, reqAs());

    assert.equal(result.offer.status, 'CONFIRMED');
    assert.equal(result.listing.status, 'DRAFT');
    assert.equal(result.listing.quantity, 3000);
    assert.match(result.listing.description, /2 membre\(s\) contributeur\(s\)/);
    await expectStatus(
      groupOffers.confirmGroupOffer('coop_1', offer.id, reqAs()),
      409,
      /déjà été statuée/,
    );
    assert.equal(fake._store.groupOffer.length, 1);
  } finally {
    restore();
  }
});

// ─── INV-02 / INV-03 / PRJ-04 ─────────────────────────────────────────────

const investorStore = (overrides = {}) => ({
  ...baseStore(),
  investorProfile: [
    {
      id: 'ip_1',
      userId: 'user_inv',
      displayName: 'Fonds Sahel',
      sectors: ['AGRICULTURE'],
      countries: ['CD'],
      ticketMin: 10000,
      ticketMax: 500000,
      currency: 'USD',
      verifiedAt: new Date('2026-01-01'),
    },
  ],
  project: [
    {
      id: 'prj_1',
      slug: 'mais-kivu',
      title: 'Maïs Kivu',
      sector: 'AGRICULTURE',
      countryCode: 'CD',
      organizationId: OTHER,
      status: 'PUBLISHED',
      deletedAt: null,
      fundingNeed: { amount: 120000, currency: 'USD' },
      updatedAt: new Date('2026-09-01'),
    },
    {
      id: 'prj_2',
      slug: 'elevage-sahel',
      title: 'Élevage Sahel',
      sector: 'ELEVAGE',
      countryCode: 'SN',
      organizationId: OTHER,
      status: 'PUBLISHED',
      deletedAt: null,
      fundingNeed: { amount: 900000, currency: 'USD' },
      updatedAt: new Date('2026-08-01'),
    },
  ],
  projectFollow: [],
  projectContactRequest: [],
  membership: [{ id: 'mem_owner', userId: 'user_owner', organizationId: OTHER, status: 'ACTIVE' }],
  notification: [],
  notificationPreference: [],
  auditLog: [],
  ...overrides,
});

test('INVH-01 (INV-03) : le matching affiche les critères, sans score ni notation', async () => {
  const { restore } = await withFakePrisma(prisma, investorStore());
  try {
    const result = await hub.matches({ limit: 10 }, reqAs(ORG, ['INVESTOR'], 'user_inv'));

    // Seuls les projets satisfaisant au moins un critère sont retenus : prj_2
    // (autre secteur, autre pays, hors ticket) n'apparaît pas.
    assert.equal(result.items.length, 1);
    const first = result.items[0];
    assert.equal(first.projectId, 'prj_1');
    assert.equal(first.criteriaMet, 3);
    assert.match(first.explanation, /✔ Secteur recherché/);
    assert.match(first.explanation, /✔ Pays ciblé/);
    assert.equal('score' in first, false, 'aucun score exposé');
    assert.equal('percentage' in first, false);
    assert.match(result.regulatory, /Aucun conseil en investissement/);
  } finally {
    restore();
  }
});

test('INVH-02 (INV-02) : suivre puis ne plus suivre un projet est idempotent et tracé', async () => {
  const { fake, restore } = await withFakePrisma(prisma, investorStore());
  try {
    const first = await hub.follow('prj_1', reqAs(ORG, ['INVESTOR'], 'user_inv'));
    assert.equal(first.followed, true);
    assert.equal(first.alreadyFollowing, false);

    const second = await hub.follow('prj_1', reqAs(ORG, ['INVESTOR'], 'user_inv'));
    assert.equal(second.alreadyFollowing, true);
    assert.equal(fake._store.projectFollow.length, 1, 'aucun doublon');

    const list = await hub.listFollowed(reqAs(ORG, ['INVESTOR'], 'user_inv'));
    assert.equal(list.items[0].slug, 'mais-kivu');

    const removed = await hub.unfollow('prj_1', reqAs(ORG, ['INVESTOR'], 'user_inv'));
    assert.equal(removed.followed, false);
    assert.equal(fake._store.projectFollow.length, 0);
  } finally {
    restore();
  }
});

test('INVH-03 (PRJ-04) : la mise en relation n’expose aucune coordonnée avant acceptation', async () => {
  const { fake, restore } = await withFakePrisma(prisma, investorStore());
  try {
    const result = await hub.requestContact(
      'prj_1',
      { message: 'Bonjour, je souhaite en savoir plus sur votre projet.' },
      reqAs(ORG, ['INVESTOR'], 'user_inv'),
    );
    assert.equal(result.request.status, 'PENDING');
    assert.equal(result.disclosure.includes('Aucune coordonnée'), true);
    assert.equal(fake._store.notification.length, 1, 'le porteur est notifié');
    assert.equal(fake._store.notification[0].userId, 'user_owner');
    assert.equal(fake._store.projectContactRequest[0].message.length > 10, true);

    await expectStatus(
      hub.requestContact('prj_1', { message: 'Encore une demande identique svp' }, reqAs(ORG, ['INVESTOR'], 'user_inv')),
      409,
      /déjà en attente/,
    );
  } finally {
    restore();
  }
});

test('INVH-04 (PRJ-04) : seul le porteur du projet peut statuer, et le refus reste silencieux', async () => {
  const { restore } = await withFakePrisma(prisma, investorStore());
  try {
    const created = await hub.requestContact(
      'prj_1',
      { message: 'Demande de mise en relation détaillée.' },
      reqAs(ORG, ['INVESTOR'], 'user_inv'),
    );

    await expectStatus(
      hub.decideContact('prj_1', created.request.id, { decision: 'ACCEPTED' }, reqAs(ORG, ['FARMER'], 'user_intrus')),
      404,
    );

    const decided = await hub.decideContact(
      'prj_1',
      created.request.id,
      { decision: 'DECLINED' },
      reqAs(OTHER, ['FARMER'], 'user_owner'),
    );
    assert.equal(decided.request.status, 'DECLINED');
    assert.equal(decided.contactShared, false);
  } finally {
    restore();
  }
});

// ─── PUB-03 / TRC-03 / SOIL-16 ────────────────────────────────────────────

test('PUB-03 : le QR encode uniquement l’URL publique (PNG et SVG)', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      farm: [{ id: 'farm_1', slug: 'ferme-kivu', name: 'Ferme Kivu', isPublic: true, deletedAt: null }],
    }),
  );
  try {
    const png = await publicService.farmQr('ferme-kivu', { format: 'png', size: 256 });
    assert.equal(png.contentType, 'image/png');
    assert.ok(png.buffer.length > 100);
    assert.equal(png.buffer.subarray(1, 4).toString(), 'PNG');
    // `/public/farms/:slug` est la route web réelle ; `/farm/:slug` n'en est
    // pas une et tombait sur AppNotFound (voir tests/webLinks.test.mjs).
    assert.match(png.payload.url, /\/public\/farms\/ferme-kivu$/);
    assert.equal(png.payload.encodes, 'URL publique uniquement');

    const svg = await publicService.farmQr('ferme-kivu', { format: 'svg' });
    assert.equal(svg.contentType, 'image/svg+xml');
    assert.match(svg.buffer.toString('utf8'), /^<\?xml|^<svg/);
  } finally {
    restore();
  }
});

test('PUB-03 : un profil non publié n’a pas de QR', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({ farm: [{ id: 'farm_1', slug: 'ferme-privee', isPublic: false, deletedAt: null }] }),
  );
  try {
    await expectStatus(publicService.farmQr('ferme-privee', { format: 'png' }), 404);
  } finally {
    restore();
  }
});

test('TRC-03 : la page publique de lot masque les étapes non publiques', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      traceabilityLot: [
        {
          id: 'lot_1',
          code: 'AK-CD-2026-0001',
          cropId: 'crop_maize',
          status: 'CLOSED',
          quantityKg: 1200,
          publicFields: { origin: 'Nord-Kivu', locationsVisible: true },
        },
      ],
      crop: [{ id: 'crop_maize', slug: 'maize', names: { fr: 'Maïs' } }],
      lotEvent: [
        { id: 'le_1', lotId: 'lot_1', type: 'HARVEST', at: new Date('2026-06-01'), details: { public: true, text: 'Récolte' }, location: { lat: 1 }, source: 'declared' },
        { id: 'le_2', lotId: 'lot_1', type: 'TRANSPORT', at: new Date('2026-06-02'), details: { public: false, text: 'Interne' }, location: { lat: 2 }, source: 'declared' },
      ],
    }),
  );
  try {
    const page = await traceabilityService.publicView('AK-CD-2026-0001');
    assert.equal(page.crop.name, 'Maïs');
    assert.equal(page.timeline.length, 2, 'toutes les étapes sont listées par type et par date');
    assert.equal(page.timeline[0].type, 'HARVEST');
    // Aucun détail interne, aucune coordonnée, aucun acteur : la vue publique
    // ne montre que des types et des dates.
    assert.equal(page.timeline[0].details, undefined);
    assert.equal(page.timeline[0].location, undefined);
    assert.equal(page.quantityKg, undefined, 'la quantité n’est pas publiée par défaut');
    assert.equal(page.verification.certification, false);
    assert.match(page.verification.note, /n’est pas une certification/);
    assert.ok(page.disclosure.hiddenFields.includes('plotId'));
  } finally {
    restore();
  }
});

test('SOIL5-01 (SOIL-16) : k-anonymat ≥ 10 — les groupes trop petits sont supprimés', async () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    id: `sa_${i}`,
    plotId: `plot_${i}`,
    organizationId: ORG,
    countryCode: 'CD',
    assessedAt: new Date('2026-01-01'),
    deletedAt: null,
  }));
  const manyParameters = Array.from({ length: 12 }, (_, i) => ({
    id: `sp_${i}`,
    assessmentId: `sa_${i}`,
    key: 'ph',
    value: String(6 + i * 0.01),
    numericValue: 6 + i * 0.01,
    unit: 'pH',
    source: 'measured_lab',
  }));
  const small = [
    {
      id: 'sa_x',
      plotId: 'plot_x',
      organizationId: ORG,
      countryCode: 'SN',
      assessedAt: new Date('2026-01-01'),
      deletedAt: null,
    },
  ];
  const smallParameters = [
    { id: 'sp_x', assessmentId: 'sa_x', key: 'ph', value: '5', numericValue: 5, unit: 'pH', source: 'declared' },
  ];

  const { restore } = await withFakePrisma(
    prisma,
    baseStore({ soilAssessment: [...many, ...small], soilParameter: [...manyParameters, ...smallParameters] }),
  );
  try {
    const stats = await publicService.soilStats({});
    assert.equal(stats.kAnonymity, 10);
    assert.equal(stats.rows.length, 1, 'seul le pays avec ≥ 10 analyses est publié');
    assert.equal(stats.rows[0].countryCode, 'CD');
    assert.equal(stats.rows[0].assessments, 12);
    assert.equal(stats.suppressedGroups[0].countryCode, 'SN');
    assert.match(stats.suppressedGroups[0].reason, /k < 10/);
    assert.equal(stats.rows[0].parameters[0].parameter, 'ph');
    assert.match(stats.provenance.individuals, /aucune parcelle/);
  } finally {
    restore();
  }
});

// ─── BIL-01 / SYNC-02 ─────────────────────────────────────────────────────

test('BIL-01 : la facture est produite en PDF, avec la mention « aucun encaissement »', async () => {
  const invoice = {
    id: 'inv_1',
    organizationId: ORG,
    number: 'FAC-2026-00001',
    sequence: 1,
    type: 'INVOICE',
    lines: [{ description: 'Maïs', quantity: 10, unitPrice: 25, lineTotal: 250 }],
    currency: 'USD',
    totalAmount: 250,
    issuerOrgId: ORG,
    recipientOrgId: OTHER,
    issuedAt: new Date('2026-09-01'),
  };

  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      invoice: [invoice],
      organization: [
        { id: ORG, name: 'Coopérative Kivu' },
        { id: OTHER, name: 'Acheteur SARL' },
      ],
    }),
  );
  try {
    const { buffer, filename } = await billingService.invoicePdf('inv_1', reqAs());
    assert.equal(filename, 'FAC-2026-00001.pdf');
    assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
    assert.ok(buffer.length > 500);
  } finally {
    restore();
  }
});

test('BIL-01 : une facture d’une autre organisation est invisible', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      invoice: [
        {
          id: 'inv_1',
          organizationId: 'org_autre',
          number: 'FAC-2026-00009',
          lines: [],
          currency: 'USD',
          totalAmount: 10,
          issuerOrgId: 'org_autre',
          recipientOrgId: null,
          issuedAt: new Date(),
        },
      ],
    }),
  );
  try {
    await expectStatus(billingService.invoicePdf('inv_1', reqAs()), 404);
  } finally {
    restore();
  }
});

test('SYNC-02 : le pull renvoie les changements du tenant uniquement, avec curseur', async () => {
  const since = new Date('2026-01-01T00:00:00.000Z');
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      plot: [
        { id: 'plot_a', organizationId: ORG, name: 'A', updatedAt: new Date('2026-02-01'), version: 2, deletedAt: null },
        { id: 'plot_b', organizationId: OTHER, name: 'B', updatedAt: new Date('2026-02-01'), version: 1, deletedAt: null },
        { id: 'plot_c', organizationId: ORG, name: 'C', updatedAt: new Date('2025-12-01'), version: 1, deletedAt: null },
      ],
      production: [],
    }),
  );
  try {
    const result = await syncService.pull(
      { since: '2026-01-01T00:00:00.000Z', collections: 'plots', limit: 10 },
      reqAs(),
    );

    assert.equal(result.changes.plots.length, 1, 'seule la parcelle du tenant et postérieure au curseur');
    assert.equal(result.changes.plots[0].id, 'plot_a');
    assert.equal(result.cursor, '2026-02-01T00:00:00.000Z');
    assert.equal(result.hasMore, false);
    assert.ok(new Date(result.since).getTime() === since.getTime());
    assert.match(result.policy.tombstones, /deleted: true/);
  } finally {
    restore();
  }
});

test('SYNC-02 : une collection inconnue est refusée explicitement', async () => {
  const { restore } = await withFakePrisma(prisma, baseStore());
  try {
    await expectStatus(syncService.pull({ collections: 'secrets' }, reqAs()), 422, /Collections inconnues/);
  } finally {
    restore();
  }
});

// ─── V5 §6 — API publique normalisée ──────────────────────────────────────

test('API-05 (V5 §6) : l’API publique retire les régions sous le k-anonymat', async () => {
  const publicApi = await import('../src/modules/publicapi/publicapi.service.js');
  const many = Array.from({ length: 12 }, (_, i) => ({
    id: `farm_${i}`,
    countryCode: 'CD',
    province: 'Nord-Kivu',
    isPublic: true,
    deletedAt: null,
  }));
  const few = [
    { id: 'farm_x', countryCode: 'SN', province: 'Thiès', isPublic: true, deletedAt: null },
  ];

  const { restore } = await withFakePrisma(prisma, baseStore({ farm: [...many, ...few] }));
  try {
    const overview = await publicApi.getAgricultureOverview({});
    assert.equal(overview.kAnonymity, 10);
    assert.equal(overview.regions.length, 1);
    assert.equal(overview.regions[0].countryCode, 'CD');
    assert.equal(overview.suppressedRegions, 1);
    assert.match(overview.provenance.rule, /moins de 10 exploitations/);

    const regions = await publicApi.getRegions({});
    assert.equal(regions.items[0].province, 'Nord-Kivu');
    assert.equal(regions.withheld, 1);
  } finally {
    restore();
  }
});

test('API-06 (V5 §6) : /farmers refuse de publier sous le seuil de k-anonymat', async () => {
  const publicApi = await import('../src/modules/publicapi/publicapi.service.js');
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      farm: [
        { id: 'farm_1', slug: 'f1', name: 'F1', countryCode: 'CD', isPublic: true, deletedAt: null },
        { id: 'farm_2', slug: 'f2', name: 'F2', countryCode: 'CD', isPublic: true, deletedAt: null },
      ],
    }),
  );
  try {
    await expectStatus(publicApi.getFarmers({}), 403, /k-anonymat/);
  } finally {
    restore();
  }
});

test('API-07 (V5 §6) : /market-prices conserve date et source de chaque prix', async () => {
  const publicApi = await import('../src/modules/publicapi/publicapi.service.js');
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      marketPrice: [
        {
          id: 'mp_1',
          cropId: 'crop_maize',
          market: 'Kinshasa',
          city: 'Kinshasa',
          countryCode: 'CD',
          price: 1.2,
          currency: 'USD',
          unit: 'kg',
          observedAt: new Date('2026-09-30'),
          source: 'AGENT',
          sourceLabel: 'Agent de marché',
        },
      ],
      crop: [{ id: 'crop_maize', slug: 'maize', names: { fr: 'Maïs' } }],
    }),
  );
  try {
    const prices = await publicApi.getMarketPrices({});
    assert.equal(prices.items[0].crop, 'Maïs');
    assert.equal(prices.items[0].source, 'Agent de marché');
    assert.equal(prices.items[0].observedAt.toISOString().slice(0, 10), '2026-09-30');
    assert.match(prices.freshness, /date d’observation/);
  } finally {
    restore();
  }
});

// ─── PLOT-05 / PUB-05 : contrôles de cohérence géographique et d'indexation ───

const countryStore = (bounds) => ({
  country: [{ code: 'CD', name: 'RD Congo', complianceProfile: bounds ? { bounds } : {} }],
  farm: [{ id: 'farm_1', organizationId: ORG, countryCode: 'CD', deletedAt: null }],
  plot: [],
  auditLog: [],
});

test('PLOT-05 : un point hors du pays déclaré est refusé', async () => {
  const plotsService = await import('../src/modules/plots/plots.service.js');
  const { restore } = await withFakePrisma(
    prisma,
    countryStore({ minLat: -13.5, maxLat: 5.4, minLng: 12.2, maxLng: 31.3 }),
  );
  try {
    await expectStatus(
      plotsService.create(
        { farmId: 'farm_1', name: 'Parcelle hors pays', geometry: { type: 'Point', coordinates: [2.35, 48.85] } },
        reqAs(),
      ),
      422,
      /hors du pays déclaré/,
    );

    const inside = await plotsService.create(
      { farmId: 'farm_1', name: 'Parcelle Kivu', geometry: { type: 'Point', coordinates: [29.22, -1.68] } },
      reqAs(),
    );
    assert.equal(inside.locationCheck.checked, true);
    assert.equal(inside.locationCheck.inside, true);
  } finally {
    restore();
  }
});

test('PLOT-05 : sans bornes documentées, le contrôle n’est pas simulé', async () => {
  const plotsService = await import('../src/modules/plots/plots.service.js');
  const { restore } = await withFakePrisma(prisma, countryStore(null));
  try {
    const result = await plotsService.create(
      { farmId: 'farm_1', name: 'Parcelle', geometry: { type: 'Point', coordinates: [29.22, -1.68] } },
      reqAs(),
    );
    assert.equal(result.locationCheck.checked, false);
    assert.match(result.locationCheck.reason, /bornes du pays non documentées/);
  } finally {
    restore();
  }
});

test('PUB-05 : un profil non vérifié est en noindex, un profil vérifié est indexable', async () => {
  const base = {
    id: 'farm_1',
    slug: 'ferme-kivu',
    name: 'Ferme Kivu',
    description: 'Exploitation',
    countryCode: 'CD',
    isPublic: true,
    deletedAt: null,
    viewCount: 0,
    totalAreaHa: 10,
    // Le double n'applique pas les `include` : on fournit les relations déjà jointes.
    crops: [],
    media: [],
    _count: { plots: 0 },
    organization: { id: ORG, name: 'Coop', memberships: [] },
  };

  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      farm: [
        { ...base, verifiedAt: null, verificationStatus: null },
        { ...base, id: 'farm_2', slug: 'ferme-verifiee', verifiedAt: new Date('2026-05-01'), verificationStatus: 'VERIFIED' },
      ],
      crop: [],
      media: [],
      membership: [],
      plot: [],
      organization: [{ id: ORG, deletedAt: null }],
      farmCrop: [],
    }),
  );
  try {
    // Les projections publiques sont testées au niveau du service : le profil
    // non vérifié porte noindex, le profil vérifié index,follow.
    const unverified = await publicService.getFarmBySlug('ferme-kivu', {});
    assert.equal(unverified.farm.seo.indexable, false);
    assert.equal(unverified.farm.seo.robots, 'noindex,follow');

    const verified = await publicService.getFarmBySlug('ferme-verifiee', {});
    assert.equal(verified.farm.seo.indexable, true);
    assert.equal(verified.farm.seo.robots, 'index,follow');
  } finally {
    restore();
  }
});
