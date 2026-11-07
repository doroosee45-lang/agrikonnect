import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';
import * as ai from '../src/modules/ai/ai.service.js';
import * as dataroom from '../src/modules/dataroom/dataroom.service.js';
import * as apiclients from '../src/modules/apiclients/apiclients.service.js';
import * as dataproducts from '../src/modules/dataproducts/dataproducts.service.js';

/**
 * Garde-fous non négociables de V3 → V5, sur Prisma simulé.
 *
 * Ces règles ne sont pas des préférences produit : ce sont les conditions que
 * le CDC pose pour que la plateforme reste licite et défendable.
 */

const ORG = 'org_owner';
const INVESTOR = 'org_investor';

const reqAs = (organizationId, roles = ['FARMER'], userId = 'user_1') => ({
  tenant: { organizationId, effectiveRoles: roles },
  user: { id: userId, roles },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
});

const emptyStore = () => ({
  aiAnalysis: [],
  plot: [],
  notification: [],
  notificationPreference: [],
  auditLog: [],
  project: [],
  dataRoomAccessRequest: [],
  dataRoomAccessLog: [],
  membership: [],
  apiClient: [],
  apiKey: [],
  apiUsageLog: [],
  dataProduct: [],
  aggregate: [],
  production: [],
  farm: [],
  crop: [],
});

test('AI-05 / NFR-09 : aucune analyse d\'image sans consentement explicite, données minimales transmises', async () => {
  const { restore } = await withFakePrisma(prisma, emptyStore());
  try {
    await assert.rejects(
      () => ai.analyze({ type: 'PLANT_PHOTO', imageKey: 'org/leaf.jpg', consentGiven: false }, reqAs(ORG)),
      (error) => error.status === 422 || error.status === 400,
    );
  } finally {
    restore();
  }
});

test('AI-02 → AI-04 : la sortie porte disclaimer, confiance et version de prompt', async () => {
  const { restore } = await withFakePrisma(prisma, emptyStore());
  try {
    const result = await ai.analyze({ type: 'PLANT_PHOTO', imageKey: 'org/leaf.jpg', consentGiven: true }, reqAs(ORG));

    assert.ok(result.disclaimer && result.disclaimer.length > 20, 'avertissement présent');
    assert.ok(result.confidence?.level, 'niveau de confiance explicite');
    assert.equal(result.provenance.promptVersion, ai.PROMPT_VERSION);
    assert.equal(result.provenance.model, ai.MODEL);
    assert.equal(result.analysis.consentGiven, true);
    assert.equal(result.analysis.status, 'COMPLETED');
    assert.equal(result.humanEscalationAvailable, true);
  } finally {
    restore();
  }
});

test('AI-06 : quota journalier par utilisateur → 429', async () => {
  const store = emptyStore();
  const recent = new Date();
  for (let i = 0; i < 60; i += 1) {
    store.aiAnalysis.push({
      id: `aia_${i}`,
      organizationId: ORG,
      userId: 'user_1',
      type: 'PLANT_PHOTO',
      status: 'COMPLETED',
      createdAt: recent,
    });
  }

  const { restore } = await withFakePrisma(prisma, store);
  try {
    await assert.rejects(
      () => ai.analyze({ type: 'CHAT', prompt: 'Bonjour', consentGiven: true }, reqAs(ORG)),
      (error) => error.status === 429,
    );
  } finally {
    restore();
  }
});

test('DR-01 : une data room non publiée est fermée par défaut', async () => {
  const { restore } = await withFakePrisma(prisma, {
    ...emptyStore(),
    project: [
      {
        id: 'prj_1',
        organizationId: ORG,
        status: 'DRAFT',
        title: 'Extension 40 ha',
        deletedAt: null,
      },
    ],
  });
  try {
    await assert.rejects(
      () => dataroom.requestAccess('prj_1', { scope: { documents: ['business_plan'] } }, reqAs(INVESTOR, ['INVESTOR'])),
      (error) => error.status === 409 || error.status === 404,
    );
  } finally {
    restore();
  }
});

test('DR-02 : l\'accès par défaut est en lecture seule, sans téléchargement', async () => {
  const { fake, restore } = await withFakePrisma(prisma, {
    ...emptyStore(),
    project: [
      {
        id: 'prj_1',
        organizationId: ORG,
        status: 'PUBLISHED',
        title: 'Extension 40 ha',
        deletedAt: null,
      },
    ],
    membership: [{ id: 'mem_owner', organizationId: ORG, userId: 'user_owner', status: 'ACTIVE' }],
  });
  try {
    const request = await dataroom.requestAccess(
      'prj_1',
      { scope: { documents: ['business_plan'] }, justification: 'Analyse préalable à un investissement' },
      reqAs(INVESTOR, ['INVESTOR']),
    );

    assert.equal(request.status, 'PENDING', 'aucun accès sans décision du propriétaire');
    assert.equal(request.scope.download, false, 'téléchargement désactivé par défaut');
    assert.ok(request.scope.requestedDays > 0, 'durée demandée enregistrée');

    // Le propriétaire est notifié, pas seulement informé passivement
    assert.equal(fake._store.notification.length, 1);
  } finally {
    restore();
  }
});

test('API-03 : aucune clé ne peut être émise sans finalité approuvée', async () => {
  const { restore } = await withFakePrisma(prisma, {
    ...emptyStore(),
    apiClient: [
      {
        id: 'cap_1',
        organizationId: ORG,
        name: 'Partenaire météo',
        scopes: ['prices.read'],
        status: 'ACTIVE',
        dataPurpose: 'Modèles de prévision de prix',
        purposeApprovedAt: null,
        keys: [],
      },
    ],
  });
  try {
    await assert.rejects(
      () => apiclients.issueKey('cap_1', { label: 'prod' }, reqAs(ORG, ['ADMIN'])),
      (error) => error.status === 403 && /Finalité non approuvée/.test(error.message),
    );
  } finally {
    restore();
  }
});

test('API-02 : la clé n\'est affichée qu\'une fois et stockée hachée', async () => {
  const { fake, restore } = await withFakePrisma(prisma, {
    ...emptyStore(),
    apiClient: [
      {
        id: 'cap_1',
        organizationId: ORG,
        name: 'Partenaire météo',
        scopes: ['prices.read'],
        status: 'ACTIVE',
        dataPurpose: 'Modèles de prévision de prix',
        purposeApprovedAt: new Date(),
        keys: [],
      },
    ],
  });
  try {
    const issued = await apiclients.issueKey('cap_1', { label: 'prod' }, reqAs(ORG, ['ADMIN']));

    assert.match(issued.apiKey, /^ak_/);
    assert.match(issued.warning, /une seule fois/i);

    const stored = fake._store.apiKey[0];
    assert.equal(stored.keyHash.length, 64, 'empreinte SHA-256');
    assert.ok(!JSON.stringify(stored).includes(issued.apiKey), 'la clé en clair n\'est jamais persistée');
    assert.equal(stored.prefix, issued.apiKey.slice(0, 12));
  } finally {
    restore();
  }
});

test('DATA-01 : k-anonymat — aucun agrégat sous le seuil d\'organisations', async () => {
  const production = (org, slug, country, qty) => ({
    id: `pdr_${org}_${slug}`,
    organizationId: org,
    crop: { slug },
    farm: { countryCode: country },
    quantityKg: qty,
    source: 'declared',
    harvestedAt: new Date('2026-09-10T00:00:00Z'),
    deletedAt: null,
  });

  const { fake, restore } = await withFakePrisma(prisma, {
    ...emptyStore(),
    dataProduct: [
      {
        id: 'dp_1',
        slug: 'mais-cd',
        name: 'Maïs — RDC',
        minGroupSize: 5,
        fields: ['crop', 'country', 'quantity'],
        status: 'DRAFT',
      },
    ],
    // 3 organisations seulement : sous le seuil de 5
    production: [
      production('org_1', 'mais', 'CD', 1200),
      production('org_2', 'mais', 'CD', 900),
      production('org_3', 'mais', 'CD', 1500),
    ],
  });
  try {
    const result = await dataproducts.computeAggregate('dp_1', { period: '2026-09' }, reqAs(ORG, ['DATA_STEWARD']));

    assert.equal(result.aggregates.length, 0, 'aucun agrégat publié');
    assert.equal(result.suppressed.length, 1);
    assert.equal(result.suppressed[0].groupCount, 3);
    assert.equal(fake._store.aggregate.length, 0, 'rien n\'est écrit en base');

    // La composition n'est jamais divulguée pour un groupe supprimé
    assert.ok(!JSON.stringify(result.suppressed).includes('1200'));
  } finally {
    restore();
  }
});

test('DATA-02 : un agrégat publié porte règle, composition et jamais min/max', async () => {
  const production = (org, qty) => ({
    id: `pdr_${org}`,
    organizationId: org,
    crop: { slug: 'mais' },
    farm: { countryCode: 'CD' },
    quantityKg: qty,
    source: 'declared',
    harvestedAt: new Date('2026-09-10T00:00:00Z'),
    deletedAt: null,
  });

  const { restore } = await withFakePrisma(prisma, {
    ...emptyStore(),
    dataProduct: [
      { id: 'dp_1', slug: 'mais-cd', name: 'Maïs — RDC', minGroupSize: 5, fields: ['crop'], status: 'PUBLISHED' },
    ],
    production: ['a', 'b', 'c', 'd', 'e', 'f'].map((org, i) => production(`org_${org}`, 1000 + i * 100)),
  });
  try {
    const result = await dataproducts.computeAggregate('dp_1', { period: '2026-09' }, reqAs(ORG, ['DATA_STEWARD']));
    const aggregate = result.aggregates[0];

    assert.equal(aggregate.groupCount, 6);
    assert.ok(aggregate.value.totalQuantityKg > 0);
    assert.ok(!('min' in aggregate.value) && !('max' in aggregate.value), 'pas de min/max : ré-identifiant');
    assert.ok(aggregate.composition.declared.share >= 0);
    assert.equal(aggregate.ruleVersion, dataproducts.RULE_VERSION);
  } finally {
    restore();
  }
});
