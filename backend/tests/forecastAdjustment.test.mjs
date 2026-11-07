/**
 * Ajustement des critères par la prévision — tests du module pur.
 *
 * Ce qui est vérifié ici tient en une phrase : **une prévision ne peut que
 * durcir un critère, et jamais sur un écart plus petit que son erreur
 * déclarée.** Chaque test isole un de ces garde-fous, parce que chacun pris
 * séparément peut produire une recommandation fausse.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyProjection,
  buildProjections,
  describeAdjustment,
  isUsablePrediction,
  pointsInWindow,
  summarizeWindow,
} from '../src/modules/recommendation/forecastAdjustment.js';
import { scoreCrop } from '../src/modules/recommendation/recommendation.service.js';
import { resolveEngineVersion } from '../src/modules/recommendation/engineVersions.js';

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-01T00:00:00Z');

/** Fenêtre de semis de 60 jours à partir de maintenant. */
const WINDOW = {
  periodStart: new Date(NOW),
  periodEnd: new Date(NOW + 60 * DAY),
  now: new Date(NOW),
};

/** Série linéaire partant de `start`, de `slope` par jour, sur `count` jours. */
const series = (start, slope, count) =>
  Array.from({ length: count }, (_, i) => ({
    at: new Date(NOW + (i + 1) * DAY).toISOString(),
    value: Number((start + slope * (i + 1)).toFixed(3)),
    low: null,
    high: null,
  }));

const prediction = (overrides = {}) => ({
  parameter: 'moisture',
  beatsBaseline: true,
  values: series(25, -0.5, 20),
  horizonDays: 20,
  mae: 0.6,
  rmse: 0.8,
  baselineMae: 2.1,
  mode: 'REAL',
  computedAt: new Date(NOW),
  ...overrides,
});

const RANGE = { min: 20, max: 60, unit: '%' };

/* ─────────────────── utilisabilité d'une prévision ─────────────────── */

test('Une prévision n’est exploitable que si elle bat la persistance', () => {
  assert.equal(isUsablePrediction({ beatsBaseline: true }), true);
  // `false` et `null` refusent tous les deux : l'absence de preuve n'est pas
  // une preuve. C'est la condition du job d'alertes, reproduite à l'identique.
  assert.equal(isUsablePrediction({ beatsBaseline: false }), false);
  assert.equal(isUsablePrediction({ beatsBaseline: null }), false);
  assert.equal(isUsablePrediction({}), false);
  assert.equal(isUsablePrediction(null), false);
  assert.equal(isUsablePrediction(undefined), false);
});

/* ─────────────────────── fenêtre de semis ─────────────────────── */

test('Fenêtre : les points déjà passés sont écartés', () => {
  const pred = prediction({
    values: [
      { at: new Date(NOW - 5 * DAY).toISOString(), value: 30, low: null, high: null },
      { at: new Date(NOW - DAY).toISOString(), value: 28, low: null, high: null },
      { at: new Date(NOW + DAY).toISOString(), value: 26, low: null, high: null },
      { at: new Date(NOW + 2 * DAY).toISOString(), value: 24, low: null, high: null },
    ],
  });

  const points = pointsInWindow(pred, WINDOW);
  assert.equal(points.length, 2, 'un point passé ne prédit rien, il constate');
  assert.deepEqual(points.map((p) => p.value), [26, 24]);
});

test('Fenêtre : les points au-delà de la période sont écartés', () => {
  const pred = prediction({ values: series(25, -0.5, 90) });
  const points = pointsInWindow(pred, WINDOW);
  assert.equal(points.length, 60, 'la période fait 60 jours');
});

test('Fenêtre : une date illisible n’interrompt pas le traitement', () => {
  const pred = prediction({
    values: [
      { at: 'pas-une-date', value: 30, low: null, high: null },
      { at: new Date(NOW + DAY).toISOString(), value: 26, low: null, high: null },
    ],
  });
  const points = pointsInWindow(pred, WINDOW);
  assert.equal(points.length, 1);
  assert.equal(points[0].value, 26);
});

test('Fenêtre : une fin de période absente ne retient rien', () => {
  const points = pointsInWindow(prediction(), { periodStart: new Date(NOW), periodEnd: null, now: new Date(NOW) });
  assert.deepEqual(points, [], 'sans borne de fin, aucune projection n’est possible');
});

/* ──────────────────────── résumé de fenêtre ──────────────────────── */

test('Résumé : extrêmes et dates, sur une série en baisse', () => {
  const summary = summarizeWindow(prediction(), WINDOW);
  // 25 - 0.5*20 = 15 au jour 20 ; 25 - 0.5*1 = 24,5 au jour 1.
  assert.equal(summary.predictedMin, 15);
  assert.equal(summary.predictedMax, 24.5);
  assert.equal(summary.predictedMinAt, new Date(NOW + 20 * DAY).toISOString());
  assert.equal(summary.predictedMaxAt, new Date(NOW + DAY).toISOString());
  assert.equal(summary.mae, 0.6);
  assert.equal(summary.baselineMae, 2.1);
  assert.equal(summary.simulated, false);
});

test('Résumé : la couverture est une étendue temporelle, pas un écart de valeurs', () => {
  // 20 points sur une période de 60 jours → 19 jours d'étendue (du 1er au 20e).
  const declining = summarizeWindow(prediction({ values: series(25, -0.5, 20) }), WINDOW);
  const rising = summarizeWindow(prediction({ values: series(25, 0.5, 20) }), WINDOW);

  assert.equal(declining.coverageRatio, 0.317);
  assert.equal(rising.coverageRatio, 0.317, 'la couverture ne doit pas dépendre du sens de la pente');
  assert.ok(declining.coverageRatio < 1, 'une prévision de 20 jours ne couvre pas 60 jours');
});

test('Résumé : aucun point dans la période → null, pas un résumé vide', () => {
  const summary = summarizeWindow(
    prediction({ values: series(25, -0.5, 5).map((p) => ({ ...p, at: new Date(NOW - 30 * DAY).toISOString() })) }),
    WINDOW,
  );
  assert.equal(summary, null);
});

test('Résumé : bornes d’incertitude nulles quand le moteur ne peut pas les quantifier', () => {
  const summary = summarizeWindow(prediction(), WINDOW);
  assert.equal(summary.predictedMinLow, null);
  assert.equal(summary.predictedMinHigh, null, '`null` veut dire non quantifiable, pas nul');
});

/* ─────────────────────── construction des projections ─────────────────────── */

test('Projections : une prévision non prouvée est écartée avec son motif', () => {
  const { projections, skipped } = buildProjections(
    [prediction({ beatsBaseline: false }), prediction({ parameter: 'ph', beatsBaseline: null })],
    WINDOW,
  );
  assert.deepEqual(projections, {});
  assert.equal(skipped.length, 2);
  assert.equal(skipped[0].reason, 'FORECAST_NOT_PROVEN');
  assert.match(skipped[0].detail, /persistance/);
});

test('Projections : seule la prévision la plus récente par paramètre est retenue', () => {
  const { projections } = buildProjections(
    // `buildProjections` reçoit une liste déjà réduite par l'appelant ; on
    // vérifie ici le regroupement par paramètre, pas le tri.
    [prediction({ parameter: 'moisture' }), prediction({ parameter: 'ph', values: series(6.4, -0.01, 20) })],
    WINDOW,
  );
  assert.deepEqual(Object.keys(projections).sort(), ['moisture', 'ph']);
});

test('Projections : une prévision hors période est écartée avec son motif', () => {
  const { projections, skipped } = buildProjections(
    [prediction({ values: series(25, -0.5, 5).map((p) => ({ ...p, at: new Date(NOW - 40 * DAY).toISOString() })) })],
    WINDOW,
  );
  assert.deepEqual(projections, {});
  assert.equal(skipped[0].reason, 'NO_POINT_IN_PERIOD');
});

/* ─────────────────────── application à un critère ─────────────────────── */

test('Critère : sans projection, rien ne change', () => {
  const result = applyProjection({ range: RANGE, projection: null, measuredMet: true, measuredValue: 25 });
  assert.equal(result.met, true);
  assert.equal(result.downgraded, false);
  assert.equal(result.projection, null);
});

test('Critère : une mesure absente reste non évaluable — la prévision ne la remplace pas', () => {
  const summary = summarizeWindow(prediction(), WINDOW);
  const result = applyProjection({ range: RANGE, projection: summary, measuredMet: null, measuredValue: null });
  assert.equal(result.met, null, 'aucune mesure, aucun critère évalué : on ne note pas sur une projection seule');
  assert.equal(result.downgraded, false);
});

test('Critère : trajectoire prévue dans la plage → inchangé', () => {
  const summary = summarizeWindow(prediction({ values: series(40, -0.1, 20) }), WINDOW);
  const result = applyProjection({ range: RANGE, projection: summary, measuredMet: true, measuredValue: 40 });
  assert.equal(result.met, true);
  assert.equal(result.watch, null);
  assert.ok(result.projection, 'l’ajustement reste tracé même sans effet');
});

test('Critère : franchissement robuste par le bas → critère durci', () => {
  // Prévu 15, minimum 20 : marge 5, bien au-delà de l'erreur de 0,6.
  const summary = summarizeWindow(prediction(), WINDOW);
  const result = applyProjection({ range: RANGE, projection: summary, measuredMet: true, measuredValue: 25 });

  assert.equal(result.met, false);
  assert.equal(result.downgraded, true, 'la mesure du jour était conforme : c’est la prévision qui durcit');
  assert.equal(result.watch, null);
  assert.match(result.reason, /15/);
  assert.match(result.reason, /minimum de 20/);
  assert.match(result.reason, /marge 5/);
  assert.match(result.reason, /erreur du modèle 0.6/);
});

test('Critère : franchissement robuste par le haut → critère durci', () => {
  // Prévu 62 au jour 20, maximum 60 : marge 2 contre une erreur de 0,6.
  const summary = summarizeWindow(prediction({ values: series(50, 0.6, 20) }), WINDOW);
  const result = applyProjection({ range: RANGE, projection: summary, measuredMet: true, measuredValue: 50 });

  assert.equal(result.met, false);
  assert.equal(result.downgraded, true);
  assert.match(result.reason, /au-dessus du maximum de 60/);
});

test('Critère : franchissement dans l’erreur du modèle → signalé, pas durci', () => {
  // Prévu 19,8 au jour 20 contre un minimum de 20 : écart de 0,2 pour une
  // erreur déclarée de 0,6. Écarter une culture sur du bruit serait plus
  // nuisible que se tromper.
  const summary = summarizeWindow(prediction({ values: series(20.5, -0.035, 20) }), WINDOW);
  assert.equal(summary.predictedMin, 19.8, 'garde-fou : la valeur attendue par le test');
  const result = applyProjection({ range: RANGE, projection: summary, measuredMet: true, measuredValue: 20.5 });

  assert.equal(result.met, true, 'le critère n’est pas durci');
  assert.equal(result.downgraded, false);
  assert.equal(result.watch.cause, 'WITHIN_MODEL_ERROR');
  assert.equal(result.watch.direction, 'BELOW');
  assert.ok(result.watch.margin < summary.mae, 'la marge est bien sous l’erreur du modèle');
});

test('Critère : sans erreur déclarée du modèle, on ne durcit pas', () => {
  const summary = summarizeWindow(prediction({ mae: null }), WINDOW);
  const result = applyProjection({ range: RANGE, projection: summary, measuredMet: true, measuredValue: 25 });

  assert.equal(result.met, true, 'impossible de distinguer le signal du bruit sans MAE');
  assert.equal(result.watch.cause, 'WITHIN_MODEL_ERROR');
});

test('Critère : la prévision ne rattrape jamais une mesure déjà hors plage', () => {
  // Mesure à 70 (hors plage), prévision qui redescend à 45 : on sème maintenant.
  const summary = summarizeWindow(prediction({ values: series(60, -0.75, 20) }), WINDOW);
  const result = applyProjection({ range: RANGE, projection: summary, measuredMet: false, measuredValue: 70 });

  assert.equal(result.met, false);
  assert.equal(result.downgraded, false, 'rien n’a été durci : le critère échouait déjà');
});

/* ───────────────────── intégration dans la notation ───────────────────── */

const RANGES_ENTRY = {
  cropSlug: 'mais',
  ranges: {
    ph: { min: 5.5, max: 7, unit: 'pH', status: 'VALIDATED' },
    moisture: { min: 20, max: 60, unit: '%', status: 'VALIDATED' },
  },
};
const STATE = {
  ph: { value: 6.4, unit: 'pH', source: 'measured_lab', confidence: 'high' },
  moisture: { value: 25, unit: '%', source: 'measured_sensor', confidence: 'high' },
};
const CROP = { cropSlug: 'mais', label: 'Maïs', cycleDays: 120 };

test('Notation : sans projections, le comportement est inchangé', () => {
  const scored = scoreCrop(CROP, RANGES_ENTRY, STATE);
  assert.equal(scored.score, 1);
  assert.equal(scored.forecastDowngrades, 0);
  assert.equal(scored.criteria.every((c) => c.forecastAdjusted === false), true);
  // Rétro-compatibilité : l'arité déclarée reste 3, le 4e paramètre est facultatif.
  assert.equal(scoreCrop.length, 3);
});

test('Notation : une prévision prouvée fait baisser le score', () => {
  const { projections } = buildProjections([prediction()], WINDOW);
  const scored = scoreCrop(CROP, RANGES_ENTRY, STATE, projections);

  // Règle par défaut (2.0) : facteur le plus limitant. Un critère devenu
  // défavorable fait tomber le score à 0, il n'est plus dilué par l'autre.
  assert.equal(scored.score, 0, 'le critère durci par la prévision devient le facteur limitant');
  assert.equal(scored.forecastDowngrades, 1);
  // La règle 1.0 (moyenne) reste disponible : elle donnerait 0,5 ici.
  assert.equal(scoreCrop(CROP, RANGES_ENTRY, STATE, projections, resolveEngineVersion('1.0')).score, 0.5);

  const criterion = scored.criteria.find((c) => c.key === 'moisture');
  assert.equal(criterion.met, false);
  assert.equal(criterion.forecastAdjusted, true);
  // La mesure d'origine reste visible : le durcissement ne l'efface pas.
  assert.equal(criterion.observed, 25);
  assert.equal(criterion.downgradedByForecast, true);
  assert.match(criterion.explanation, /valeur dans la plage favorable/);
  assert.match(criterion.explanation, /Prévu hors plage/);
});

test('Notation : le pH non prévu reste noté sur sa mesure', () => {
  const { projections } = buildProjections([prediction()], WINDOW);
  const scored = scoreCrop(CROP, RANGES_ENTRY, STATE, projections);
  const ph = scored.criteria.find((c) => c.key === 'ph');

  assert.equal(ph.met, true);
  assert.equal(ph.forecastAdjusted, false, 'aucune prévision de pH : aucune trace d’ajustement');
});

test('Notation : une prévision prévue n’élimine jamais une culture', () => {
  // Salinité conforme aujourd'hui (0,8) mais prévue à 3,5 — au-delà de la
  // limite éliminatoire de 2. L'élimination reste fondée sur la mesure.
  const { projections } = buildProjections(
    [prediction({ parameter: 'ec', values: series(1.5, 0.1, 20), mae: 0.1 })],
    WINDOW,
  );
  const entry = {
    cropSlug: 'mais',
    ranges: {
      ph: { min: 5.5, max: 7, unit: 'pH', status: 'VALIDATED' },
      moisture: { min: 20, max: 60, unit: '%', status: 'VALIDATED' },
      ec: { min: 0, max: 2, unit: 'dS/m', status: 'VALIDATED' },
    },
  };
  const state = {
    ...STATE,
    ec: { value: 0.8, unit: 'dS/m', source: 'measured_sensor', confidence: 'high' },
  };

  const scored = scoreCrop(CROP, entry, state, projections);

  assert.equal(scored.eliminated, null, 'on n’écarte pas une culture sur une prévision');
  const ec = scored.criteria.find((c) => c.key === 'ec');
  assert.equal(ec.met, false, 'mais le critère n’est pas satisfait');
  assert.equal(ec.downgradedByForecast, true);
  assert.ok(scored.score < 1, 'le score en pâtit');
  assert.equal(scored.usable, true, 'la culture reste classable, avec un avertissement');
});

test('Notation : une salinité mesurée au-delà de la limite élimine toujours', () => {
  const entry = {
    cropSlug: 'mais',
    ranges: {
      ph: { min: 5.5, max: 7, unit: 'pH', status: 'VALIDATED' },
      moisture: { min: 20, max: 60, unit: '%', status: 'VALIDATED' },
      ec: { min: 0, max: 2, unit: 'dS/m', status: 'VALIDATED' },
    },
  };
  const state = { ...STATE, ec: { value: 3.5, unit: 'dS/m', source: 'measured_sensor' } };
  const scored = scoreCrop(CROP, entry, state);

  assert.ok(scored.eliminated, 'le critère dur constaté élimine');
  assert.equal(scored.score, null);
  assert.equal(scored.usable, false);
});

/* ─────────────────────── rédaction de l'ajustement ─────────────────────── */

test('Explication : chaque nombre cité vient de la projection', () => {
  const summary = summarizeWindow(prediction(), WINDOW);
  const text = describeAdjustment('humidité volumique du sol', summary, {
    direction: 'BELOW',
    limit: 20,
    projectedValue: summary.predictedMin,
    projectedAt: summary.predictedMinAt,
    margin: 5,
    mae: summary.mae,
    unit: '%',
  });

  assert.match(text, /humidité volumique du sol/);
  assert.match(text, /20 point\(s\) prévu\(s\)/);
  assert.match(text, /15 %/);
  assert.match(text, /sous le minimum de 20/);
  assert.match(text, /Marge 5/);
  assert.match(text, /erreur du modèle 0.6/);
  // 19 jours d'étendue sur 60 → 0,317, arrondi à 32 %.
  assert.match(text, /32 %/, 'la couverture partielle est énoncée');
});

test('Explication : une prévision sans franchissement le dit aussi', () => {
  const summary = summarizeWindow(prediction({ values: series(40, -0.1, 20) }), WINDOW);
  const text = describeAdjustment('humidité volumique du sol', summary, null);
  assert.match(text, /dans la plage favorable sur toute la période/);
  assert.doesNotMatch(text, /sous le minimum/);
});
