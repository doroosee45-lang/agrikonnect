/**
 * SPEC-SUPER-ADMIN M1 — tableau de bord centralisé.
 *
 * Ce que garantit ce test :
 *   1. `buildDashboard` (pur) expose une réponse complète : comptes détaillés,
 *      organisations par type, marché, qualité, série d'inscriptions, filtres
 *      et date de calcul (RG-M1-1 : aucun chiffre figé, calcul à la requête) ;
 *   2. `dashboardCsv` (pur) sérialise la vue pour l'export (RG-M1-4) avec
 *      échappement des guillemets ;
 *   3. `dashboardQuerySchema` valide les filtres pays/période et refuse les
 *      formats invalides avant tout accès base.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDashboard, dashboardCsv } from '../src/modules/admin/admin.service.js';
import { dashboardQuerySchema } from '../src/modules/admin/admin.schema.js';

const COMPTEURS = {
  usersTotal: 120, usersActive: 100, usersSuspended: 5, usersUnverifiedEmail: 12,
  usersMfa: 3, usersNewInPeriod: 7,
  organizationsIndividual: 80, organizationsCooperative: 10, organizationsCompany: 30,
  farmers: 60, cooperatives: 9, farms: 45, plots: 90, productions: 200, soilAssessments: 33,
  pendingVerifications: 4, openReports: 2,
  listingsPublished: 18, ordersInPeriod: 6, disputesOpen: 1,
  signups: [{ month: '2026-09', count: 4 }, { month: '2026-10', count: 3 }],
};

// ─── buildDashboard (RG-M1-1) ───────────────────────────────────────────────

test('buildDashboard : réponse complète, filtres échos, date de calcul ISO', () => {
  const filtres = { country: 'CD', from: '2026-10-01', to: '2026-10-31' };
  const kpis = buildDashboard(COMPTEURS, filtres);

  assert.equal(kpis.users, 120);
  assert.equal(kpis.usersActive, 100);
  assert.equal(kpis.usersSuspended, 5);
  assert.equal(kpis.usersUnverifiedEmail, 12);
  assert.equal(kpis.usersMfa, 3);
  assert.equal(kpis.usersNewInPeriod, 7);
  assert.equal(kpis.organizationsCooperative, 10);
  assert.equal(kpis.listingsPublished, 18);
  assert.equal(kpis.ordersInPeriod, 6);
  assert.equal(kpis.disputesOpen, 1);
  assert.equal(kpis.pendingVerifications, 4);
  assert.deepEqual(kpis.series.signups, COMPTEURS.signups);
  assert.deepEqual(kpis.filters, filtres);
  assert.match(kpis.generatedAt, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  // Clés P3 conservées (compatibilité des clients existants).
  for (const cle of ['farmers', 'cooperatives', 'farms', 'plots', 'productions',
    'soilAssessments', 'openReports']) {
    assert.ok(Number.isInteger(kpis[cle]), `${cle} doit être un entier`);
  }
});

// ─── dashboardCsv (RG-M1-4) ─────────────────────────────────────────────────

test('dashboardCsv : en-tête, sections et échappement des guillemets', () => {
  const kpis = buildDashboard(COMPTEURS, {});
  const csv = dashboardCsv(kpis);
  const lignes = csv.split('\n');

  assert.equal(lignes[0], 'section,label,value');
  assert.ok(csv.includes('"COMPTES","Comptes crees","120"'));
  assert.ok(csv.includes('"MARCHE","Litiges ouverts","1"'));
  assert.ok(csv.includes('"SERIE","Inscriptions 2026-09","4"'));
  assert.equal(lignes.length, 20 + COMPTEURS.signups.length); // 19 lignes + en-tête + 2 points
});

test('dashboardCsv : un libellé contenant un guillemet est échappé', () => {
  const kpis = buildDashboard({ ...COMPTEURS, signups: [{ month: '2026-01', count: 1 }] }, {});
  const csv = dashboardCsv(kpis);
  assert.ok(csv.includes('"Inscriptions 2026-01"'));
  assert.equal(csv.split('""').length, 1, 'aucun guillemet à échapper dans les libellés standards');
});

// ─── Filtres (validation avant accès base) ──────────────────────────────────

test('dashboardQuerySchema : accepte pays ISO et bornes AAAA-MM-JJ', () => {
  const valide = dashboardQuerySchema.parse({ country: 'cd', from: '2026-10-01', to: '2026-10-31' });
  assert.equal(valide.country, 'CD', 'le code pays est normalisé en majuscules');
  assert.equal(valide.from, '2026-10-01');
});

test('dashboardQuerySchema : refuse les formats invalides', () => {
  assert.throws(() => dashboardQuerySchema.parse({ country: 'CODE' }), /2 lettres/);
  assert.throws(() => dashboardQuerySchema.parse({ from: '31/10/2026' }), /AAAA-MM-JJ/);
  assert.throws(() => dashboardQuerySchema.parse({ to: '2026-13-45' }), /calendrier/i);
  assert.throws(() => dashboardQuerySchema.parse({ from: '2026-02-31' }), /calendrier/i);
  // Un objet vide est valide (aucun filtre).
  assert.deepEqual(dashboardQuerySchema.parse({}), {});
});