import test from 'node:test';
import assert from 'node:assert/strict';

import {
  adequacyScore,
  hasToleratedBounds,
  RANGE_UNITS,
} from '../src/modules/recommendation/agronomicRanges.js';
import {
  COMBINATION_RULES,
  DEFAULT_ENGINE_VERSION,
  ENGINE_VERSIONS,
  SCORING_MODELS,
  combineScores,
  describeEngine,
  resolveEngineVersion,
} from '../src/modules/recommendation/engineVersions.js';
import { scoreCrop } from '../src/modules/recommendation/recommendation.service.js';

/**
 * Score d'adéquation gradué sur quatre limites — étape D.
 *
 * Tests **unitaires purs** : ni base, ni Prisma, ni HTTP. Toutes les valeurs
 * utilisées sont **fictives** (tolérée 4,5 · idéale 5,5–7,0 · tolérée 8,0) :
 * elles servent à vérifier une fonction, pas à documenter une agronomie.
 */

/* ─────────────────────── Valeurs de référence ─────────────────────── */

/** Plage fictive à quatre limites. */
const FOUR = Object.freeze({
  min: 5.5,
  max: 7.0,
  toleratedMin: 4.5,
  toleratedMax: 8.0,
});

test('Adéquation : 6,0 dans la plage idéale vaut 1', () => {
  assert.equal(adequacyScore(FOUR, 6.0).score, 1);
  assert.equal(adequacyScore(FOUR, 6.0).met, true);
  assert.equal(adequacyScore(FOUR, 6.0).mode, 'GRADED');
});

test('Adéquation : les deux bornes idéales valent 1', () => {
  assert.equal(adequacyScore(FOUR, 5.5).score, 1);
  assert.equal(adequacyScore(FOUR, 7.0).score, 1);
});

test('Adéquation : 5,0 vaut 0,5 — à mi-chemin entre l’idéal et le toléré', () => {
  // (5,0 − 4,5) / (5,5 − 4,5) = 0,5
  assert.equal(adequacyScore(FOUR, 5.0).score, 0.5);
  assert.equal(adequacyScore(FOUR, 5.0).met, false);
});

test('Adéquation : 7,5 vaut 0,5 de l’autre côté', () => {
  // (8,0 − 7,5) / (8,0 − 7,0) = 0,5
  assert.equal(adequacyScore(FOUR, 7.5).score, 0.5);
  assert.equal(adequacyScore(FOUR, 7.5).met, false);
});

test('Adéquation : 4,5 et 8,0 — les limites tolérées — valent 0', () => {
  assert.equal(adequacyScore(FOUR, 4.5).score, 0);
  assert.equal(adequacyScore(FOUR, 8.0).score, 0);
});

test('Adéquation : au-delà des limites tolérées, le score reste à 0', () => {
  assert.equal(adequacyScore(FOUR, 3.0).score, 0);
  assert.equal(adequacyScore(FOUR, 9.5).score, 0);
  assert.equal(adequacyScore(FOUR, -50).score, 0);
  assert.equal(adequacyScore(FOUR, 500).score, 0);
});

test('Adéquation : la décroissance est bien linéaire', () => {
  // Un quart, la moitié, les trois quarts de la bande basse.
  assert.equal(adequacyScore(FOUR, 4.75).score, 0.25);
  assert.equal(adequacyScore(FOUR, 5.0).score, 0.5);
  assert.equal(adequacyScore(FOUR, 5.25).score, 0.75);
  // Même chose côté haut.
  assert.equal(adequacyScore(FOUR, 7.75).score, 0.25);
  assert.equal(adequacyScore(FOUR, 7.25).score, 0.75);
});

test('Adéquation : le score reste toujours dans [0 ; 1]', () => {
  for (let value = -10; value <= 20; value += 0.25) {
    const { score } = adequacyScore(FOUR, value);
    assert.ok(score >= 0 && score <= 1, `score ${score} hors [0;1] pour ${value}`);
  }
});

test('Adéquation : une valeur non numérique ne donne pas de score', () => {
  assert.equal(adequacyScore(FOUR, null), null);
  assert.equal(adequacyScore(FOUR, undefined), null);
  assert.equal(adequacyScore(FOUR, NaN), null);
  assert.equal(adequacyScore(FOUR, '6'), null);
  assert.equal(adequacyScore(null, 6), null);
});

/* ─────────────────────── Plage incomplète ─────────────────────── */

test('Plage incomplète : une seule borne tolérée retombe sur le verdict binaire', () => {
  const lowOnly = { ...FOUR, toleratedMax: null };
  const highOnly = { ...FOUR, toleratedMin: null };

  assert.equal(hasToleratedBounds(lowOnly), false);
  assert.equal(hasToleratedBounds(highOnly), false);

  // Aucune limite n'est inventée : dans la plage idéale → 1, hors plage → 0.
  assert.deepEqual(adequacyScore(lowOnly, 6.0), { mode: 'BINARY', score: 1, met: true });
  assert.deepEqual(adequacyScore(lowOnly, 5.0), { mode: 'BINARY', score: 0, met: false });
  assert.deepEqual(adequacyScore(highOnly, 6.0), { mode: 'BINARY', score: 1, met: true });
  assert.deepEqual(adequacyScore(highOnly, 7.5), { mode: 'BINARY', score: 0, met: false });
});

test('Plage incomplète : sans aucune borne tolérée, comportement binaire inchangé', () => {
  const plain = { min: 5.5, max: 7.0, toleratedMin: null, toleratedMax: null };
  assert.equal(hasToleratedBounds(plain), false);
  assert.equal(adequacyScore(plain, 6.0).score, 1);
  assert.equal(adequacyScore(plain, 6.0).mode, 'BINARY');
  // Une valeur très proche de la plage idéale vaut quand même 0 : sans borne
  // tolérée, le moteur ne gradue pas.
  assert.equal(adequacyScore(plain, 7.0001).score, 0);
});

test('Plage dégénérée : une bande tolérée de largeur nulle ne divise pas par zéro', () => {
  // toléré min == idéal min : toute valeur sous l'idéal est déjà hors tolérance.
  const degenerate = { ...FOUR, toleratedMin: 5.5 };
  assert.equal(adequacyScore(degenerate, 5.4).score, 0);
  assert.ok(Number.isFinite(adequacyScore(degenerate, 5.4).score), 'pas d’Infinity');
  assert.equal(adequacyScore(degenerate, 6.0).score, 1);

  const degenerateHigh = { ...FOUR, toleratedMax: 7.0 };
  assert.equal(adequacyScore(degenerateHigh, 7.1).score, 0);
  assert.ok(Number.isFinite(adequacyScore(degenerateHigh, 7.1).score));
});

/* ─────────────────────── Règles de combinaison ─────────────────────── */

test('Combinaison : le facteur le plus limitant retient le minimum', () => {
  const rule = COMBINATION_RULES.MOST_LIMITING;
  assert.equal(rule.combine([1, 0.5, 0.8]), 0.5);
  assert.equal(rule.combine([1, 1, 1]), 1);
  assert.equal(rule.combine([1, 0]), 0);
});

test('Combinaison : la moyenne reste disponible (règle 1.0)', () => {
  const rule = COMBINATION_RULES.MEAN_SATISFIED;
  assert.equal(rule.combine([1, 0.5, 0.8]), (1 + 0.5 + 0.8) / 3);
  assert.equal(rule.combine([1, 0]), 0.5);
});

test('Combinaison : rien d’évaluable donne null, pas 0', () => {
  // « Rien d'évaluable » et « tout est défavorable » sont deux affirmations
  // différentes : la seconde serait fausse s'il n'y a rien à évaluer.
  for (const rule of Object.values(COMBINATION_RULES)) {
    assert.equal(rule.combine([]), null);
    assert.equal(rule.combine([null, undefined, NaN]), null);
  }
});

test('Combinaison : les deux règles sont reproductibles', () => {
  const scores = [1, 0.5, 0.25, 0.75];
  for (const rule of Object.values(COMBINATION_RULES)) {
    const first = combineScores(scores, { combinationRule: rule.id });
    const second = combineScores(scores, { combinationRule: rule.id });
    assert.equal(first, second, `${rule.id} n'est pas déterministe`);
  }
  // Et elles diffèrent bien l'une de l'autre sur ce jeu de scores.
  assert.equal(combineScores(scores, ENGINE_VERSIONS['2.0']), 0.25);
  assert.equal(combineScores(scores, ENGINE_VERSIONS['1.0']), 0.625);
});

test('Combinaison : une règle inconnue est refusée', () => {
  assert.throws(
    () => combineScores([1], { combinationRule: 'INVENTEE' }),
    /Règle de combinaison inconnue/,
  );
});

/* ─────────────────────── Versions du moteur ─────────────────────── */

test('Versions : deux versions coexistent, avec des règles différentes', () => {
  assert.equal(ENGINE_VERSIONS['1.0'].combinationRule, 'MEAN_SATISFIED');
  assert.equal(ENGINE_VERSIONS['1.0'].scoring, 'BINARY_SATISFIED');
  assert.equal(ENGINE_VERSIONS['2.0'].combinationRule, 'MOST_LIMITING');
  assert.equal(ENGINE_VERSIONS['2.0'].scoring, 'GRADED_FOUR_LIMITS');
});

test('Versions : chaque règle et chaque modèle cités existent bien', () => {
  for (const engine of Object.values(ENGINE_VERSIONS)) {
    assert.ok(COMBINATION_RULES[engine.combinationRule], `règle ${engine.combinationRule} absente`);
    assert.ok(SCORING_MODELS[engine.scoring], `modèle ${engine.scoring} absent`);
    assert.equal(typeof engine.combinationRule, 'string');
  }
});

test('Versions : la règle par défaut est le facteur le plus limitant', () => {
  assert.equal(DEFAULT_ENGINE_VERSION, '2.0');
  assert.equal(resolveEngineVersion().combinationRule, 'MOST_LIMITING');
});

test('Versions : une version inconnue est refusée, pas remplacée', () => {
  // Produire un score sous une règle non demandée serait tromper sur le calcul.
  assert.throws(() => resolveEngineVersion('9.9'), /Version de moteur inconnue/);
  assert.throws(() => resolveEngineVersion('9.9'), (error) => error.status === 422);
});

test('Versions : chaque résultat indique sa version et sa règle', () => {
  const described = describeEngine(ENGINE_VERSIONS['2.0']);
  assert.equal(described.engineVersion, '2.0');
  assert.equal(described.combinationRule, 'MOST_LIMITING');
  assert.equal(described.combinationRuleLabel, 'Facteur le plus limitant');
  assert.equal(described.scoringModel, 'GRADED_FOUR_LIMITS');
  assert.match(described.combinationRuleDescription, /minimum/);
});

/* ─────────────────────── Moteur complet ─────────────────────── */

const makeRange = (key, min, max, status = 'VALIDATED', extra = {}) => ({
  key,
  min,
  max,
  toleratedMin: null,
  toleratedMax: null,
  unit: RANGE_UNITS[key],
  status,
  sourceReference: 'Source de test',
  sourceNote: null,
  ...extra,
});

const CROP = { cropSlug: 'exemple', label: 'Culture d’exemple', cycleDays: 120 };
const refOf = (ranges) => ({ cropSlug: 'exemple', ranges });
const measured = (value, unit) => ({ value, unit, source: 'measured_lab', confidence: 'high' });

test('Moteur : un paramètre manquant n’est pas noté, il est signalé', () => {
  const ranges = {
    ph: makeRange('ph', 5.5, 7.0, 'VALIDATED', { toleratedMin: 4.5, toleratedMax: 8.0 }),
    ec: makeRange('ec', 0, 1.2),
  };
  // Seule la mesure de pH existe : la salinité n'est pas inventée.
  const scored = scoreCrop(CROP, refOf(ranges), { ph: measured(6.0, 'pH') });

  assert.equal(scored.criteria.length, 1);
  assert.equal(scored.score, 1, 'le seul critère évaluable est dans la plage idéale');
  const missing = scored.notEvaluated.find((entry) => entry.key === 'ec');
  assert.ok(missing, 'la salinité doit être signalée comme non évaluée');
  assert.equal(missing.cause, 'NO_MEASUREMENT');
});

test('Moteur : une plage sans référentiel n’est pas devinée', () => {
  // Aucune plage pour la salinité : le critère sort du calcul.
  const ranges = { ph: makeRange('ph', 5.5, 7.0, 'VALIDATED', { toleratedMin: 4.5, toleratedMax: 8.0 }) };
  const scored = scoreCrop(CROP, refOf(ranges), {
    ph: measured(6.0, 'pH'),
    ec: measured(5, 'dS/m'),
  });

  assert.equal(scored.criteria.length, 1);
  assert.equal(scored.notEvaluated.some((entry) => entry.cause === 'NO_REFERENCE'), false,
    'aucune plage de salinité n’existe : rien à signaler comme référentiel manquant');
});

test('Moteur : rien d’évaluable ne produit aucun score', () => {
  const scored = scoreCrop(CROP, refOf({ ph: makeRange('ph', 5.5, 7.0) }), {});
  assert.equal(scored.score, null, 'aucun score ne doit être inventé');
  assert.equal(scored.usable, false);
});

test('Moteur : le score gradué suit le facteur le plus limitant', () => {
  const ranges = {
    ph: makeRange('ph', 5.5, 7.0, 'VALIDATED', { toleratedMin: 4.5, toleratedMax: 8.0 }),
    ec: makeRange('ec', 0, 1.2, 'VALIDATED', { toleratedMin: 0, toleratedMax: 2.4 }),
  };

  // pH 6,0 → 1 ; EC 0,6 → dans l'idéal → 1.
  const bothGood = scoreCrop(CROP, refOf(ranges), {
    ph: measured(6.0, 'pH'),
    ec: measured(0.6, 'dS/m'),
  });
  assert.equal(bothGood.score, 1);

  // pH 5,0 → 0,5 ; EC 0,6 → 1 (dans l'idéal, donc pas éliminatoire).
  // Le minimum retient 0,5.
  const onePartial = scoreCrop(CROP, refOf(ranges), {
    ph: measured(5.0, 'pH'),
    ec: measured(0.6, 'dS/m'),
  });
  assert.equal(onePartial.score, 0.5, 'le facteur le plus limitant décide');
  assert.equal(onePartial.criteria.find((c) => c.key === 'ph').adequacy, 0.5);
  assert.equal(onePartial.criteria.find((c) => c.key === 'ph').scoringMode, 'GRADED');
});

test('Moteur : deux versions sur les mêmes données donnent des résultats reproductibles', () => {
  // La salinité est évitée ici : c'est un critère éliminatoire, et une culture
  // écartée n'a pas de score — ce n'est pas l'objet de ce test.
  const ranges = {
    ph: makeRange('ph', 5.5, 7.0, 'VALIDATED', { toleratedMin: 4.5, toleratedMax: 8.0 }),
    depthCm: makeRange('depthCm', 20, 60, 'VALIDATED', { toleratedMin: 10, toleratedMax: 90 }),
  };
  const state = { ph: measured(5.25, 'pH'), depthCm: measured(30, 'cm') };

  const v2a = scoreCrop(CROP, refOf(ranges), state, {}, resolveEngineVersion('2.0'));
  const v2b = scoreCrop(CROP, refOf(ranges), state, {}, resolveEngineVersion('2.0'));
  const v1 = scoreCrop(CROP, refOf(ranges), state, {}, resolveEngineVersion('1.0'));

  // Reproductible d'une exécution à l'autre, à version fixée.
  assert.equal(v2a.score, v2b.score);
  assert.equal(v2a.engineVersion, '2.0');
  assert.equal(v2a.combinationRule, 'MOST_LIMITING');
  assert.equal(v1.engineVersion, '1.0');
  assert.equal(v1.combinationRule, 'MEAN_SATISFIED');

  // pH 5,25 → (5,25 − 4,5) / (5,5 − 4,5) = 0,75 gradué ; profondeur 30 → 1.
  // 2.0 retient le minimum : 0,75.
  assert.equal(v2a.score, 0.75);
  assert.equal(v2a.criteria.find((c) => c.key === 'ph').scoringMode, 'GRADED');

  // 1.0 note en binaire : pH hors plage idéale → 0, profondeur dedans → 1,
  // puis fait la moyenne : 0,5. Le même état mesuré, deux lectures.
  assert.equal(v1.score, 0.5);
  assert.equal(v1.criteria.find((c) => c.key === 'ph').scoringMode, 'BINARY');
  assert.equal(v1.criteria.find((c) => c.key === 'ph').adequacy, 0);
  assert.equal(v2a.criteria.find((c) => c.key === 'ph').adequacy, 0.75);
});

test('Moteur : l’élimination sur salinité mesurée reste inchangée', () => {
  // La salinité est un critère dur : au-dessus de la plage idéale mesurée, la
  // culture est écartée — même si le score gradué serait encore positif.
  const ranges = {
    ec: makeRange('ec', 0, 1.2, 'VALIDATED', { toleratedMin: 0, toleratedMax: 2.4 }),
  };
  const scored = scoreCrop(CROP, refOf(ranges), { ec: measured(2.0, 'dS/m') });

  assert.ok(scored.eliminated, 'la culture doit être écartée');
  assert.equal(scored.eliminated.key, 'ec');
  assert.equal(scored.score, null, 'une culture éliminée n’a pas de score');
  assert.equal(scored.usable, false);
  // Le score gradué aurait été positif : c'est précisément pourquoi
  // l'élimination ne doit pas dépendre du score.
  assert.ok(adequacyScore(ranges.ec, 2.0).score > 0);
});

test('Moteur : une plage PROVISIONAL ne change pas le score mais reste signalée', () => {
  const provisional = makeRange('ph', 5.5, 7.0, 'PROVISIONAL', { toleratedMin: 4.5, toleratedMax: 8.0 });
  const validated = makeRange('ph', 5.5, 7.0, 'VALIDATED', { toleratedMin: 4.5, toleratedMax: 8.0 });

  const a = scoreCrop(CROP, refOf({ ph: provisional }), { ph: measured(6.0, 'pH') });
  const b = scoreCrop(CROP, refOf({ ph: validated }), { ph: measured(6.0, 'pH') });

  assert.equal(a.score, b.score, 'le statut ne modifie pas le calcul');
  assert.equal(a.criteria[0].rangeStatus, 'PROVISIONAL', 'mais il reste visible sur le critère');
});
