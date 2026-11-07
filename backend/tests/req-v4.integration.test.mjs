/**
 * Preuves d'acceptation — V4 (investissement, data room, financement).
 *
 * V4 ne manipule aucun fonds et ne note aucun projet : chaque preuve vérifie
 * autant l'absence (pas de paiement, pas de score) que la présence des règles.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';

import * as projectsService from '../src/modules/projects/projects.service.js';
import * as dataroomService from '../src/modules/dataroom/dataroom.service.js';
import * as dueDiligenceService from '../src/modules/duediligence/duediligence.service.js';
import * as reportingService from '../src/modules/reporting/reporting.service.js';
import * as fundingService from '../src/modules/funding/funding.service.js';
import * as precisionService from '../src/modules/precision/precision.service.js';
import * as investorsService from '../src/modules/investors/investors.service.js';

const ORG = 'org_porteur';
const INVESTOR = 'org_investisseur';

const reqAs = (organizationId = ORG, roles = ['PRODUCER'], userId = 'user_1') => ({
  tenant: { organizationId, effectiveRoles: roles },
  user: { id: userId, roles },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
  query: {},
  requestId: 'req_test',
});

const store = (overrides = {}) => ({
  project: [],
  projectDocument: [],
  dataRoomAccessRequest: [],
  dataRoomAccessLog: [],
  dueDiligenceItem: [],
  progressReport: [],
  impactReport: [],
  fundingRequest: [],
  precisionReport: [],
  investorProfile: [],
  plot: [{ id: 'plot_1', organizationId: ORG, farmId: 'farm_1', name: 'Parcelle Kivu', areaHa: 2, deletedAt: null }],
  farm: [{ id: 'farm_1', organizationId: ORG, countryCode: 'CD' }],
  membership: [],
  notification: [],
  auditLog: [],
  organization: [],
  profile: [],
  satelliteObservation: [],
  managementZone: [],
  soilAssessment: [],
  soilParameter: [],
  sensorReading: [],
  sensorAnomaly: [],
  iotDevice: [],
  crop: [],
  production: [],
  document: [],
  ...overrides,
});

const expectStatus = async (promise, status, pattern = null) => {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, status, `statut attendu ${status}, reçu ${error.status} (${error.message})`);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
};

const project = (overrides = {}) => ({
  id: 'prj_1',
  organizationId: ORG,
  title: 'Extension manioc Kivu',
  slug: 'extension-manioc-kivu',
  sector: 'AGRICULTURE',
  countryCode: 'CD',
  status: 'PUBLISHED',
  deletedAt: null,
  fieldStatus: {},
  fundingNeed: { amount: 50000, currency: 'USD' },
  ...overrides,
});

/* ───────────────────────── PROJETS ───────────────────────── */

test('PRJ-02 : la provenance est exposée champ par champ, jamais globale', async () => {
  const summary = projectsService.provenanceSummary({
    'fundingNeed.amount': { source: 'declared' },
    'existingAreaHa': { source: 'platform_verified' },
    'currentProduction': { source: 'measured_lab' },
  });

  assert.equal(summary.fields.length, 3);
  const funding = summary.fields.find((f) => f.field === 'fundingNeed.amount');
  assert.equal(funding.source, 'declared');
  assert.match(funding.label, /déclaré/i, 'libellé lisible, pas un code technique');
  assert.equal(summary.verified, 2, 'les champs vérifiés sont comptés séparément');
  assert.equal(summary.declaredOnly, 1);
  assert.match(summary.disclosure, /déclaratif/i, 'la règle de transparence est rappelée');
});

test('PRJ-05 : la revue administrative est motivée et notifiée', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      project: [project({ status: 'SUBMITTED', fieldStatus: {} })],
      membership: [{ id: 'm1', organizationId: ORG, userId: 'user_1', status: 'ACTIVE' }],
    }),
  );
  try {
    const reviewed = await projectsService.review(
      'prj_1',
      { decision: 'CHANGES_REQUESTED', comment: 'Business plan incomplet : charges d’exploitation manquantes' },
      reqAs('org_admin', ['ADMIN'], 'admin_1'),
    );
    assert.equal(reviewed.status, 'DRAFT', 'un projet à corriger repasse en brouillon');
    assert.equal(fake._store.notification.length >= 1, true, 'le porteur est notifié');
    const entry = fake._store.auditLog.find((row) => row.action === 'project.review');
    assert.equal(entry.newValue.comment, 'Business plan incomplet : charges d’exploitation manquantes');
    assert.equal(entry.actorId, 'admin_1', 'décision nominative');
  } finally {
    restore();
  }
});

/* ───────────────────────── DATA ROOM ───────────────────────── */

const drStore = () =>
  store({
    project: [project()],
    projectDocument: [
      {
        id: 'doc_1',
        projectId: 'prj_1',
        name: 'Business plan.pdf',
        downloadAllowed: false,
        deletedAt: null,
        storageKey: 'dataroom/prj_1/bp.pdf',
        scope: 'FINANCIAL',
      },
    ],
    dataRoomAccessRequest: [
      {
        id: 'req_1',
        projectId: 'prj_1',
        userId: 'user_inv',
        granteeUserId: 'user_inv',
        status: 'GRANTED',
        decidedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        scope: { download: false, documents: ['doc_1'] },
      },
    ],
    dataRoomAccessLog: [],
  });

test('DR-03 : l’accès est décidé par le porteur, avec expiration', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      project: [project()],
      dataRoomAccessRequest: [
        { id: 'req_2', projectId: 'prj_1', granteeUserId: 'user_inv', status: 'PENDING', scope: { requestedDays: 15 } },
      ],
    }),
  );
  try {
    const granted = await dataroomService.decideAccess(
      'req_2',
      { decision: 'GRANTED', conditions: 'Pas de diffusion externe' },
      reqAs(),
    );
    assert.equal(granted.status, 'GRANTED');
    assert.ok(granted.expiresAt instanceof Date, 'accès borné dans le temps');
    assert.ok(granted.expiresAt.getTime() <= Date.now() + 90 * 24 * 3600 * 1000, 'TTL plafonné');
    assert.equal(fake._store.dataRoomAccessRequest[0].conditions, 'Pas de diffusion externe');

    await expectStatus(
      dataroomService.decideAccess('req_2', { decision: 'GRANTED' }, reqAs()),
      409,
      /déjà/i,
    );
  } finally {
    restore();
  }
});

test('DR-04 : le téléchargement est désactivé par défaut et journalisé', async () => {
  const { fake, restore } = await withFakePrisma(prisma, drStore());
  try {
    await expectStatus(
      dataroomService.openDocument('doc_1', { ...reqAs(INVESTOR, ['INVESTOR'], 'user_inv'), query: { download: 'true' } }),
      403,
      /téléchargement|download/i,
    );

    const log = fake._store.dataRoomAccessLog.find((row) => row.action === 'DOWNLOAD_DENIED');
    assert.ok(log, 'refus de téléchargement journalisé');
    assert.equal(log.userId, 'user_inv');
  } finally {
    restore();
  }
});

test('DR-05 : le journal d’accès est append-only et complet', async () => {
  const { fake, restore } = await withFakePrisma(prisma, drStore());
  try {
    await dataroomService.openDocument('doc_1', reqAs(INVESTOR, ['INVESTOR'], 'user_inv'));

    const entries = fake._store.dataRoomAccessLog;
    assert.equal(entries.length, 1, 'chaque ouverture est journalisée');
    assert.equal(entries[0].action, 'OPEN');
    assert.equal(entries[0].userId, 'user_inv');
    assert.ok(entries[0].projectId === 'prj_1');
    assert.ok(entries[0].ip !== undefined, 'contexte de la consultation conservé');
    assert.ok(entries[0].device !== undefined, 'agent utilisateur conservé');

    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('../src/modules/dataroom/dataroom.service.js', import.meta.url), 'utf8');
    assert.equal(
      /dataRoomAccessLog\.(update|delete)/.test(source),
      false,
      'aucune mise à jour ni suppression du journal',
    );
  } finally {
    restore();
  }
});

/* ──────────────────── DUE DILIGENCE ──────────────────── */

test('DD-01 : la checklist de due diligence est structurée et versionnée', async () => {
  const { fake, restore } = await withFakePrisma(prisma, store({ project: [project()], dueDiligenceItem: [] }));
  try {
    const items = await dueDiligenceService.ensureChecklist('prj_1', reqAs());
    assert.ok(items.length >= 10, 'checklist substantielle');
    assert.ok(items.every((item) => item.category && item.label), 'chaque point est catégorisé et libellé');
    assert.ok(new Set(items.map((i) => i.category)).size >= 3, 'plusieurs catégories couvertes');
    assert.equal(items.every((i) => i.status === 'NOT_STARTED'), true, 'aucun point n’est coché par défaut');

    const again = await dueDiligenceService.ensureChecklist('prj_1', reqAs());
    assert.equal(again.length, items.length, 'checklist idempotente');
    assert.equal(fake._store.dueDiligenceItem.length, items.length, 'aucun doublon créé');
  } finally {
    restore();
  }
});

test('DD-03 : la due diligence n’est jamais publique', async () => {
  const { readFileSync } = await import('node:fs');
  const publicService = readFileSync(new URL('../src/modules/projects/projects.service.js', import.meta.url), 'utf8');
  const publicView = publicService.slice(publicService.indexOf('export const getOne'));
  assert.equal(/dueDiligence/i.test(publicView), false, 'la vue publique ne charge aucune due diligence');

  const { restore } = await withFakePrisma(prisma, store({ project: [project()], dueDiligenceItem: [] }));
  try {
    await expectStatus(dueDiligenceService.ensureChecklist('prj_1', reqAs(INVESTOR, ['INVESTOR'], 'user_inv')), 404);
  } finally {
    restore();
  }
});

/* ───────────────────────── RAPPORTS ───────────────────────── */

test('RPT-01 : les rapports sont horodatés par le serveur', async () => {
  const { fake, restore } = await withFakePrisma(prisma, store({ project: [project()] }));
  try {
    const before = Date.now();
    const report = await reportingService.createImpact(
      'prj_1',
      {
        period: '2026-Q3',
        indicators: [
          { name: 'Emplois créés', value: 12, unit: 'emplois', source: 'declared' },
          { name: 'Rendement moyen', value: 2.4, unit: 't/ha', source: 'measured_lab' },
        ],
      },
      reqAs(),
    );

    const row = fake._store.impactReport[0];
    assert.ok(row.createdAt instanceof Date, 'horodatage serveur');
    assert.ok(row.createdAt.getTime() >= before);
    assert.match(report.provenance.caveat, /déclaré|vérifié/i, 'la réserve sur les indicateurs déclarés est affichée');
    assert.equal(report.provenance.declaredIndicators, 1);
    assert.equal(report.provenance.totalIndicators, 2);
    const stored = fake._store.impactReport[0];
    assert.equal(stored.indicators.every((i) => i.source), true, 'chaque indicateur garde sa source');
    assert.equal(stored.indicators[0].source, 'declared');
  } finally {
    restore();
  }
});

test('RPT-03 : un rapport publié ne peut plus être réécrit', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      project: [project()],
      impactReport: [
        { id: 'imp_1', projectId: 'prj_1', period: '2026-Q2', indicators: [], publishedAt: new Date('2026-07-01'), createdAt: new Date('2026-07-01') },
      ],
    }),
  );
  try {
    await expectStatus(
      reportingService.createImpact('prj_1', { period: '2026-Q2', indicators: [] }, reqAs()),
      409,
      /publié|verrouill/i,
    );
    assert.equal(fake._store.impactReport.length, 1, 'aucune réécriture du rapport publié');
  } finally {
    restore();
  }
});

/* ─────────────────────── FINANCEMENT ─────────────────────── */

test('FUND-01 : la transmission exige un consentement préalable matérialisé', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({ project: [project()] }),
  );
  try {
    const draft = await fundingService.requestConsent('prj_1', reqAs());
    assert.ok(draft.consentId, 'jeton de consentement généré');
    assert.ok(fake._store.fundingRequest[0].consentAt instanceof Date, 'consentement horodaté');
    assert.ok(fake._store.fundingRequest[0].contentSnapshot.projectTitle, 'contenu figé au moment du consentement');

    await expectStatus(
      fundingService.transmit(
        draft.fundingRequestId,
        { consentGiven: false, consentId: draft.consentId, partnerName: 'Fonds Vert' },
        reqAs(),
      ),
      403,
      /consentement/i,
    );
    await expectStatus(
      fundingService.transmit(
        draft.fundingRequestId,
        { consentGiven: true, consentId: 'jeton-falsifie', partnerName: 'Fonds Vert' },
        reqAs(),
      ),
      403,
      /consentement/i,
    );
  } finally {
    restore();
  }
});

test('FUND-03 : la plateforme n’exécute aucune activité financière régulée', async () => {
  const { readFileSync } = await import('node:fs');
  let fake;
  const files = [
    '../src/modules/funding/funding.service.js',
    '../src/modules/projects/projects.service.js',
  ];
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.equal(
      /(transferFunds|chargeCard|stripe|payout|holdFunds|escrow)/i.test(source),
      false,
      `aucun mouvement de fonds dans ${file}`,
    );
  }

  const swapped = await withFakePrisma(prisma, store({ project: [project()] }));
  fake = swapped.fake;
  try {
    const draft = await fundingService.requestConsent('prj_1', reqAs());
    assert.equal(fake._store.fundingRequest[0].status, 'DRAFT');
    assert.match(draft.disclaimer, /aucun fonds|ne collecte/i, 'la plateforme se déclare hors circuit financier');
  } finally {
    swapped.restore();
  }
});

/* ───────────────── PRÉCISION (S4) ───────────────── */

test('PREC-01 (SOIL-15) : les zones de gestion sont versionnées et sourcées', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      satelliteObservation: [
        { id: 's1', plotId: 'plot_1', provider: 'sentinel-2', index: 'NDVI', value: 0.55, observedAt: new Date('2026-09-01') },
      ],
      soilAssessment: [{ id: 'sa1', plotId: 'plot_1', organizationId: ORG, assessedAt: new Date('2026-09-01'), deletedAt: null, parameters: [] }],
    }),
  );
  try {
    const result = await precisionService.computeZones('plot_1', { zones: 2 }, reqAs());
    const zones = result.managementZones;
    assert.ok(zones.methodVersion, 'version de méthode exposée');
    assert.ok(Array.isArray(zones.zones) && zones.zones.length >= 1);
    assert.ok(zones.sources.available.length >= 1, 'sources utilisées listées');
    assert.deepEqual(zones.sources.missing, ['géométrie fine des zones (à fournir)'], 'manques explicités');
    assert.equal(result.justification.requiresFieldValidation, true, 'validation terrain requise');
    assert.equal(result.justification.methodVersion, zones.methodVersion);
  } finally {
    restore();
  }
});

test('PREC-03 : un rapport de précision n’est jamais validé par défaut', async () => {
  const { fake, restore } = await withFakePrisma(prisma, store({ precisionReport: [] }));
  try {
    const created = await precisionService.createReport(
      'plot_1',
      { pdfKey: 'precision/plot_1.pdf', ruleSetVersion: 'zones-2026.1' },
      reqAs(),
    );

    assert.equal(created.status, 'NOT_VALIDATED');
    assert.equal(fake._store.precisionReport[0].validatedAt, null, 'aucune validation automatique');
    assert.match(created.disclaimer, /ne vaut pas|valid/i);

    const validated = await precisionService.validateReport(
      created.report.id,
      {},
      reqAs(ORG, ['AGRONOMIST'], 'agro_1'),
    );
    assert.equal(validated.validated, true);
    assert.ok(validated.report.validatedAt instanceof Date);
    assert.equal(validated.report.validatedBy, 'agro_1', 'validation nominative');
  } finally {
    restore();
  }
});

/* ────────────────────── INVESTISSEURS ────────────────────── */

test('INV-01 : seul un profil investisseur vérifié accède aux projets', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      investorProfile: [
        { id: 'ip_1', userId: 'user_inv', organizationId: INVESTOR, verifiedAt: null, mfaEnabled: false, preferences: {} },
      ],
      profile: [{ id: 'user_inv', mfaEnabled: false }],
    }),
  );
  try {
    // Un profil non vérifié n'ouvre aucune data room…
    await expectStatus(investorsService.assertInvestorReady('user_inv'), 403, /vérifi/i);

    const verified = await investorsService.verify(
      'user_inv',
      { decision: 'VERIFIED', comment: 'Pièce d’identité et origine des fonds contrôlées' },
      reqAs('org_admin', ['ADMIN'], 'admin_1'),
    );
    assert.ok(verified.verifiedAt instanceof Date);
    assert.equal(verified.verifiedBy, 'admin_1', 'vérification nominative');
    assert.equal(fake._store.notification.length >= 1, true, 'l’investisseur est notifié');

    // … puis la MFA est exigée même une fois la vérification faite (V4).
    await expectStatus(investorsService.assertInvestorReady('user_inv'), 403, /multifacteur|MFA/i);
    fake._store.investorProfile[0].mfaEnabled = true;
    const ready = await investorsService.assertInvestorReady('user_inv');
    assert.ok(ready.verifiedAt instanceof Date, 'accès ouvert seulement après vérification + MFA');
  } finally {
    restore();
  }
});
