/**
 * Preuves d'acceptation — exigences numérotées citées par le code hors des
 * fichiers `req-v*` thématiques :
 * AI-07 (revue experte), BIL-03 (numérotation sans trou), BIL-04 (règlement
 * déclaratif), CERT-04 (certifications fiables), FX-01/FX-02/FX-03 (cotations
 * datées, sourcées, idempotentes), NFR-08 (règle agronomique opposable
 * seulement après validation par un tiers).
 *
 * Chaque test porte l'identifiant qu'il démontre.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';
import * as aiService from '../src/modules/ai/ai.service.js';
import * as billingService from '../src/modules/billing/billing.service.js';
import * as certificationsService from '../src/modules/certifications/certifications.service.js';
import * as fx from '../src/modules/countries/fx.service.js';
import * as intelligence from '../src/modules/soil/intelligence.service.js';

const ORG = 'org_1';

const reqAs = (userId = 'user_owner', roles = ['PRODUCER'], organizationId = ORG) => ({
  tenant: { organizationId, effectiveRoles: roles },
  user: { id: userId, roles },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
  query: {},
  requestId: 'req_test',
});

const store = (overrides = {}) => ({
  aiAnalysis: [],
  invoice: [],
  certification: [],
  fxRate: [],
  agronomicRuleSet: [],
  zoneFeatureFlag: [],
  membership: [],
  notification: [],
  auditLog: [],
  order: [],
  organization: [],
  ...overrides,
});

const expectStatus = async (promise, status, pattern = null) => {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, status, `statut attendu ${status}, reçu ${error.status} (${error.message})`);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
};

/* ───────────────────────────── AI-07 ───────────────────────────── */

test('AI-07 : la revue experte annote la sortie IA sans la réécrire', async () => {
  const analysis = {
    id: 'aia_1',
    organizationId: ORG,
    status: 'COMPLETED',
    model: 'agrikon-advisor-1',
    promptVersion: 'agrikon-v3.1',
    answer: 'Analyse initiale du modèle.',
    feedback: null,
  };
  const { fake, restore } = await withFakePrisma(prisma, store({ aiAnalysis: [analysis] }));
  try {
    const result = await aiService.reviewAnalysis(
      'aia_1',
      { verdict: 'ACCEPTED', comment: 'Cohérent avec la parcelle.' },
      reqAs('user_agro', ['AGRONOMIST']),
    );

    // La sortie machine n'est jamais remplacée : seule une annotation est ajoutée.
    assert.equal(result.analysis.answer, 'Analyse initiale du modèle.');
    assert.match(result.analysis.feedback, /\[revue experte\] ACCEPTED/);
    assert.equal(result.review.model, 'agrikon-advisor-1');
    assert.equal(result.review.promptVersion, 'agrikon-v3.1');
    assert.equal(result.review.reviewerId, 'user_agro');
    assert.match(result.note, /pas modifiée/);

    // Une analyse non terminée ne peut pas être revue (409, pas de revue fantôme).
    fake._store.aiAnalysis[0].status = 'PENDING';
    await expectStatus(
      aiService.reviewAnalysis('aia_1', { verdict: 'ACCEPTED' }, reqAs('user_agro', ['AGRONOMIST'])),
      409,
      /terminée/i,
    );

    assert.equal(fake._store.auditLog[0].action, 'ai.review');
    assert.equal(fake._store.auditLog[0].resourceId, 'aia_1');
  } finally {
    restore();
  }
});

/* ───────────────────────────── BIL-03 ───────────────────────────── */

test('BIL-03 : numérotation séquentielle par organisation et par type, sans trou', async () => {
  const payload = {
    type: 'INVOICE',
    currency: 'USD',
    lines: [{ description: 'Maïs', quantity: 10, unitPrice: 12.5 }],
  };

  const { fake, restore } = await withFakePrisma(prisma, store());
  try {
    const first = await billingService.create(payload, reqAs());
    const second = await billingService.create(payload, reqAs());
    const quote = await billingService.create({ ...payload, type: 'QUOTE' }, reqAs());

    const year = new Date().getUTCFullYear();
    assert.equal(first.invoice.number, `FAC-${year}-00001`);
    assert.equal(second.invoice.number, `FAC-${year}-00002`);
    assert.equal(second.invoice.sequence, 2, 'aucun trou dans la séquence');
    assert.equal(quote.invoice.number, `DOC-${year}-00001`, 'séquence distincte par type de document');
    assert.equal(quote.invoice.type, 'QUOTE');
    assert.equal(first.invoice.totalAmount, 125);

    // Une autre organisation repart de 1 : la séquence est cloisonnée (tenant).
    const other = await billingService.create(payload, reqAs('user_owner', ['PRODUCER'], 'org_2'));
    assert.equal(other.invoice.number, `FAC-${year}-00001`);

    assert.equal(fake._store.invoice.length, 4);
    assert.deepEqual(
      fake._store.invoice.map((invoice) => invoice.sequence),
      [1, 2, 1, 1],
    );
  } finally {
    restore();
  }
});

/* ───────────────────────────── BIL-04 ───────────────────────────── */

test('BIL-04 : le règlement est déclaratif et rappelle qu’aucun fonds n’est détenu', async () => {
  const invoice = {
    id: 'inv_1',
    organizationId: ORG,
    issuerOrgId: ORG,
    recipientOrgId: 'org_2',
    number: 'FAC-2026-00001',
    type: 'INVOICE',
    sequence: 1,
    lines: [{ description: 'Maïs', quantity: 2, unitPrice: 10, lineTotal: 20 }],
    totalAmount: 20,
    currency: 'USD',
  };

  const { fake, restore } = await withFakePrisma(prisma, store({ invoice: [invoice] }));
  try {
    const result = await billingService.declareSettlement('inv_1', { note: 'Virement reçu hors plateforme' }, reqAs());
    assert.equal(result.declared, true);
    assert.match(result.disclaimer, /ne détient, ne transfère ni ne conserve de fonds/i);

    // Le document d'une autre organisation reste introuvable (404, pas 403).
    await expectStatus(
      billingService.declareSettlement('inv_1', {}, reqAs('user_x', ['PRODUCER'], 'org_9')),
      404,
    );

    assert.equal(fake._store.auditLog[0].action, 'invoice.settlement.declared');
  } finally {
    restore();
  }
});

/* ───────────────────────────── CERT-04 ───────────────────────────── */

test('CERT-04 : seules les certifications vérifiées sont fiables, le reste reste déclaré', async () => {
  const now = Date.now();
  const certs = [
    { id: 'crt_1', organizationId: ORG, name: 'Bio', status: 'VERIFIED', expiresAt: new Date(now + 86_400_000), deletedAt: null },
    { id: 'crt_2', organizationId: ORG, name: 'GLOBALG.A.P.', status: 'VERIFIED', expiresAt: new Date(now - 86_400_000), deletedAt: null },
    { id: 'crt_3', organizationId: ORG, name: 'Rainforest', status: 'PENDING', expiresAt: null, deletedAt: null },
  ];

  const { restore } = await withFakePrisma(prisma, store({ certification: certs }));
  try {
    const result = await certificationsService.trusted(ORG);
    assert.equal(result.certifications.length, 2, 'les certifications déclarées non vérifiées sont exclues');
    assert.equal(result.valid, 1);
    assert.equal(result.expired, 1);
    assert.equal(result.declaredPending, 1, 'le volume déclaré non vérifié est exposé séparément');
    assert.equal(result.certifications.some((cert) => cert.name === 'Rainforest'), false);
  } finally {
    restore();
  }
});

/* ───────────────────────── FX-01 / FX-02 / FX-03 ───────────────────────── */

test('FX-03 : rejouer une cotation ne crée pas de doublon (idempotence base/quote/asOf)', async () => {
  const asOf = new Date('2026-10-01T08:00:00.000Z');

  const { fake, restore } = await withFakePrisma(prisma, store());
  try {
    const first = await fx.record(
      { base: 'USD', quote: 'CDF', rate: 2800, source: 'BCC', sourceLabel: 'Banque centrale', asOf },
      reqAs('user_admin', ['ADMIN']),
    );
    const replayed = await fx.record(
      { base: 'USD', quote: 'CDF', rate: 2810, source: 'BCC', sourceLabel: 'Banque centrale', asOf },
      reqAs('user_admin', ['ADMIN']),
    );

    assert.equal(fake._store.fxRate.length, 1, 'une seule cotation par (base, quote, asOf)');
    assert.equal(replayed.rate.rate, 2810, 'la nouvelle saisie met à jour la cotation, sans doublon');
    assert.equal(first.rate.base, 'USD');
    assert.equal(replayed.replayed, true, 'le rejeu est signalé, pas dissimulé');

    // FX-01 / FX-02 — une cotation est datée et sourcée, jamais implicite ;
    // une cotation ancienne est signalée comme telle au lieu d'être utilisée en silence.
    assert.equal(replayed.rate.asOf.toISOString(), asOf.toISOString());
    assert.equal(replayed.rate.source, 'BCC');
    assert.equal(replayed.rate.stale, true);
    assert.match(replayed.rate.warning, /à rafraîchir/i);
    assert.ok(replayed.rate.ageHours > 48);

    // Une paire identique n'a aucun sens économique.
    await expectStatus(fx.record({ base: 'USD', quote: 'USD', rate: 1, asOf }, reqAs()), 422, /distincte/i);
    // Une date future n'est pas une cotation.
    await expectStatus(
      fx.record({ base: 'USD', quote: 'EUR', rate: 0.9, asOf: new Date(Date.now() + 86_400_000) }, reqAs()),
      422,
      /futur/i,
    );
  } finally {
    restore();
  }
});

/* ───────────────────────────── NFR-08 ───────────────────────────── */

test('NFR-08 : une règle agronomique n’est opposable qu’après validation par un tiers', async () => {
  const ruleSet = {
    id: 'ars_1',
    crop: 'maize',
    status: 'draft',
    createdBy: 'user_author',
    validatedBy: [],
    validatedAt: null,
    rules: [{ key: 'ph', type: 'range', min: 5.5, max: 7.5 }],
  };

  const { fake, restore } = await withFakePrisma(prisma, store({ agronomicRuleSet: [ruleSet] }));
  try {
    // L'auteur ne peut pas valider sa propre règle (séparation des rôles).
    await expectStatus(
      intelligence.validateRuleSet('ars_1', reqAs('user_author', ['AGRONOMIST'])),
      403,
      /séparation des rôles/i,
    );
    assert.equal(fake._store.agronomicRuleSet[0].status, 'draft', 'un refus ne modifie pas la règle');

    const validated = await intelligence.validateRuleSet('ars_1', reqAs('user_reviewer', ['AGRONOMIST']));
    assert.equal(validated.ruleSet.status, 'validated');
    assert.deepEqual(validated.ruleSet.validatedBy, ['user_reviewer']);
    assert.ok(validated.ruleSet.validatedAt instanceof Date);
    assert.equal(validated.alreadyValidated, false);

    // Idempotent : revalider ne change ni la date ni les validateurs.
    const again = await intelligence.validateRuleSet('ars_1', reqAs('user_other', ['AGRONOMIST']));
    assert.equal(again.alreadyValidated, true);

    // Un jeu retiré n'est plus opposable.
    fake._store.agronomicRuleSet[0].status = 'retired';
    await expectStatus(intelligence.validateRuleSet('ars_1', reqAs('user_other', ['AGRONOMIST'])), 409, /retiré/i);

    assert.equal(fake._store.auditLog[0].action, 'ruleset.validate');
  } finally {
    restore();
  }
});
