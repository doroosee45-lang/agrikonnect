import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Le moteur lit le lot porté par `AGRONOMIC_DATASET`. Cette suite utilise son
 * propre lot pour ne pas croiser les plages des autres suites. La variable doit
 * être posée **avant** `startHarness()`, qui importe l'application.
 */
process.env.AGRONOMIC_DATASET = 'scoring';

const { startHarness } = await import('./support/harness.mjs');

/**
 * Recette de bout en bout — **base réelle** — score d'adéquation gradué et
 * versionnage du moteur (étape D).
 *
 * Ce que cette suite prouve, et que les tests unitaires ne peuvent pas prouver :
 *   - les bornes tolérées écrites par l'API arrivent jusqu'au moteur et
 *     produisent un score **gradué**, pas un verdict binaire ;
 *   - la règle de combinaison n'est pas codée en dur : deux versions tournent
 *     sur les mêmes données et donnent des résultats différents mais
 *     reproductibles ;
 *   - chaque résultat porte sa version et sa règle, et la version est **figée à
 *     l'écriture** — une recommandation ancienne reste lisible ;
 *   - une version inconnue est refusée, pas remplacée ;
 *   - le score est annoncé comme une **adéquation**, ni rendement ni probabilité.
 */

let h;
let farmerToken;
let agroToken;
let plotId;

const PASSWORD = 'MotDePasse!2026';

const register = async ({ email, accountType = 'FARMER', firstName = 'Awa', lastName = 'Kabila' }) => {
  const response = await h.request('POST', '/auth/register', {
    body: { accountType, firstName, lastName, email, password: PASSWORD, countryCode: 'CD', locale: 'fr' },
  });
  assert.equal(response.status, 201, `inscription ${email} : ${JSON.stringify(response.body)}`);
};

const connect = async (email) => {
  const response = await h.request('POST', '/auth/login', { body: { identifier: email, password: PASSWORD } });
  assert.equal(response.status, 200, `connexion ${email} : ${JSON.stringify(response.body)}`);
  return response.body.data.session.accessToken;
};

/**
 * Valeurs **fictives**, choisies pour produire des scores faciles à vérifier :
 *   pH   idéal 5,0–6,0 · toléré 4,5–8,0  → mesure 6,4 ⇒ (8,0−6,4)/(8,0−6,0) = 0,8
 *   EC   idéal 0–1,5   · toléré 0–3,0    → mesure 1,2 ⇒ dans l'idéal ⇒ 1
 *
 * La salinité reste **sous** sa plage idéale : au-dessus, elle éliminerait la
 * culture et il n'y aurait plus de score à comparer.
 */
const RANGES = [
  {
    parameterKey: 'ph',
    minValue: 5.0,
    maxValue: 6.0,
    toleratedMin: 4.5,
    toleratedMax: 8.0,
    unit: 'pH',
    sourceType: 'PUBLICATION',
    sourceReference: 'Source de test',
  },
  {
    parameterKey: 'ec',
    minValue: 0,
    maxValue: 1.5,
    toleratedMin: 0,
    toleratedMax: 3.0,
    unit: 'dS/m',
    sourceType: 'AGRONOMIST',
    sourceReference: 'Source de test',
  },
];

before(async () => {
  h = await startHarness();
  await register({ email: 'fermier-score@agrikonnect.test', firstName: 'Josué', lastName: 'Bomoi' });
  await register({
    email: 'agro-score@agrikonnect.test',
    accountType: 'AGRONOMIST',
    firstName: 'Alice',
    lastName: 'Muteba',
  });

  farmerToken = await connect('fermier-score@agrikonnect.test');
  agroToken = await connect('agro-score@agrikonnect.test');

  const farm = await h.request('POST', '/farms', {
    token: farmerToken,
    body: {
      name: 'Ferme Score',
      countryCode: 'CD',
      province: 'Équateur',
      latitude: 0.0481,
      longitude: 18.2557,
      totalAreaHa: 8,
    },
  });
  assert.equal(farm.status, 201, JSON.stringify(farm.body));
  const farmId = farm.body.data.id ?? farm.body.data.farm?.id;

  const plot = await h.request('POST', '/plots', {
    token: farmerToken,
    body: {
      farmId,
      name: 'Parcelle score',
      geometry: {
        type: 'Polygon',
        coordinates: [[[18.25, 0.048], [18.26, 0.048], [18.26, 0.052], [18.25, 0.052], [18.25, 0.048]]],
      },
      status: 'PLANTED',
    },
  });
  assert.equal(plot.status, 201, JSON.stringify(plot.body));
  plotId = plot.body.data.id ?? plot.body.data.plot?.id;

  // pH 6,4 et EC 1,2 mesurés en laboratoire.
  const assessment = await h.request('POST', `/plots/${plotId}/soil-assessments`, {
    token: farmerToken,
    body: {
      assessedAt: new Date().toISOString(),
      parameters: [
        { key: 'ph', value: '6.4', numericValue: 6.4, unit: 'pH', source: 'measured_lab', confidence: 'high' },
        { key: 'ec', value: '1.2', numericValue: 1.2, unit: 'dS/m', source: 'measured_lab', confidence: 'high' },
      ],
    },
  });
  assert.equal(assessment.status, 201, JSON.stringify(assessment.body));

  // Plages à quatre limites, créées par l'API d'administration.
  for (const range of RANGES) {
    const response = await h.request('POST', '/agronomic-ranges', {
      token: agroToken,
      body: { cropSlug: 'mais', datasetLabel: 'scoring', ...range },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
  }
}, { timeout: 180_000 });

after(async () => {
  await h?.stop();
});

/* ─────────────────────── Métadonnées du moteur ─────────────────────── */

test('E2E moteur : GET /recommendations/engine expose les versions et les règles', async () => {
  const response = await h.request('GET', '/recommendations/engine', { token: farmerToken });
  assert.equal(response.status, 200, JSON.stringify(response.body));

  const data = response.body.data;
  assert.equal(data.default.engineVersion, '2.0');
  assert.equal(data.default.combinationRule, 'MOST_LIMITING');
  assert.equal(data.default.scoringModel, 'GRADED_FOUR_LIMITS');

  const versions = data.versions.map((entry) => entry.engineVersion);
  assert.ok(versions.includes('1.0') && versions.includes('2.0'), versions.join(','));

  const rules = data.combinationRules.map((rule) => rule.id);
  assert.deepEqual(rules.sort(), ['MEAN_SATISFIED', 'MOST_LIMITING']);

  // Le rappel figure dans les métadonnées : un écran peut l'afficher sans le
  // recopier, donc sans risquer de le reformuler.
  assert.match(data.scoreNotice, /adéquation/);
  assert.match(data.scoreNotice, /ni un rendement/);
});

test('E2E moteur : la route /engine n’est pas capturée par /:id', async () => {
  // Ordre de déclaration : « engine » doit être traité comme un segment
  // littéral, pas comme un identifiant de recommandation (qui exigerait ≥ 10
  // caractères et renverrait un 422).
  const response = await h.request('GET', '/recommendations/engine', { token: farmerToken });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.ok(response.body.data.versions, 'ce sont bien les métadonnées du moteur');
});

/* ─────────────────────── Score gradué ─────────────────────── */

test('E2E moteur : le score est gradué sur les quatre limites', async () => {
  const response = await h.request('POST', `/plots/${plotId}/recommendations`, {
    token: farmerToken,
    body: { periodStart: '2026-09-01', periodEnd: '2026-10-31' },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));

  const data = response.body.data;
  const best = data.recommendation.scores.find((entry) => entry.cropSlug === 'mais');
  assert.ok(best, 'le maïs doit être classé');

  const ph = best.criteria.find((criterion) => criterion.key === 'ph');
  const ec = best.criteria.find((criterion) => criterion.key === 'ec');

  // pH 6,4 : au-dessus de l'idéal (6,0) mais sous le toléré (8,0).
  assert.equal(ph.scoringMode, 'GRADED', 'les quatre limites permettent une notation graduée');
  assert.equal(ph.adequacy, 0.8, `(8,0 − 6,4) / (8,0 − 6,0) = 0,8 — obtenu ${ph.adequacy}`);
  assert.equal(ph.met, false, 'hors plage idéale : le critère n’est pas satisfait');

  // EC 1,2 : dans la plage idéale.
  assert.equal(ec.adequacy, 1);
  assert.equal(ec.met, true);

  // Règle par défaut : facteur le plus limitant ⇒ 0,8.
  assert.equal(best.score, 0.8, `score attendu 0,8 — obtenu ${best.score}`);
  assert.equal(best.combinationRule, 'MOST_LIMITING');
  assert.equal(best.engineVersion, '2.0');
  assert.equal(best.scoringModel, 'GRADED_FOUR_LIMITS');
});

test('E2E moteur : la version est figée à l’écriture', async () => {
  const response = await h.request('POST', `/plots/${plotId}/recommendations`, {
    token: farmerToken,
    body: { periodStart: '2026-09-01', periodEnd: '2026-10-31', engineVersion: '1.0' },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));

  // La version demandée est celle qui a servi.
  assert.equal(response.body.data.engineVersion, '1.0');
  assert.equal(response.body.data.combinationRule, 'MEAN_SATISFIED');

  // Et elle est persistée : relue depuis la base, pas déduite de la
  // configuration courante.
  const stored = await h.prisma.cropRecommendation.findUnique({
    where: { id: response.body.data.recommendation.id },
  });
  assert.equal(stored.ruleSetVersion, '1.0');
});

test('E2E moteur : deux versions sur les mêmes données donnent des scores différents mais reproductibles', async () => {
  const run = async (engineVersion) => {
    const response = await h.request('POST', `/plots/${plotId}/recommendations`, {
      token: farmerToken,
      body: { periodStart: '2026-09-01', periodEnd: '2026-10-31', engineVersion },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return response.body.data.recommendation.scores.find((entry) => entry.cropSlug === 'mais').score;
  };

  // 2.0 : gradué, minimum ⇒ min(0,8 ; 1) = 0,8.
  assert.equal(await run('2.0'), 0.8);
  // Reproductible.
  assert.equal(await run('2.0'), 0.8);

  // 1.0 : binaire, moyenne ⇒ pH hors plage idéale = 0, EC dedans = 1 ⇒ 0,5.
  assert.equal(await run('1.0'), 0.5);
  assert.equal(await run('1.0'), 0.5);
});

test('E2E moteur : une version inconnue est refusée, pas remplacée', async () => {
  const response = await h.request('POST', `/plots/${plotId}/recommendations`, {
    token: farmerToken,
    body: { periodStart: '2026-09-01', periodEnd: '2026-10-31', engineVersion: '9.9' },
  });
  assert.equal(response.status, 422, JSON.stringify(response.body));
  assert.match(response.body.message, /Version de moteur inconnue/);

  // Rien n'a été enregistré sous une version fantaisiste.
  const stored = await h.prisma.cropRecommendation.count({
    where: { plotId, ruleSetVersion: '9.9' },
  });
  assert.equal(stored, 0);
});

test('E2E moteur : l’explication dit ce qu’est un score et sous quelle règle', async () => {
  const created = await h.request('POST', `/plots/${plotId}/recommendations`, {
    token: farmerToken,
    body: { periodStart: '2026-09-01', periodEnd: '2026-10-31' },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));

  const explanation = await h.request(
    'GET',
    `/recommendations/${created.body.data.recommendation.id}/explanation`,
    { token: farmerToken },
  );
  assert.equal(explanation.status, 200, JSON.stringify(explanation.body));

  const { text, engineVersion, combinationRule, scoreNotice } = explanation.body.data;
  assert.equal(engineVersion, '2.0');
  assert.equal(combinationRule, 'MOST_LIMITING');
  assert.match(scoreNotice, /adéquation/);
  assert.match(text, /adéquation/, 'le texte lu par l’agriculteur doit le dire aussi');
  assert.match(text, /ni un rendement/);
  assert.match(text, /v2\.0/, 'la version doit apparaître dans le texte');
  assert.match(text, /Facteur le plus limitant/, 'la règle doit apparaître dans le texte');
});

test('E2E moteur : les seuils d’alerte gardent la plage idéale', async () => {
  const response = await h.request('POST', `/plots/${plotId}/recommendations`, {
    token: farmerToken,
    body: { periodStart: '2026-09-01', periodEnd: '2026-10-31' },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));

  const { thresholds } = response.body.data.recommendation;
  // Les bornes tolérées n'ont pas élargi les seuils de surveillance : une
  // alerte doit se déclencher dès la sortie de la plage **idéale**.
  assert.equal(thresholds.ph.min, 5.0);
  assert.equal(thresholds.ph.max, 6.0);
  assert.equal(thresholds.ec.min, 0);
  assert.equal(thresholds.ec.max, 1.5);
  assert.equal(thresholds.ph.toleratedMin, undefined, 'les seuils ne portent pas les bornes tolérées');
});

test('E2E moteur : une plage PROVISIONAL garde la sortie « indicative »', async () => {
  const response = await h.request('POST', `/plots/${plotId}/recommendations`, {
    token: farmerToken,
    body: { periodStart: '2026-09-01', periodEnd: '2026-10-31' },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));

  // Les plages de cette suite sont provisoires : le score gradué ne les rend
  // pas plus sûres pour autant.
  assert.equal(response.body.data.indicative, true);
  assert.ok(
    response.body.data.indicativeReasons.some((reason) => /plages agronomiques/i.test(reason)),
    JSON.stringify(response.body.data.indicativeReasons),
  );
});

/* ─────────── Couverture et nombre de critères évalués ─────────── */

/**
 * Avec la règle du facteur le plus limitant, un paramètre non mesuré est
 * simplement ignoré : il n'abaisse pas le score. Un score élevé pourrait donc
 * reposer sur un seul paramètre sans que l'appelant s'en aperçoive.
 *
 * Ces tests vérifient que les deux garde-fous du moteur — au moins
 * `MIN_EVALUATED_CRITERIA` critères évalués, et une couverture minimale — sont
 * **conservés** et, surtout, **exposés** : le nombre de critères et la
 * couverture figurent dans le résultat, au lieu de rester implicites.
 */
test('E2E moteur : le nombre de critères évalués et la couverture sont exposés', async () => {
  const response = await h.request('POST', `/plots/${plotId}/recommendations`, {
    token: farmerToken,
    body: { periodStart: '2026-09-01', periodEnd: '2026-10-31' },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));

  const best = response.body.data.recommendation.scores.find((entry) => entry.cropSlug === 'mais');
  assert.ok(best, 'le maïs doit être classé');

  // pH et EC sont mesurés, et les deux ont une plage : deux critères évalués.
  assert.equal(best.evaluatedCount, 2, `attendu 2 critères — obtenu ${best.evaluatedCount}`);
  assert.equal(best.tooFewCriteria, false, 'deux critères : au-dessus du minimum');
  assert.equal(best.coverage, 1, 'les deux paramètres évaluables sont évalués');
  assert.equal(best.criteria.length, 2);
});

/**
 * Une culture dont un seul critère peut être évalué **n'est pas classée**, même
 * si ce critère est parfait : le garde-fou `MIN_EVALUATED_CRITERIA` est conservé.
 * Le motif est explicite plutôt que déduit d'une couverture.
 */
test('E2E moteur : un seul critère évalué ne suffit pas à classer', async () => {
  // Le manioc n'a qu'une plage pH dans ce lot : un seul critère évaluable.
  const range = await h.request('POST', '/agronomic-ranges', {
    token: agroToken,
    body: {
      cropSlug: 'manioc',
      datasetLabel: 'scoring',
      parameterKey: 'ph',
      minValue: 5.0,
      maxValue: 6.5,
      toleratedMin: 4.5,
      toleratedMax: 7.5,
      unit: 'pH',
      sourceType: 'AGRONOMIST',
      sourceReference: 'Source de test',
    },
  });
  assert.equal(range.status, 201, JSON.stringify(range.body));

  const response = await h.request('POST', `/plots/${plotId}/recommendations`, {
    token: farmerToken,
    body: { periodStart: '2026-09-01', periodEnd: '2026-10-31' },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));

  const scores = response.body.data.recommendation.scores;
  assert.ok(
    !scores.some((entry) => entry.cropSlug === 'manioc'),
    'une culture évaluée sur un seul critère ne doit pas être classée',
  );

  const insufficient = response.body.data.recommendation.decomposition.insufficientData
    .find((entry) => entry.cropSlug === 'manioc');
  assert.ok(insufficient, 'elle doit figurer dans les données insuffisantes');
  assert.equal(insufficient.evaluatedCount, 1);
  assert.equal(insufficient.cause, 'TOO_FEW_CRITERIA', 'le motif doit nommer le garde-fou');
});

/* ─────────── Reproductibilité : instantané des plages ─────────── */

/**
 * Une plage peut être corrigée après coup. La recommandation déjà enregistrée
 * doit rester **lisible sous les valeurs qui ont servi à son calcul** : sans
 * instantané, le score affiché ne correspondrait plus à aucune ligne
 * consultable, et personne ne pourrait dire si le calcul était faux ou si la
 * donnée a bougé.
 *
 * C'est ce que les tests unitaires ne peuvent pas prouver : il faut écrire une
 * plage, calculer, **modifier la plage**, puis relire.
 */
test('E2E moteur : les plages utilisées sont enregistrées et survivent à leur modification', async () => {
  const created = await h.request('POST', `/plots/${plotId}/recommendations`, {
    token: farmerToken,
    body: { periodStart: '2026-09-01', periodEnd: '2026-10-31' },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));

  const before = created.body.data.recommendation.scores.find((entry) => entry.cropSlug === 'mais');
  const phBefore = before.criteria.find((criterion) => criterion.key === 'ph');
  const snapshot = phBefore.rangeSnapshot;
  assert.ok(snapshot, 'le critère doit porter l’instantané de sa plage');

  // Les quatre limites, le statut, la source et l'identifiant sont enregistrés.
  assert.equal(snapshot.idealMin, 5.0);
  assert.equal(snapshot.idealMax, 6.0);
  assert.equal(snapshot.toleratedMin, 4.5);
  assert.equal(snapshot.toleratedMax, 8.0);
  assert.equal(snapshot.status, 'PROVISIONAL');
  assert.equal(snapshot.sourceType, 'PUBLICATION');
  assert.ok(snapshot.sourceReference, 'la source ayant servi au calcul est conservée');
  assert.ok(snapshot.rangeId, 'l’identifiant de la plage est conservé');

  // ── Un agronome corrige la plage : l'idéal se resserre, le toléré change. ──
  const patched = await h.request('PATCH', `/agronomic-ranges/${snapshot.rangeId}`, {
    token: agroToken,
    body: { minValue: 5.5, maxValue: 5.9, toleratedMin: 5.0, toleratedMax: 6.5 },
  });
  assert.equal(patched.status, 200, JSON.stringify(patched.body));
  assert.ok(patched.body.data.version > snapshot.rangeVersion, 'la plage a bien été modifiée');

  // ── La recommandation d'avant est relue depuis la base. ──
  const reloaded = await h.request('GET', `/recommendations/${created.body.data.recommendation.id}`, {
    token: farmerToken,
  });
  assert.equal(reloaded.status, 200, JSON.stringify(reloaded.body));
  const after = reloaded.body.data.recommendation
    ? reloaded.body.data.recommendation.scores.find((entry) => entry.cropSlug === 'mais')
    : reloaded.body.data.scores.find((entry) => entry.cropSlug === 'mais');
  const phAfter = after.criteria.find((criterion) => criterion.key === 'ph');

  // L'instantané n'a pas bougé : le calcul reste reproductible.
  assert.deepEqual(phAfter.rangeSnapshot, snapshot, 'l’instantané ne doit pas suivre la plage');
  assert.equal(after.score, before.score, 'le score enregistré ne change pas');
  assert.equal(phAfter.adequacy, phBefore.adequacy);

  // ── Une nouvelle recommandation, elle, utilise la plage corrigée. ──
  const fresh = await h.request('POST', `/plots/${plotId}/recommendations`, {
    token: farmerToken,
    body: { periodStart: '2026-09-01', periodEnd: '2026-10-31' },
  });
  assert.equal(fresh.status, 201, JSON.stringify(fresh.body));
  const freshMaize = fresh.body.data.recommendation.scores.find((entry) => entry.cropSlug === 'mais');
  const freshPh = freshMaize.criteria.find((criterion) => criterion.key === 'ph');
  assert.equal(freshPh.rangeSnapshot.idealMin, 5.5, 'le nouveau calcul lit la plage corrigée');
  assert.notEqual(freshPh.rangeSnapshot.rangeVersion, snapshot.rangeVersion);
  // pH 6,4 dépasse désormais le toléré haut (6,5) ? Non : 6,4 < 6,5.
  // (6,5 − 6,4) / (6,5 − 5,9) = 0,1667 → arrondi à 4 décimales.
  assert.equal(freshPh.adequacy, 0.1667, `attendu 0,1667 — obtenu ${freshPh.adequacy}`);
});
