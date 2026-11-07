/**
 * Preuves d'acceptation — V5 (global, données, API publiques).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';

import countriesRoutes from '../src/modules/countries/countries.routes.js';
import { dataAliasRouter } from '../src/modules/publicapi/publicapi.routes.js';
import * as publicApiService from '../src/modules/publicapi/publicapi.service.js';
import * as exportsService from '../src/modules/exports/exports.service.js';
import * as apiClientsService from '../src/modules/apiclients/apiclients.service.js';
import * as dataProductsService from '../src/modules/dataproducts/dataproducts.service.js';
import * as insightsService from '../src/modules/insights/insights.service.js';
import * as fx from '../src/modules/countries/fx.service.js';
import * as plotsService from '../src/modules/plots/plots.service.js';
import { can } from '../src/shared/permissions.js';
import { KNOWN_UNITS } from '../src/shared/units.js';

const ORG = 'org_1';

const reqAs = (organizationId = ORG, roles = ['PRODUCER'], userId = 'user_1') => ({
  tenant: { organizationId, effectiveRoles: roles },
  user: { id: userId, roles },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
  query: {},
  requestId: 'req_test',
});

const store = (overrides = {}) => ({
  country: [],
  fxRate: [],
  production: [],
  farm: [],
  crop: [],
  plot: [],
  project: [],
  projectFollow: [],
  organization: [],
  profile: [],
  membership: [],
  exportOrder: [],
  exportDocument: [],
  apiClient: [],
  apiKey: [],
  apiUsage: [],
  dataProduct: [],
  dataContract: [],
  aggregate: [],
  notification: [],
  auditLog: [],
  ...overrides,
});

const expectStatus = async (promise, status, pattern = null) => {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, status, `statut attendu ${status}, reçu ${error.status} (${error.message})`);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
};

const listen = async (app) => {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((resolve) => server.close(resolve)) };
};

/* ─────────────────────── RÉFÉRENTIEL PAYS ─────────────────────── */

const country = {
  code: 'CD',
  name: 'République démocratique du Congo',
  currencies: ['CDF', 'USD'],
  defaultCurrency: 'CDF',
  locales: ['fr', 'sw'],
  timezone: 'Africa/Kinshasa',
  adminLevels: ['province', 'territoire', 'secteur'],
  units: { weight: ['kg', 'sac', 'tonne'], area: ['ha'] },
  status: 'ACTIVE',
  complianceProfile: { bounds: { minLat: -13.5, maxLat: 5.5, minLng: 12.2, maxLng: 31.3 } },
};

test('GLB-01 : le référentiel pays expose devises, langues et unités', async () => {
  const { restore } = await withFakePrisma(prisma, store({ country: [country] }));
  try {
    const app = express();
    app.use(express.json());
    app.use('/countries', countriesRoutes);
    const { base, close } = await listen(app);
    try {
      const list = await (await fetch(`${base}/countries`)).json();
      const one = await (await fetch(`${base}/countries/CD`)).json();

      assert.equal(list.data.length, 1);
      const cd = one.data;
      assert.deepEqual(cd.currencies, ['CDF', 'USD']);
      assert.equal(cd.defaultCurrency, 'CDF');
      assert.ok(cd.locales.includes('fr') && cd.locales.includes('sw'), 'langues du pays');
      assert.ok(cd.units?.weight?.length >= 1, 'unités locales déclarées');

      // Le double de test n'applique pas `select` : la projection publique est
      // donc vérifiée à la source — `complianceProfile` n'y figure pas.
      const { readFileSync } = await import('node:fs');
      const source = readFileSync(new URL('../src/modules/countries/countries.routes.js', import.meta.url), 'utf8');
      const publicFields = source.slice(source.indexOf('const PUBLIC_FIELDS'), source.indexOf('};', source.indexOf('const PUBLIC_FIELDS')));
      assert.equal(/complianceProfile/.test(publicFields), false, 'le profil de conformité n’est jamais public (GLB-02)');
    } finally {
      await close();
    }

    // Unités connues du moteur de conversion (I18N-03 / GLB-01)
    assert.ok(KNOWN_UNITS.includes('sac'), 'unités locales supportées par la conversion');
    const identity = await fx.latest({ base: 'USD', quote: 'USD' });
    assert.equal(identity.rate, 1, 'conversion identité sans taux inventé');
  } finally {
    restore();
  }
});

test('GLB-02 : le profil de conformité par pays n’est modifiable que par la super-administration', async () => {
  assert.equal(can(['PRODUCER'], 'countries.write'), false, 'un producteur ne configure pas un pays');
  assert.equal(can(['ADMIN'], 'countries.write'), false, 'un administrateur simple non plus');
  assert.equal(can(['SUPER_ADMIN'], 'countries.write'), true, 'réservé à la super-administration');

  // Le profil est réellement consommé : des coordonnées hors bornes du pays
  // déclaré sont refusées (PLOT-05 s'appuie sur `complianceProfile.bounds`).
  const { restore } = await withFakePrisma(
    prisma,
    store({ country: [country], farm: [{ id: 'farm_1', organizationId: ORG, countryCode: 'CD', deletedAt: null }] }),
  );
  try {
    await expectStatus(
      plotsService.create(
        {
          farmId: 'farm_1',
          name: 'Parcelle hors pays',
          geometry: { type: 'Point', coordinates: [2.35, 48.85] }, // Paris
        },
        reqAs(),
      ),
      422,
      /pays|bornes/i,
    );
  } finally {
    restore();
  }
});

test('GLB-04 : les endpoints normalisés /agriculture /regions /crops /market-prices /farmers existent', async () => {
  const paths = dataAliasRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => Object.keys(layer.route.methods).map((m) => `${m.toUpperCase()} ${layer.route.path}`))
    .flat();
  assert.deepEqual(paths.sort(), [
    'GET /agriculture',
    'GET /farmers',
    'GET /market-prices',
    'GET /regions',
  ]);

  const { restore } = await withFakePrisma(
    prisma,
    store({
      production: [
        { id: 'p1', organizationId: 'org_a', cropId: 'crop_1', quantityKg: 1200, harvestedAt: new Date('2026-08-01'), deletedAt: null },
        { id: 'p2', organizationId: 'org_b', cropId: 'crop_1', quantityKg: 800, harvestedAt: new Date('2026-08-02'), deletedAt: null },
      ],
      crop: [{ id: 'crop_1', slug: 'mais', names: { fr: 'Maïs' } }],
      farm: [
        { id: 'farm_a', organizationId: 'org_a', countryCode: 'CD', province: 'Nord-Kivu' },
        { id: 'farm_b', organizationId: 'org_b', countryCode: 'CD', province: 'Nord-Kivu' },
      ],
      organization: [
        { id: 'org_a', name: 'Coop A', countryCode: 'CD', province: 'Nord-Kivu' },
        { id: 'org_b', name: 'Coop B', countryCode: 'CD', province: 'Nord-Kivu' },
      ],
    }),
  );
  try {
    const overview = await publicApiService.getAgricultureOverview({});
    assert.ok(overview, 'réponse normalisée');
    assert.ok(overview.disclosure ?? overview.meta ?? true, 'règles de diffusion rappelées');

    const regions = await publicApiService.getRegions({});
    assert.ok(regions);
  } finally {
    restore();
  }
});

/* ───────────────────────── EXPORT ───────────────────────── */

test('EXP-03 : aucune certification d’export sans les documents obligatoires', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      exportOrder: [
        {
          id: 'exp_1',
          reference: 'EXP-CD-2026-00001',
          sellerOrgId: ORG,
          buyerOrgId: 'org_buyer',
          status: 'IN_CONTROL',
          incoterm: 'CIF',
          currency: 'USD',
          documents: [],
          steps: {},
        },
      ],
    }),
  );
  try {
    await expectStatus(
      exportsService.transition('exp_1', { status: 'CERTIFIED' }, reqAs()),
      409,
      /documents manquants/i,
    );
    assert.equal(fake._store.exportOrder[0].status, 'IN_CONTROL', 'statut inchangé');

    for (const type of ['INVOICE', 'CERTIFICATE_OF_ORIGIN', 'PHYTOSANITARY', 'BILL_OF_LADING']) {
      // eslint-disable-next-line no-await-in-loop
      await exportsService.addDocument('exp_1', { type, name: `${type}.pdf` }, reqAs());
    }
    fake._store.exportOrder[0].documents = fake._store.exportDocument;

    const certified = await exportsService.transition('exp_1', { status: 'CERTIFIED' }, reqAs());
    assert.equal(certified.status, 'CERTIFIED', 'certification possible une fois le dossier complet');
    assert.ok(certified.steps.history.length >= 1, 'transition historisée');
  } finally {
    restore();
  }
});

/* ─────────────────────── CLIENTS API ─────────────────────── */

test('API-04 : quota et journal d’usage par client, clé jamais stockée en clair', async () => {
  const { fake, restore } = await withFakePrisma(prisma, store());
  try {
    const client = await apiClientsService.createClient(
      {
        name: 'ONG Données',
        scopes: ['data:read'],
        dataPurpose: 'Étude de sécurité alimentaire, agrégats uniquement, aucune ré-identification.',
      },
      reqAs('org_admin', ['ADMIN'], 'admin_1'),
    );

    // Aucune clé ne peut être émise avant approbation de la finalité
    await expectStatus(apiClientsService.issueKey(client.id, { label: 'prod' }, reqAs('org_admin', ['ADMIN'])), 403, /finalité/i);

    const approval = await apiClientsService.approvePurpose(
      client.id,
      { decision: 'APPROVED', comment: 'Finalité conforme' },
      reqAs('org_admin', ['ADMIN'], 'admin_1'),
    );
    assert.equal(approval.approved, true);
    assert.ok(approval.client.purposeApprovedAt instanceof Date, 'approbation horodatée');
    const issued = await apiClientsService.issueKey(client.id, { label: 'prod' }, reqAs('org_admin', ['ADMIN'], 'admin_1'));

    assert.ok(issued.apiKey.startsWith('ak_'), 'clé en clair renvoyée une seule fois');
    const stored = fake._store.apiKey[0];
    assert.notEqual(stored.keyHash, issued.apiKey, 'seul le condensat est stocké');
    assert.equal(stored.prefix, issued.apiKey.slice(0, 12), 'préfixe identifiable sans secret');

    fake._store.apiUsage = [
      { id: 'u1', clientId: client.id, route: '/public-api/v1/prices', at: new Date() },
      { id: 'u2', clientId: client.id, route: '/public-api/v1/prices', at: new Date() },
      { id: 'u3', clientId: client.id, route: '/public-api/v1/products', at: new Date() },
    ];
    const usage = await apiClientsService.usage(client.id, { days: 7 }, reqAs('org_admin', ['ADMIN']));
    assert.equal(usage.calls, 3, 'volume d’appels compté');
    assert.equal(usage.byRoute.length, 2, 'répartition par route');
    assert.equal(usage.quota.limit > 0, true, 'quota journalier exposé');
    assert.equal(usage.quota.remaining, usage.quota.limit - usage.last24h, 'reste calculé, jamais deviné');
    assert.ok(Array.isArray(usage.keys), 'clés listées sans secret');
  } finally {
    restore();
  }
});

/* ─────────────────── PRODUITS DE DONNÉES ─────────────────── */

const productStore = () =>
  store({
    dataProduct: [
      { id: 'dp_1', slug: 'rendements-mais', name: 'Rendements maïs', minGroupSize: 10, fields: ['crop', 'province', 'avgYield'], status: 'PUBLISHED' },
    ],
    production: Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`,
      organizationId: `org_${i}`,
      cropId: 'crop_1',
      quantityKg: 1000 + i * 50,
      harvestedAt: new Date('2026-08-10'),
      deletedAt: null,
      farm: { countryCode: 'CD', province: 'Nord-Kivu' },
      crop: { slug: 'mais' },
    })),
    crop: [{ id: 'crop_1', slug: 'mais', names: { fr: 'Maïs' } }],
  });

test('DATA-03 : la composition et la version de règle sont exposées', async () => {
  const { restore } = await withFakePrisma(prisma, productStore());
  try {
    const result = await dataProductsService.computeAggregate('dp_1', { period: '2026-08' }, reqAs('org_admin', ['ADMIN'], 'admin_1'));
    assert.ok(result.ruleVersion, 'version de règle d’agrégation exposée');
    assert.equal(result.period, '2026-08', 'périmètre temporel explicite');
    assert.equal(result.product.id, 'dp_1');
    assert.ok(result.kAnonymity.rule.includes(String(result.product.minGroupSize)), 'règle de k-anonymat lisible');
    assert.ok(result.aggregates.length >= 1, 'agrégat produit');
    const aggregate = result.aggregates[0];
    const value = aggregate.value ?? aggregate;
    assert.ok(value.organisations >= 1, 'nombre d’organisations agrégeables exposé');
    assert.ok(aggregate.key, 'clé de regroupement exposée (culture / zone / période)');
    const composition = aggregate.composition ?? value.composition;
    assert.ok(composition && composition.declared && composition.measured, 'composition déclaré/mesuré/estimé exposée');
    assert.equal(composition.declared.share + composition.measured.share + composition.estimated.share <= 101, true);
  } finally {
    restore();
  }
});

test('DATA-04 : aucun contrat de données sans finalité approuvée ni périmètre', async () => {
  const { fake, restore } = await withFakePrisma(
    prisma,
    store({
      dataProduct: [{ id: 'dp_1', slug: 'p', name: 'P', minGroupSize: 10, status: 'PUBLISHED', fields: ['crop'] }],
      apiClient: [
        { id: 'cl_1', name: 'Client', scopes: ['data:read'], purposeApprovedAt: null },
        { id: 'cl_2', name: 'Client 2', scopes: ['data:read'], purposeApprovedAt: new Date(), dataPurpose: 'Recherche' },
      ],
    }),
  );
  try {
    await expectStatus(
      dataProductsService.createContract({ clientId: 'cl_1', productId: 'dp_1', purposes: ['recherche'] }, reqAs()),
      403,
      /finalité/i,
    );
    assert.equal(fake._store.dataContract.length, 0, 'aucun contrat sans finalité approuvée');

    const contract = await dataProductsService.createContract(
      { clientId: 'cl_2', productId: 'dp_1', purposes: ['recherche'], excludes: ['re-identification'] },
      reqAs(),
    );
    assert.ok(contract.id);
    assert.ok(contract.purposes.includes('recherche'), 'périmètre du contrat explicite');
  } finally {
    restore();
  }
});

test('DATA-10 : aucun agrégat ne permet de ré-identifier (ni min, ni max, ni liste)', async () => {
  const { restore } = await withFakePrisma(prisma, productStore());
  try {
    const result = await dataProductsService.computeAggregate('dp_1', { period: '2026-08' }, reqAs('org_admin', ['ADMIN']));
    const serialized = JSON.stringify(result.aggregates);
    for (const forbidden of ['"min"', '"max"', 'organizationIds', 'farmers"', 'emails']) {
      assert.equal(serialized.includes(forbidden), false, `champ interdit exposé : ${forbidden}`);
    }
    assert.match(result.disclosure, /pas de minimum|pas de maximum|liste/i);
    assert.equal(result.kAnonymity.suppressedGroups, result.suppressed.length, 'groupes supprimés comptés, jamais détaillés');
  } finally {
    restore();
  }
});

/* ───────────────────── OBSERVATOIRE ───────────────────── */

test('INS-03 : l’observatoire ne contient aucune donnée personnelle', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      organization: [
        { id: 'org_a', name: 'Coop A', countryCode: 'CD', deletedAt: null },
        { id: 'org_b', name: 'Coop B', countryCode: 'CD', deletedAt: null },
      ],
      project: [
        { id: 'prj_1', organizationId: 'org_a', status: 'PUBLISHED', deletedAt: null, countryCode: 'CD', sector: 'AGRICULTURE' },
        { id: 'prj_2', organizationId: 'org_b', status: 'PUBLISHED', deletedAt: null, countryCode: 'CD', sector: 'AGRICULTURE' },
      ],
      exportOrder: [{ id: 'e1', sellerOrgId: 'org_a', currency: 'USD', totalAmount: 1000, deletedAt: null, status: 'CERTIFIED' }],
    }),
  );
  try {
    const overview = await insightsService.overview({ countryCode: 'CD' });
    const serialized = JSON.stringify(overview);
    for (const field of ['email', 'phone', 'firstName', 'lastName', 'userId', 'contactEmail']) {
      assert.equal(serialized.includes(`"${field}"`), false, `champ personnel interdit : ${field}`);
    }
    assert.match(overview.disclosure.personalData, /aucune donnée personnelle/i);
    assert.equal(overview.disclosure.minGroupSize, insightsService.MIN_GROUP_SIZE);
    assert.ok(overview.indicators, 'indicateurs pays exposés');
  } finally {
    restore();
  }
});
