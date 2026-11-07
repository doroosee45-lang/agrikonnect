import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';

import * as exportsService from '../src/modules/exports/exports.service.js';
import * as projectsService from '../src/modules/projects/projects.service.js';
import * as precisionService from '../src/modules/precision/precision.service.js';
import * as fundingService from '../src/modules/funding/funding.service.js';
import * as tendersService from '../src/modules/tenders/tenders.service.js';
import * as geodataService from '../src/modules/geodata/geodata.service.js';
import * as certificationsService from '../src/modules/certifications/certifications.service.js';
import * as traceabilityService from '../src/modules/traceability/traceability.service.js';
import * as weatherService from '../src/modules/weather/weather.service.js';
import * as pricesService from '../src/modules/prices/prices.service.js';
import * as syncService from '../src/modules/sync/sync.service.js';
import * as reportingService from '../src/modules/reporting/reporting.service.js';
import * as dueDiligenceService from '../src/modules/duediligence/duediligence.service.js';
import * as inventoryService from '../src/modules/market/inventory/inventory.service.js';
import * as offersService from '../src/modules/market/offers/offers.service.js';
import * as farmsService from '../src/modules/farms/farms.service.js';
import * as soilService from '../src/modules/soil/soil.service.js';
import * as insightsService from '../src/modules/insights/insights.service.js';
import * as fxService from '../src/modules/countries/fx.service.js';

/**
 * Preuves d'acceptation par famille d'exigences (V1 → V5).
 *
 * Complète les suites déjà en place (commandes, messagerie, annonces, tâches)
 * avec une preuve ciblée par famille du cahier des charges : la règle testée
 * est celle que le CDC désigne comme non négociable.
 */

const ORG = 'org_1';
const OTHER = 'org_2';

const reqAs = (organizationId = ORG, roles = ['FARMER'], userId = 'user_1') => ({
  tenant: { organizationId, effectiveRoles: roles },
  user: { id: userId, roles },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
});

const baseStore = (overrides = {}) => ({
  crop: [],
  plot: [],
  farm: [],
  production: [],
  listing: [],
  order: [],
  notification: [],
  notificationPreference: [],
  auditLog: [],
  membership: [],
  project: [],
  ...overrides,
});

const expectStatus = async (promise, status, pattern = null) => {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, status, `statut attendu ${status}, reçu ${error.status} (${error.message})`);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
};

// ─── V1 ────────────────────────────────────────────────────────────────────

test('FARM-01 : les coordonnées publiques sont arrondies, la position exacte reste privée', async () => {
  const { fake, restore } = await withFakePrisma(prisma, baseStore());
  try {
    await farmsService.create(
      {
        name: 'Ferme Kivu',
        countryCode: 'CD',
        province: 'Nord-Kivu',
        latitude: -1.67891,
        longitude: 29.22345,
      },
      reqAs(),
    );

    const stored = fake._store.farm[0];
    assert.equal(stored.latitude, -1.67891, 'position exacte conservée en base (privée)');
    assert.notEqual(stored.publicLatitude, stored.latitude, 'la latitude publique est approximée');
    const decimals = String(stored.publicLatitude).split('.')[1];
    assert.ok((decimals?.length ?? 0) <= 2, 'latitude publique arrondie à 2 décimales');
    assert.ok(Math.abs(stored.publicLatitude - stored.latitude) < 0.01);
  } finally {
    restore();
  }
});

test('FARM-02 : des coordonnées hors bornes sont refusées (pas de point inventé)', async () => {
  const { restore } = await withFakePrisma(prisma, baseStore());
  try {
    await expectStatus(
      farmsService.create({ name: 'X', countryCode: 'CD', latitude: 999, longitude: 0 }, reqAs()),
      422,
    );
  } finally {
    restore();
  }
});

test('SOIL-01 : une analyse de sol est un relevé, jamais une recommandation automatique', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    baseStore({
      plot: [{ id: 'plot_1', organizationId: ORG, farmId: 'farm_1', deletedAt: null }],
      soilAssessment: [],
      soilParameter: [],
      document: [],
    }),
  );
  try {

    await soilService.create(
      'plot_1',
      {
        sampledAt: '2026-09-01',
        laboratory: 'Labo Kinshasa',
        parameters: [{ code: 'ph', value: 5.8, unit: 'pH' }],
      },
      reqAs(),
    );

    const stored = fake._store.soilAssessment[0];
    assert.ok(stored, 'relevé enregistré');
    assert.ok(!('recommendation' in stored), 'aucune recommandation produite (piste S1)');
    assert.ok(!('fertilizerAdvice' in stored));
    assert.equal(fake._store.soilParameter.length, 1, 'les mesures sont conservées telles quelles');
  } finally {
    restore();
  }
});

// ─── V2 ────────────────────────────────────────────────────────────────────

test('STK-01 : un mouvement qui rendrait le stock négatif est refusé', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      inventoryItem: [{ id: 'inv_1', organizationId: ORG, name: 'Maïs', unit: 'kg', deletedAt: null }],
      inventoryMovement: [
        { id: 'mv_1', itemId: 'inv_1', type: 'IN', quantity: 10, organizationId: ORG, at: new Date() },
      ],
    }),
  );
  try {
    await expectStatus(
      inventoryService.addMovement(
        { itemId: 'inv_1', type: 'OUT', quantity: 25, reason: 'Vente' },
        reqAs(),
      ),
      409,
      /négatif|insuffisant/i,
    );
  } finally {
    restore();
  }
});

test('OFF-01 : une offre ne peut pas être acceptée par son auteur', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      purchaseRequest: [
        { id: 'req_1', organizationId: OTHER, cropId: 'crop_1', quantity: 100, unit: 'kg', status: 'OPEN', deletedAt: null },
      ],
      offer: [
        { id: 'off_1', requestId: 'req_1', sellerOrgId: ORG, pricePerUnit: 2, currency: 'USD', status: 'PENDING', validUntil: new Date(Date.now() + 86400000) },
      ],
    }),
  );
  try {
    await expectStatus(offersService.decide('off_1', { status: 'ACCEPTED' }, reqAs()), 403);
  } finally {
    restore();
  }
});

// ─── V3 ────────────────────────────────────────────────────────────────────

test('WEA-01 (WX-01) : sans relevé météo, la réponse dit « indisponible » (jamais de valeur inventée)', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      plot: [{ id: 'plot_1', organizationId: ORG, latitude: 0, longitude: 20, deletedAt: null }],
      weatherData: [],
    }),
  );
  try {
    const weather = await weatherService.forPlot('plot_1', {}, reqAs());
    assert.equal(weather.available, false);
    assert.deepEqual(weather.records, []);
    assert.ok(weather.message, 'un motif explicite accompagne l’absence de données');
  } finally {
    restore();
  }
});

test('PRI-01 (PRC-01) : chaque prix renvoie sa source et sa date de relevé', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      crop: [{ id: 'crop_1', slug: 'mais', names: { fr: 'Maïs' } }],
      marketPrice: [
        {
          id: 'prc_1',
          cropId: 'crop_1',
          market: 'Kinshasa',
          countryCode: 'CD',
          price: 1.2,
          currency: 'USD',
          observedAt: new Date('2026-10-01T00:00:00Z'),
          source: 'AGENT',
          sourceLabel: 'Agent Kinshasa',
          createdAt: new Date('2026-10-01T00:00:00Z'),
        },
      ],
    }),
  );
  try {
    const result = await pricesService.list({ cropId: 'crop_1', page: 1, limit: 20 }, reqAs());
    assert.ok(result.items.length >= 1);
    assert.ok(result.sources.length >= 1, 'la source du relevé est renvoyée');
    assert.ok(result.items[0].observedAt);
    assert.ok(result.items[0].source);
  } finally {
    restore();
  }
});

test('TRACE-01 : un lot rappelé refuse tout nouvel événement (journal clos)', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      traceabilityLot: [
        { id: 'lot_1', organizationId: ORG, status: 'RECALLED', code: 'LOT-1', publicFields: [], createdAt: new Date() },
      ],
      lotEvent: [],
    }),
  );
  try {
    await expectStatus(
      traceabilityService.addEvent('lot_1', { type: 'STORAGE', details: 'Entrepôt' }, reqAs()),
      409,
      /rappel/i,
    );
  } finally {
    restore();
  }
});

test('CERT-01 : une certification expirée ne peut pas être vérifiée', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      certification: [
        {
          id: 'cert_1',
          organizationId: ORG,
          type: 'Bio',
          issuer: 'Ecocert',
          expiresAt: new Date(Date.now() - 86400000),
          status: 'PENDING',
          deletedAt: null,
        },
      ],
    }),
  );
  try {
    await expectStatus(
      certificationsService.verify('cert_1', { decision: 'VERIFIED', comment: 'Contrôle terrain' }, reqAs(ORG, ['ADMIN'])),
      422,
      /expir/i,
    );
  } finally {
    restore();
  }
});

test('GEO-03 : un résultat de laboratoire ne peut être publié que par un laboratoire partenaire', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      plot: [{ id: 'plot_1', organizationId: ORG, deletedAt: null }],
      labResult: [],
    }),
  );
  try {
    await expectStatus(
      geodataService.recordLabResult(
        { plotId: 'plot_1', laboratory: 'Labo X', sampledAt: '2026-09-01', parameters: {} },
        reqAs(ORG, ['FARMER']),
      ),
      403,
    );
  } finally {
    restore();
  }
});

test('SYNC-03 : un conflit de version est signalé, jamais écrasé silencieusement', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      plot: [{ id: 'plot_1', organizationId: ORG, version: 5, deletedAt: null }],
      syncOperation: [],
    }),
  );
  try {
    const result = await syncService.push(
      {
        operations: [
          {
            opId: 'op_1',
            collection: 'plots',
            operation: 'UPDATE',
            entityId: 'plot_1',
            baseVersion: 3,
            payload: { name: 'Parcelle nord' },
          },
        ],
      },
      reqAs(),
    );

    const operation = result.results?.[0] ?? result.operations?.[0] ?? result[0];
    assert.equal(operation.result, 'CONFLICT');
    assert.ok(operation.conflict, 'le rapport de conflit est fourni');
  } finally {
    restore();
  }
});

// ─── V4 ────────────────────────────────────────────────────────────────────

test('PRJ-04 : aucune promesse de rendement ne peut être publiée', async () => {
  const { restore } = await withFakePrisma(prisma, baseStore());
  try {
    await expectStatus(
      projectsService.create(
        {
          title: 'Extension 40 ha',
          countryCode: 'CD',
          sector: 'MAIZE',
          description: 'Rendement garanti de 25 % par an',
        },
        reqAs(),
      ),
      422,
      /rendement/i,
    );
  } finally {
    restore();
  }
});

test('PRJ-03 : un producteur ne peut pas s’auto-attribuer une vérification plateforme', async () => {
  const { restore } = await withFakePrisma(prisma, baseStore());
  try {
    await expectStatus(
      projectsService.create(
        {
          title: 'Extension 40 ha',
          countryCode: 'CD',
          sector: 'MAIZE',
          description: 'Projet documenté',
          surfaceHa: 40,
          fieldStatus: { targetAreaHa: { source: 'platform_verified' } },
        },
        reqAs(),
      ),
      403,
      /platform_verified/,
    );
  } finally {
    restore();
  }
});

test('DD-02 : une vérification professionnelle exige le nom et la qualité du professionnel', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      dueDiligenceItem: [
        { id: 'dd_1', projectId: 'prj_1', organizationId: ORG, status: 'PENDING', category: 'LEGAL', label: 'Statuts' },
      ],
      project: [{ id: 'prj_1', organizationId: ORG, status: 'PUBLISHED', deletedAt: null }],
    }),
  );
  try {
    await expectStatus(
      dueDiligenceService.update('dd_1', { status: 'VERIFIED' }, reqAs(ORG, ['VERIFIER'])),
      422,
      /professionnel|professional/i,
    );
  } finally {
    restore();
  }
});

test('RPT-02 : un rapport d’impact porte une source par indicateur', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      project: [{ id: 'prj_1', organizationId: ORG, status: 'PUBLISHED', deletedAt: null }],
      projectReport: [],
      impactReport: [],
      progressReport: [],
    }),
  );
  try {
    const report = await reportingService.createImpact(
      'prj_1',
      {
        period: '2026-09',
        indicators: [{ key: 'jobs_created', value: 12 }],
        narrative: 'Recrutement de 12 saisonniers',
      },
      reqAs(),
    );

    assert.ok(report.report, 'rapport créé');
    assert.equal(report.report.indicators[0].source, 'declared', 'non vérifié ⇒ declared');
    assert.match(report.provenance.caveat, /déclaré/i);
  } finally {
    restore();
  }
});

test('FUND-02 : une demande de financement ne part pas sans consentement enregistré', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      fundingRequest: [
        { id: 'fund_1', projectId: 'prj_1', organizationId: ORG, status: 'DRAFT', amount: 50000, currency: 'USD' },
      ],
      project: [{ id: 'prj_1', organizationId: ORG, status: 'PUBLISHED', deletedAt: null }],
    }),
  );
  try {
    await expectStatus(
      fundingService.transmit(
        'fund_1',
        { consentId: null, consentGiven: false, partnerName: 'Banque X' },
        reqAs(),
      ),
      403,
      /consentement/i,
    );
  } finally {
    restore();
  }
});

test('PREC-02 : aucune zone de gestion n’est produite sans données source', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      plot: [{ id: 'plot_1', organizationId: ORG, deletedAt: null }],
      managementZone: [],
      satelliteObservation: [],
      sensorReading: [],
      soilAssessment: [],
      precisionReport: [],
    }),
  );
  try {
    await expectStatus(
      precisionService.computeZones('plot_1', { sources: [] }, reqAs()),
      422,
      /Aucune zone/,
    );
  } finally {
    restore();
  }
});

// ─── V5 ────────────────────────────────────────────────────────────────────

test('TND-01 : on ne répond pas à son propre appel d’offres', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      tender: [
        { id: 'tnd_1', buyerOrgId: ORG, status: 'OPEN', cropId: 'crop_1', deadline: new Date(Date.now() + 86400000) },
      ],
      tenderResponse: [],
    }),
  );
  try {
    await expectStatus(
      tendersService.respond('tnd_1', { quantity: 10, price: 2, unit: 'kg', currency: 'USD' }, reqAs()),
      422,
      /propre appel/i,
    );
  } finally {
    restore();
  }
});

test('EXP-01 : un Incoterm inconnu est refusé', async () => {
  const { restore } = await withFakePrisma(prisma, baseStore({ exportOrder: [] }));
  try {
    await expectStatus(
      exportsService.create(
        {
          destinationCountry: 'FR',
          incoterm: 'EXPRESS',
          currency: 'USD',
          quantity: 10,
          buyerName: 'Acheteur',
        },
        reqAs(),
      ),
      422,
      /Incoterm/,
    );
  } finally {
    restore();
  }
});

test('EXP-02 : une devise non-USD sans taux daté et sourcé est refusée', async () => {
  const { restore } = await withFakePrisma(prisma, baseStore({ exportOrder: [] }));
  try {
    await expectStatus(
      exportsService.create(
        {
          destinationCountry: 'FR',
          incoterm: 'CIF',
          currency: 'EUR',
          quantity: 10,
          buyerName: 'Acheteur',
        },
        reqAs(),
      ),
      422,
      /Taux de change/,
    );
  } finally {
    restore();
  }
});

test('GLB-03 : sans cotation enregistrée, aucune conversion n’est proposée', async () => {
  const { restore } = await withFakePrisma(prisma, baseStore({ fxRate: [] }));
  try {
    const result = await fxService.resolve({ base: 'USD', quote: 'CDF' });
    assert.equal(result.available, false);
    assert.equal(result.rate, null);
    assert.match(result.message, /Aucune cotation/);
  } finally {
    restore();
  }
});

test('GLB-03 : une cotation ancienne est signalée comme périmée', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      fxRate: [
        {
          id: 'fx_1',
          base: 'USD',
          quote: 'CDF',
          rate: 2800,
          asOf: new Date(Date.now() - 7 * 24 * 3600 * 1000),
          source: 'BCC',
          sourceLabel: 'Banque centrale du Congo',
        },
      ],
    }),
  );
  try {
    const result = await fxService.resolve({ base: 'USD', quote: 'CDF' });
    assert.equal(result.available, true);
    assert.equal(result.stale, true);
    assert.match(result.warning, /rafraîchir/i);
  } finally {
    restore();
  }
});

test('INS-01 : un pays sans organisation ne produit aucun indicateur inventé', async () => {
  const { restore } = await withFakePrisma(prisma, baseStore({ organization: [] }));
  try {
    const result = await insightsService.overview({ countryCode: 'CD' });
    assert.deepEqual(result.indicators, {});
    assert.equal(result.disclosure.empty, true);
  } finally {
    restore();
  }
});

test('INS-02 : le k-anonymat supprime les groupes trop petits', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    baseStore({
      organization: [
        { id: 'org_a', countryCode: 'CD', deletedAt: null },
        { id: 'org_b', countryCode: 'CD', deletedAt: null },
      ],
      production: [
        { id: 'p1', organizationId: 'org_a', cropId: 'crop_1', quantityKg: 800, deletedAt: null },
        { id: 'p2', organizationId: 'org_b', cropId: 'crop_1', quantityKg: 600, deletedAt: null },
      ],
      crop: [{ id: 'crop_1', slug: 'mais', names: { fr: 'Maïs' } }],
    }),
  );
  try {
    const result = await insightsService.byCrop({ countryCode: 'CD' });
    assert.equal(result.crops.length, 0, 'aucune culture publiée sous le seuil');
    assert.equal(result.suppressed, 1);
    assert.ok(!JSON.stringify(result).includes('800'), 'aucune valeur du groupe supprimé ne fuit');
  } finally {
    restore();
  }
});
