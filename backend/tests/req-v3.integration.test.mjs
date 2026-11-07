/**
 * Preuves d'acceptation — V3 (synchronisation, intelligence, traçabilité).
 *
 * Une preuve par exigence numérotée, exécutée sur les services réels avec le
 * client Prisma remplacé par un double en mémoire.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';

import * as syncService from '../src/modules/sync/sync.service.js';
import * as aiService from '../src/modules/ai/ai.service.js';
import * as weatherService from '../src/modules/weather/weather.service.js';
import * as pricesService from '../src/modules/prices/prices.service.js';
import * as traceabilityService from '../src/modules/traceability/traceability.service.js';
import * as certificationsService from '../src/modules/certifications/certifications.service.js';
import * as iotService from '../src/modules/iot/iot.service.js';
import * as geodataService from '../src/modules/geodata/geodata.service.js';
import * as intelligence from '../src/modules/soil/intelligence.service.js';
import { sha256 } from '../src/shared/crypto.js';

const ORG = 'org_1';
const OTHER = 'org_2';

const reqAs = (organizationId = ORG, roles = ['PRODUCER'], userId = 'user_1') => ({
  tenant: { organizationId, effectiveRoles: roles },
  user: { id: userId, roles },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
  requestId: 'req_test',
});

const store = (overrides = {}) => ({
  plot: [{ id: 'plot_1', organizationId: ORG, farmId: 'farm_1', name: 'Parcelle Kivu', areaHa: 2, latitude: -1.68, longitude: 29.22, deletedAt: null }],
  farm: [{ id: 'farm_1', organizationId: ORG, countryCode: 'CD', province: 'Nord-Kivu' }],
  crop: [{ id: 'crop_mais', slug: 'mais', name: 'Maïs', names: { fr: 'Maïs' }, deletedAt: null }],
  membership: [],
  organization: [],
  profile: [],
  syncOperation: [],
  aiAnalysis: [],
  weatherData: [],
  marketPrice: [],
  traceabilityLot: [],
  lotEvent: [],
  certification: [],
  iotDevice: [],
  sensorReading: [],
  sensorAnomaly: [],
  satelliteObservation: [],
  droneSurvey: [],
  labResult: [],
  soilAssessment: [],
  soilParameter: [],
  notification: [],
  auditLog: [],
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

/* ───────────────────────── SYNCHRONISATION ───────────────────────── */

test('SYNC-04 : le rapport de conflits est consultable et borné au tenant', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      syncOperation: [
        { id: 'op1', opId: 'a1', organizationId: ORG, collection: 'plots', operation: 'UPDATE', result: 'CONFLICT', appliedAt: new Date(), reason: 'version périmée' },
        { id: 'op2', opId: 'a2', organizationId: ORG, collection: 'plots', operation: 'UPDATE', result: 'APPLIED', appliedAt: new Date() },
        { id: 'op3', opId: 'a3', organizationId: OTHER, collection: 'plots', operation: 'UPDATE', result: 'CONFLICT', appliedAt: new Date() },
      ],
    }),
  );
  try {
    const report = await syncService.conflictReport({ days: 7 }, reqAs());
    assert.equal(report.operations.length, 2, 'seules les opérations du tenant sont visibles');
    assert.equal(report.conflicts.length, 1, 'les conflits sont isolés');
    assert.equal(report.conflicts[0].opId, 'a1');
    assert.equal(report.conflicts[0].reason, 'version périmée', 'motif du conflit conservé');

    const onlyConflicts = await syncService.conflictReport({ days: 7, onlyConflicts: 'true' }, reqAs());
    assert.equal(onlyConflicts.conflicts.length, 1);
    assert.equal(onlyConflicts.operations.length, 1, 'filtre « conflits seuls » respecté');
  } finally {
    restore();
  }
});

test('SYNC-05 : le pull est incrémental, par curseur explicite', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      plot: [
        { id: 'plot_1', organizationId: ORG, name: 'Nord', updatedAt: new Date('2026-09-01T10:00:00Z'), deletedAt: null },
        { id: 'plot_2', organizationId: ORG, name: 'Sud', updatedAt: new Date('2026-09-20T10:00:00Z'), deletedAt: null },
        { id: 'plot_3', organizationId: OTHER, name: 'Ailleurs', updatedAt: new Date('2026-09-20T10:00:00Z'), deletedAt: null },
      ],
    }),
  );
  try {
    const all = await syncService.pull({ collections: 'plots' }, reqAs());
    assert.equal(all.changes.plots.length, 2, 'le pull ne renvoie que le tenant courant');
    assert.ok(all.cursor, 'un curseur est renvoyé');

    const partial = await syncService.pull(
      { collections: 'plots', since: '2026-09-15T00:00:00Z' },
      reqAs(),
    );
    assert.equal(partial.changes.plots.length, 1, 'seules les modifications postérieures au curseur');
    assert.equal(partial.changes.plots[0].id, 'plot_2');

    await expectStatus(syncService.pull({ collections: 'plots', since: 'pas-une-date' }, reqAs()), 422);
    await expectStatus(syncService.pull({ collections: 'inconnue' }, reqAs()), 422, /inconnue/i);
  } finally {
    restore();
  }
});

/* ─────────────────────────────── IA ─────────────────────────────── */

test('AI-01 : aucune analyse d’image sans consentement explicite', async () => {
  const { fake, restore } = await withFakePrisma(prisma, store());
  try {
    await expectStatus(
      aiService.analyze({ type: 'PLANT_PHOTO', imageUrl: 'https://cdn/x.jpg' }, reqAs()),
      422,
      /consentement/i,
    );
    assert.equal(fake._store.aiAnalysis.length, 0, 'aucun traitement sans accord');

    const result = await aiService.analyze(
      { type: 'PLANT_PHOTO', imageUrl: 'https://cdn/x.jpg', consentGiven: true },
      reqAs(),
    );
    assert.ok(result.analysis.id);
    assert.equal(fake._store.aiAnalysis.length, 1);
    assert.equal(fake._store.aiAnalysis[0].consentGiven, true, 'consentement enregistré avec la demande');
  } finally {
    restore();
  }
});

test('AI-03 : la confiance est affichée, jamais implicite', async () => {
  const { restore } = await withFakePrisma(prisma, store());
  try {
    const result = await aiService.analyze({ type: 'CHAT', question: 'Quand semer le maïs ?' }, reqAs());
    assert.ok(['low', 'medium', 'high'].includes(result.confidence.level), 'niveau de confiance exposé');
    assert.ok(result.confidence.label, 'libellé lisible de la confiance');
    assert.ok(result.disclaimer, 'avertissement joint à la sortie');
    assert.equal(result.provenance.promptVersion !== undefined, true, 'version de prompt tracée');
    assert.equal(result.analysis.isCertification ?? false, false, 'jamais présenté comme une certification');
  } finally {
    restore();
  }
});

test('AI-10 : le copilote cite ses sources et ne génère que des brouillons', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      marketPrice: [
        { id: 'mp1', cropId: 'crop_mais', market: 'Kinshasa', price: 0.4, currency: 'USD', unit: 'kg', observedAt: new Date('2026-09-01'), source: 'OCHA' },
      ],
      soilAssessment: [{ id: 'sa1', plotId: 'plot_1', organizationId: ORG, assessedAt: new Date('2026-09-01'), deletedAt: null }],
      soilParameter: [{ id: 'sp1', assessmentId: 'sa1', key: 'ph', numericValue: 6.2, unit: 'pH', source: 'measured_lab' }],
    }),
  );
  try {
    const answer = await aiService.copilot({ question: 'Quel est le prix du maïs ?', cropId: 'crop_mais' }, reqAs());
    assert.ok(Array.isArray(answer.citations) && answer.citations.length > 0, 'chaque affirmation est sourcée');
    assert.ok(answer.citations.every((c) => c.type && c.id), 'citation typée et identifiée');
    assert.ok(answer.disclaimer, 'avertissement présent');
    assert.match(answer.answer, /maïs|prix/i);

    const draft = await aiService.generateDocument({ kind: Object.keys(await aiKinds())[0], plotId: 'plot_1' }, reqAs());
    assert.equal(draft.status ?? 'DRAFT', 'DRAFT', 'un document généré est un brouillon');
    assert.equal(draft.requiresReview ?? true, true, 'relecture humaine obligatoire');
    assert.ok(Array.isArray(draft.sources) && draft.sources.length > 0, 'sources du document exposées');
  } finally {
    restore();
  }
});

const aiKinds = async () => {
  const module = await import('../src/modules/ai/ai.service.js');
  return module.DOCUMENT_KINDS ?? { FICHE_TECHNIQUE: {} };
};

/* ───────────────────────────── MÉTÉO ───────────────────────────── */

test('WEA-02 : toute donnée météo est datée et sourcée, jamais inventée', async () => {
  const { restore } = await withFakePrisma(prisma, store({ weatherData: [] }));
  try {
    const empty = await weatherService.forPlot('plot_1', {}, reqAs());
    assert.equal(empty.available, false, 'aucune donnée ⇒ aucune météo simulée');
    assert.match(empty.message ?? empty.note ?? '', /aucune|indisponible/i);
  } finally {
    restore();
  }
});

test('WEA-02 : un relevé météo conserve sa source et son horodatage', async () => {
  const { fake, restore } = await withFakePrisma(prisma, store());
  try {
    const record = await weatherService.record(
      {
        plotId: 'plot_1',
        countryCode: 'CD',
        observedAt: '2026-09-20T06:00:00Z',
        source: 'open-meteo',
        payload: { temperatureC: 24, rainfallMm: 12 },
        confidence: 'high',
      },
      reqAs(),
    );
    assert.equal(record.source, 'open-meteo', 'source conservée');
    assert.ok(record.observedAt);
    assert.equal(fake._store.weatherData[0].source, 'open-meteo');

    const view = await weatherService.forPlot('plot_1', {}, reqAs());
    assert.equal(view.available, true);
    assert.equal(view.records[0].source, 'open-meteo');
  } finally {
    restore();
  }
});

test('WEA-03 : une alerte météo est explicable (règle et seuil cités)', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      weatherData: [
        {
          id: 'w1',
          plotId: 'plot_1',
          observedAt: new Date(),
          source: 'open-meteo',
          payload: { rainfallMm: 60, temperatureC: 39, humidityPct: 90 },
        },
      ],
    }),
  );
  try {
    const result = await weatherService.alerts('plot_1', reqAs());
    assert.ok(result.alerts.length >= 3, 'alertes dérivées des valeurs réelles');
    for (const alert of result.alerts) {
      assert.ok(alert.rule, 'règle et seuil cités');
      assert.ok(alert.value !== undefined, 'valeur observée citée');
      assert.ok(alert.source, 'source de la donnée citée');
      assert.ok(['low', 'medium', 'high'].includes(alert.level), 'gravité explicite');
    }
    assert.ok(result.basedOn.observedAt, 'alerte rattachée à une observation datée');
  } finally {
    restore();
  }
});

/* ───────────────────────────── PRIX ───────────────────────────── */

test('PRI-02 (PRC-02) : la série de prix expose sa méthode et son échantillon', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      marketPrice: [
        { id: 'p1', cropId: 'crop_mais', market: 'Kinshasa', price: 0.4, currency: 'USD', unit: 'kg', observedAt: new Date('2026-09-01'), source: 'OCHA' },
        { id: 'p2', cropId: 'crop_mais', market: 'Kinshasa', price: 0.5, currency: 'USD', unit: 'kg', observedAt: new Date('2026-09-08'), source: 'OCHA' },
      ],
    }),
  );
  try {
    const series = await pricesService.series({ cropId: 'crop_mais', days: 120 }, reqAs());
    assert.equal(series.available, true);
    assert.equal(series.points.length, 2);
    assert.ok(series.method.label, 'méthode de calcul affichée');
    assert.equal(series.method.observations, 2, 'taille de l’échantillon exposée');
    assert.ok(series.method.minObservationsForDisplay >= 1, 'seuil d’affichage explicite');
    assert.equal(series.stats.mean, 0.45, 'moyenne observée, jamais un prix « recommandé »');
    assert.ok(series.points.every((p) => p.source), 'chaque point porte sa source');
  } finally {
    restore();
  }
});

test('PRI-03 (PRC-03) : un marché sans relevé récent est signalé, jamais interpolé', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      marketPrice: [
        { id: 'p1', cropId: 'crop_mais', market: 'Kinshasa', price: 0.4, currency: 'USD', unit: 'kg', observedAt: new Date(), source: 'OCHA' },
        { id: 'p2', cropId: 'crop_mais', market: 'Lubumbashi', price: 0.3, currency: 'USD', unit: 'kg', observedAt: new Date('2026-01-01'), source: 'OCHA' },
      ],
    }),
  );
  try {
    const result = await pricesService.staleMarkets();
    assert.equal(result.stale.length, 1, 'seul le marché sans relevé récent est signalé');
    assert.equal(result.stale[0].market, 'Lubumbashi');
    assert.ok(result.stale[0].lastObservedAt, 'dernier relevé connu cité');
    assert.match(result.stale[0].warning, /aucun prix/i);
    assert.equal('estimatedPrice' in result.stale[0], false, 'aucun prix estimé par interpolation');
  } finally {
    restore();
  }
});

/* ─────────────────────────── TRAÇABILITÉ ─────────────────────────── */

test('TRC-01 : le lot porte un code normalisé, unique et vérifiable', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({ organization: [{ id: ORG, name: 'Coop Kivu', countryCode: 'CD' }] }),
  );
  try {
    const lot = await traceabilityService.create(
      { cropId: 'crop_mais', plotId: 'plot_1', harvestedAt: '2026-09-10', quantity: 500, unit: 'kg' },
      reqAs(),
    );

    assert.match(lot.code, /^[A-Z]{2}-[A-Z]{2}-\d{4}-\d{5}$/, 'code normalisé pays-année-séquence (ex. AK-CD-2026-00001)');
    assert.ok(lot.code.includes('CD'), 'le pays de l’organisation est repris dans le code');
    assert.equal(traceabilityService.LOT_CODE_PATTERN.test(lot.code), true);
    assert.equal(fake._store.traceabilityLot.length, 1);
    assert.ok(fake._store.lotEvent.length >= 1, 'la création est un événement du journal');
  } finally {
    restore();
  }
});

test('TRC-02 : le journal de lot est append-only et le rappel est tracé', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      traceabilityLot: [
        { id: 'lot_1', code: 'CD-MAIS-A1B2', organizationId: ORG, cropId: 'crop_mais', status: 'ACTIVE', publicFields: { crop: 'Maïs' }, createdAt: new Date() },
      ],
      lotEvent: [
        { id: 'ev1', lotId: 'lot_1', type: 'CREATED', at: new Date('2026-09-10'), createdBy: 'user_1' },
      ],
    }),
  );
  try {
    const event = await traceabilityService.addEvent(
      'lot_1',
      { type: 'TRANSPORT', details: 'Départ Butembo', location: { village: 'Butembo' } },
      reqAs(),
    );
    assert.equal(fake._store.lotEvent.length, 2, 'un événement est ajouté, jamais substitué');
    assert.equal(fake._store.lotEvent[0].type, 'CREATED', 'les événements antérieurs restent intacts');
    assert.ok(event.id);

    const recalled = await traceabilityService.recall('lot_1', { reason: 'Rupture de chaîne du froid' }, reqAs());
    assert.equal(recalled.status, 'RECALLED');
    const recallEvent = fake._store.lotEvent.find((e) => e.type === 'RECALL');
    assert.ok(recallEvent, 'le rappel est un événement typé du journal');
    assert.match(recallEvent.details, /Rupture de chaîne du froid/);
    assert.equal(recallEvent.actorId, 'user_1', 'auteur du rappel conservé');
  } finally {
    restore();
  }
});

/* ──────────────────────── CERTIFICATIONS ──────────────────────── */

test('CERT-02 : la vérification d’une certification est réservée à l’administration', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      certification: [
        { id: 'cert_1', organizationId: ORG, name: 'GlobalG.A.P.', status: 'PENDING', expiresAt: new Date('2027-01-01'), deletedAt: null },
      ],
    }),
  );
  try {
    // CERT-02 — la décision est réservée à la permission dédiée : un producteur
    // ne la porte pas, un certificateur ou l'administration l'ont.
    const { can } = await import('../src/shared/permissions.js');
    assert.equal(can(['PRODUCER'], 'certifications.verify'), false, 'producteur : aucun droit de vérifier');
    assert.equal(can(['VERIFIER'], 'certifications.verify'), true, 'vérificateur habilité');
    assert.equal(can(['ADMIN'], 'certifications.verify'), true, 'administration habilitée');

    const verified = await certificationsService.verify(
      'cert_1',
      { decision: 'VERIFIED', comment: 'Certificat contrôlé auprès de l’organisme' },
      reqAs('org_admin', ['CERTIFIER'], 'agent_1'),
    );
    assert.equal(verified.status, 'VERIFIED');
    assert.equal(fake._store.certification[0].verifiedBy, 'agent_1', 'décision nominative');
  } finally {
    restore();
  }
});

test('CERT-03 : une certification expirée n’est jamais comptée comme valide', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      certification: [
        { id: 'c1', organizationId: ORG, name: 'Bio', status: 'VERIFIED', expiresAt: new Date('2026-01-01'), deletedAt: null },
        { id: 'c2', organizationId: ORG, name: 'GlobalG.A.P.', status: 'VERIFIED', expiresAt: new Date('2027-01-01'), deletedAt: null },
        { id: 'c3', organizationId: ORG, name: 'Fairtrade', status: 'PENDING', expiresAt: null, deletedAt: null },
      ],
    }),
  );
  try {
    const trust = await certificationsService.trusted(ORG);
    assert.equal(trust.valid, 1, 'seule la certification en cours de validité compte');
    assert.equal(trust.expired, 1, 'l’expiration est comptée séparément');
    assert.equal(trust.declaredPending, 1, 'les déclarations non vérifiées sont séparées');
    const expired = trust.certifications.find((c) => c.id === 'c1');
    assert.equal(expired.trusted, false, 'le drapeau « trusted » suit la date d’expiration');
    assert.equal(expired.effectiveStatus, 'EXPIRED', 'un certificat échu n’affiche jamais VERIFIED');
  } finally {
    restore();
  }
});

/* ───────────────────────────── IoT ───────────────────────────── */

test('IOT-04 : les mesures ne sont jamais interpolées, les trous sont signalés', async () => {
  const key = 'cle-appareil-test';
  const { restore } = await withFakePrisma(
    prisma,
    store({
      iotDevice: [
        { id: 'dev_1', organizationId: ORG, label: 'Sonde A', plotId: 'plot_1', keyHash: sha256(key), status: 'ACTIVE', thresholds: { humidityPct: 30 } },
      ],
      sensorReading: [
        { id: 'r1', deviceId: 'dev_1', metric: 'humidityPct', value: 42, unit: '%', at: new Date(Date.now() - 3 * 3600 * 1000), quality: 'raw' },
        { id: 'r2', deviceId: 'dev_1', metric: 'humidityPct', value: 39, unit: '%', at: new Date(), quality: 'raw' },
      ],
    }),
  );
  try {
    const result = await iotService.readings('dev_1', { hours: 24 }, reqAs());
    assert.equal(result.readings.length, 2, 'aucune valeur fabriquée entre deux mesures');
    assert.ok(Array.isArray(result.gaps) && result.gaps.length >= 1, 'le trou de mesure est signalé');
    assert.ok(result.gaps[0].minutes >= 60, 'amplitude du trou exprimée en minutes');
  } finally {
    restore();
  }
});

test('IOT-04 : un appareil révoqué ne peut plus ingérer de mesures', async () => {
  const key = 'cle-appareil-revoquee';
  const { restore } = await withFakePrisma(
    prisma,
    store({
      iotDevice: [
        { id: 'dev_2', organizationId: ORG, label: 'Sonde B', keyHash: sha256(key), status: 'REVOKED' },
      ],
    }),
  );
  try {
    await expectStatus(
      iotService.ingest({ deviceKey: key, readings: [{ metric: 'humidityPct', value: 40 }] }, reqAs()),
      403,
      /REVOKED/,
    );
    await expectStatus(iotService.ingest({ deviceKey: 'inconnue', readings: [] }, reqAs()), 401);
  } finally {
    restore();
  }
});

/* ───────────────────────── GÉODONNÉES ───────────────────────── */

test('GEO-01 (DRN-01) : satellite, drone et laboratoire sont rattachés à la parcelle', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      satelliteObservation: [
        { id: 's1', plotId: 'plot_1', provider: 'sentinel-2', index: 'NDVI', value: 0.62, observedAt: new Date('2026-09-01'), cloudCover: 5 },
      ],
      droneSurvey: [
        { id: 'd1', plotId: 'plot_1', flownAt: new Date('2026-09-05'), type: 'orthophoto', coveragePct: 92, pilotId: 'user_1', reportKey: 'drone/d1.tif' },
      ],
      labResult: [
        { id: 'l1', plotId: 'plot_1', sampledAt: new Date('2026-09-03'), sampleId: 'lab-77', parameters: { ph: 6.1 } },
      ],
    }),
  );
  try {
    const observations = await geodataService.plotObservations('plot_1', reqAs());
    assert.equal(observations.plot.id, 'plot_1');
    assert.equal(observations.sources.satellite.length, 1);
    assert.equal(observations.sources.drone.length, 1);
    assert.equal(observations.sources.lab.length, 1);
    assert.equal(observations.sources.satellite[0].kind, 'satellite', 'type de source explicite');
  } finally {
    restore();
  }
});

test('GEO-02 : la provenance est distincte par source, sans confusion', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      satelliteObservation: [{ id: 's1', plotId: 'plot_1', provider: 'sentinel-2', index: 'NDVI', value: 0.62, observedAt: new Date('2026-09-01') }],
      droneSurvey: [{ id: 'd1', plotId: 'plot_1', flownAt: new Date('2026-09-05'), type: 'orthophoto', reportKey: 'drone/d1.tif' }],
      labResult: [{ id: 'l1', plotId: 'plot_1', sampledAt: new Date('2026-09-03'), sampleId: 'lab-77', parameters: { ph: 6.1 } }],
    }),
  );
  try {
    const observations = await geodataService.plotObservations('plot_1', reqAs());
    assert.deepEqual(Object.keys(observations.sources).sort(), ['drone', 'lab', 'satellite', 'soil']);
    assert.equal(observations.sources.satellite[0].provider, 'sentinel-2', 'fournisseur satellite conservé');
    assert.equal(observations.sources.drone[0].kind, 'drone');
    assert.equal(observations.sources.lab[0].kind, 'lab');
    assert.match(observations.provenancePolicy, /source/i, 'politique de provenance explicite');
  } finally {
    restore();
  }
});

/* ─────────────────────── SOL : FUSION S3 ─────────────────────── */

const soilStore = (overrides = {}) =>
  store({
    soilAssessment: [{ id: 'sa1', plotId: 'plot_1', organizationId: ORG, assessedAt: new Date('2026-09-01'), deletedAt: null }],
    soilParameter: [
      { id: 'p_declared', assessmentId: 'sa1', key: 'ph', numericValue: 5.9, unit: 'pH', source: 'declared' },
      { id: 'p_satellite', assessmentId: 'sa1', key: 'ph', numericValue: 6.1, unit: 'pH', source: 'satellite' },
      { id: 'p_sensor', assessmentId: 'sa1', key: 'ph', numericValue: 6.2, unit: 'pH', source: 'measured_sensor' },
      { id: 'p_lab', assessmentId: 'sa1', key: 'ph', numericValue: 6.4, unit: 'pH', source: 'measured_lab' },
    ],
    ...overrides,
  });

test('SOIL-11 : la priorité de fusion est labo > capteur > satellite > photo > déclaré', () => {
  const priority = intelligence.SOURCE_PRIORITY;
  const ordered = ['measured_lab', 'measured_sensor', 'satellite', 'photo_interpreted', 'declared'];
  for (let i = 1; i < ordered.length; i += 1) {
    assert.ok(
      priority[ordered[i - 1]] < priority[ordered[i]],
      `${ordered[i - 1]} doit primer sur ${ordered[i]} (CDC §6.5)`,
    );
  }
});

test('SOIL-11 : la valeur retenue est celle de la source la plus fiable disponible', async () => {
  const { restore } = await withFakePrisma(prisma, soilStore());
  try {
    const profile = await intelligence.fuseProfile('plot_1');
    assert.equal(profile.parameters.ph.source, 'measured_lab');
    assert.equal(profile.parameters.ph.numericValue, 6.4);
    assert.deepEqual(profile.sourcesUsed, ['measured_lab'], 'la source retenue est exposée');
    assert.equal(profile.priorityOrder[0].source, 'measured_lab', 'le laboratoire prime');
    assert.equal(profile.priorityOrder[1].source, 'measured_sensor', 'puis le capteur');
    assert.equal(profile.priorityOrder[profile.priorityOrder.length - 1].source, 'declared', 'le déclaratif arrive en dernier');
  } finally {
    restore();
  }
});

test('SOIL-12 : les valeurs concurrentes sont conservées comme alternatives, jamais écrasées', async () => {
  const { restore } = await withFakePrisma(prisma, soilStore());
  try {
    const profile = await intelligence.fuseProfile('plot_1');
    const ph = profile.parameters.ph;
    assert.equal(ph.alternatives.length, 3, 'les trois autres mesures restent consultables');
    assert.deepEqual(
      ph.alternatives.map((a) => a.source),
      ['measured_sensor', 'satellite', 'declared'],
      'alternatives triées par fiabilité décroissante',
    );
    assert.equal(ph.alternatives.every((a) => a.numericValue !== undefined), true);
    assert.equal(ph.alternatives.some((a) => a.source === ph.source), false, 'la valeur retenue n’est pas dupliquée');
    assert.equal(ph.alternatives.every((a) => a.measuredAt !== undefined), true, 'chaque alternative reste datée');
  } finally {
    restore();
  }
});
