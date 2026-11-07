/**
 * Règles de surveillance des recommandations — fonctions pures.
 *
 * Ces tests couvrent la logique de décision sans base de données : comparaison
 * aux seuils, exploitation d'une prévision, dédoublonnage par épisode, délai de
 * re-notification, période restante, rédaction du message.
 *
 * Le flux complet (alerte réellement persistée, SMS réellement émis, ancienne
 * recommandation remplacée après acceptation) est prouvé contre PostgreSQL dans
 * `tests/e2e/alerts.e2e.test.mjs`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALERT_SOURCE_TYPES,
  RECIPIENT_ROLES,
  SENSOR_SILENCE_PARAMETER,
  buildAlertMessage,
  episodeKeyFor,
  evaluateAgainstThreshold,
  findPredictedBreach,
  isForecastUsable,
  parameterLabel,
  remainingPeriod,
  severityFor,
  shouldRenotify,
  silenceEpisodeKeyFor,
} from '../src/modules/alerts/alerts.service.js';
import { ELIMINATION_KEYS, RANGE_KEYS } from '../src/modules/recommendation/agronomicRanges.js';

/* ─────────────────── Constantes ─────────────────── */

test('Alertes : les trois sources sont déclarées et stables', () => {
  assert.deepEqual([...ALERT_SOURCE_TYPES], ['MEASUREMENT', 'FORECAST', 'SENSOR_SILENCE']);
  // Le pseudo-paramètre des capteurs muets ne doit pas ressembler à une grandeur
  // agronomique : il ne correspond à aucune mesure du sol.
  assert.equal(SENSOR_SILENCE_PARAMETER, 'sensorSilence');
  assert.ok(RECIPIENT_ROLES.includes('FARMER'), 'l’agriculteur doit être destinataire');
  assert.ok(RECIPIENT_ROLES.includes('AGRONOMIST'), 'l’agronome doit être destinataire');
});

/* ─────────────────── Comparaison aux seuils ─────────────────── */

test('Seuil : une valeur dans la plage ne déclenche rien', () => {
  const result = evaluateAgainstThreshold({ min: 5.5, max: 7, observed: 6.4 });
  assert.equal(result.breached, false);
  assert.equal(result.direction, null);
  assert.equal(result.deviation, null);
});

test('Seuil : un dépassement par le haut cite la borne et l’écart', () => {
  const result = evaluateAgainstThreshold({ min: 5.5, max: 7, observed: 8.2 });
  assert.equal(result.breached, true);
  assert.equal(result.direction, 'ABOVE');
  assert.equal(result.limit, 7);
  assert.equal(result.deviation, 1.2);
});

test('Seuil : un dépassement par le bas cite la borne et l’écart', () => {
  const result = evaluateAgainstThreshold({ min: 5.5, max: 7, observed: 4.1 });
  assert.equal(result.breached, true);
  assert.equal(result.direction, 'BELOW');
  assert.equal(result.limit, 5.5);
  assert.equal(result.deviation, 1.4);
});

test('Seuil : les bornes sont inclusives, pas strictes', () => {
  // Sur la borne exacte, la culture reste possible : alerter serait une fausse
  // alerte sur une valeur conforme.
  assert.equal(evaluateAgainstThreshold({ min: 5.5, max: 7, observed: 7 }).breached, false);
  assert.equal(evaluateAgainstThreshold({ min: 5.5, max: 7, observed: 5.5 }).breached, false);
});

test('Seuil : une borne absente n’est jamais remplacée par une limite inventée', () => {
  // La conductivité n'a qu'une borne basse définitionnelle : sans maximum
  // déclaré, aucune valeur ne peut être « trop haute ».
  assert.equal(evaluateAgainstThreshold({ min: 0, max: null, observed: 99 }).breached, false);
  assert.equal(evaluateAgainstThreshold({ min: null, max: 100, observed: -50 }).breached, false);
  // La borne présente continue de s'appliquer.
  assert.equal(evaluateAgainstThreshold({ min: 0, max: null, observed: -1 }).breached, true);
});

test('Seuil : une mesure absente ou non numérique ne déclenche rien', () => {
  for (const observed of [undefined, null, NaN, 'abc', {}]) {
    assert.equal(
      evaluateAgainstThreshold({ min: 5.5, max: 7, observed }).breached,
      false,
      `une valeur ${String(observed)} ne doit pas produire d'alerte`,
    );
  }
});

/* ─────────────────── Sévérité ─────────────────── */

test('Sévérité : fondée sur le caractère éliminatoire, pas sur un seuil inventé', () => {
  assert.ok(ELIMINATION_KEYS.includes('ec'), 'la salinité doit être éliminatoire');
  assert.equal(severityFor('ec', { breached: true }), 'CRITICAL');
  assert.equal(severityFor('ph', { breached: true }), 'WARNING');
  // Sans franchissement, aucune sévérité d'alerte.
  assert.equal(severityFor('ec', { breached: false }), 'INFO');
});

/* ─────────────────── Prévisions ─────────────────── */

test('Prévision : exploitable uniquement si elle bat la persistance (CDC phase 7)', () => {
  assert.equal(isForecastUsable({ beatsBaseline: true }), true);
  // Battue par la persistance : l'alerter produirait de fausses alertes.
  assert.equal(isForecastUsable({ beatsBaseline: false }), false);
  // Non évaluée : on ne présume pas qu'elle est meilleure.
  assert.equal(isForecastUsable({ beatsBaseline: null }), false);
  assert.equal(isForecastUsable({}), false);
  assert.equal(isForecastUsable(null), false);
});

test('Prévision : le premier franchissement à venir, pas le pire de la série', () => {
  // Série volontairement désordonnée : le tri par date fait partie de la règle.
  const values = [
    { at: '2026-11-05', value: 6 },
    { at: '2026-11-01', value: 7.8 },
    { at: '2026-11-09', value: 9.4 },
  ];
  const breach = findPredictedBreach({ values, min: 5.5, max: 7 });
  assert.equal(breach.at.toISOString().slice(0, 10), '2026-11-01');
  assert.equal(breach.value, 7.8);
  assert.equal(breach.direction, 'ABOVE');
});

test('Prévision : aucune série exploitable ne renvoie null, pas une valeur plausible', () => {
  assert.equal(findPredictedBreach({ values: [], min: 5.5, max: 7 }), null);
  assert.equal(findPredictedBreach({ values: null, min: 5.5, max: 7 }), null);
  assert.equal(findPredictedBreach({ values: undefined, min: 5.5, max: 7 }), null);
  // Série entièrement dans la plage.
  assert.equal(
    findPredictedBreach({ values: [{ at: '2026-11-01', value: 6.2 }], min: 5.5, max: 7 }),
    null,
  );
});

/* ─────────────────── Dédoublonnage par épisode ─────────────────── */

test('Épisode : une clé par paramètre et par recommandation suivie', () => {
  assert.equal(episodeKeyFor('ph', 'rec_01HXYZ'), 'ph:rec_01HXYZ');
  // Deux paramètres sur la même recommandation : deux épisodes distincts.
  assert.notEqual(episodeKeyFor('ph', 'rec_1'), episodeKeyFor('ec', 'rec_1'));
  // Le même paramètre sur deux recommandations : deux épisodes distincts.
  assert.notEqual(episodeKeyFor('ph', 'rec_1'), episodeKeyFor('ph', 'rec_2'));
});

test('Épisode : un capteur muet ne peut pas entrer en collision avec un paramètre réel', () => {
  assert.equal(silenceEpisodeKeyFor('dev_1'), 'sensorSilence:dev_1');
  assert.notEqual(silenceEpisodeKeyFor('dev_1'), silenceEpisodeKeyFor('dev_2'));
  /**
   * La garantie réelle : `sensorSilence` n'appartient pas au vocabulaire des
   * plages agronomiques, donc aucun seuil ne porte ce nom et aucune alerte de
   * mesure ne peut produire cette clé. Sans cela, un capteur muet et un
   * franchissement partageraient un épisode et s'écraseraient.
   */
  assert.ok(
    !Object.values(RANGE_KEYS).includes(SENSOR_SILENCE_PARAMETER),
    'sensorSilence ne doit pas être une grandeur agronomique',
  );
});

/* ─────────────────── Re-notification ─────────────────── */

const NOW = new Date('2026-10-22T12:00:00Z');

test('Re-notification : la première alerte part immédiatement', () => {
  assert.equal(shouldRenotify({ lastNotifiedAt: null, now: NOW, renotifyHours: 24 }), true);
});

test('Re-notification : rappel seulement après le délai écoulé', () => {
  assert.equal(
    shouldRenotify({ lastNotifiedAt: '2026-10-21T11:00:00Z', now: NOW, renotifyHours: 24 }),
    true,
    '25 h écoulées : le rappel est dû',
  );
  assert.equal(
    shouldRenotify({ lastNotifiedAt: '2026-10-22T10:00:00Z', now: NOW, renotifyHours: 24 }),
    false,
    '2 h écoulées : trop tôt',
  );
  // Limite exacte : le délai est atteint, le rappel part.
  assert.equal(
    shouldRenotify({ lastNotifiedAt: '2026-10-21T12:00:00Z', now: NOW, renotifyHours: 24 }),
    true,
  );
});

test('Re-notification : un délai nul ou invalide coupe la relance', () => {
  const old = '2020-01-01T00:00:00Z';
  assert.equal(shouldRenotify({ lastNotifiedAt: old, now: NOW, renotifyHours: 0 }), false);
  assert.equal(shouldRenotify({ lastNotifiedAt: old, now: NOW, renotifyHours: -5 }), false);
  assert.equal(shouldRenotify({ lastNotifiedAt: old, now: NOW, renotifyHours: null }), false);
  assert.equal(shouldRenotify({ lastNotifiedAt: old, now: NOW, renotifyHours: 'abc' }), false);
  // Mais la toute première notification part quand même.
  assert.equal(shouldRenotify({ lastNotifiedAt: null, now: NOW, renotifyHours: 0 }), true);
});

/* ─────────────────── Période restante ─────────────────── */

test('Période restante : recalculée du jour de l’alerte jusqu’à la fin prévue', () => {
  const remaining = remainingPeriod({ periodEnd: '2026-11-20T00:00:00Z', now: NOW });
  assert.equal(remaining.periodStart.toISOString(), NOW.toISOString());
  assert.equal(remaining.periodEnd.toISOString(), '2026-11-20T00:00:00.000Z');
  assert.equal(remaining.days, 29);
});

test('Période restante : une période écoulée ne produit pas de proposition', () => {
  assert.equal(remainingPeriod({ periodEnd: '2026-10-01T00:00:00Z', now: NOW }), null);
  // Fin exactement maintenant : il ne reste rien à semer.
  assert.equal(remainingPeriod({ periodEnd: NOW.toISOString(), now: NOW }), null);
});

test('Période restante : au moins un jour, jamais zéro', () => {
  const remaining = remainingPeriod({ periodEnd: '2026-10-22T18:00:00Z', now: NOW });
  assert.equal(remaining.days, 1);
});

/* ─────────────────── Message ─────────────────── */

test('Message : un franchissement constaté cite la valeur, la plage et la parcelle', () => {
  const { title, body } = buildAlertMessage({
    sourceType: 'MEASUREMENT',
    parameter: 'ph',
    plotName: 'Parcelle Mbandaka',
    observed: 8.2,
    unit: 'pH',
    min: 5.5,
    max: 7,
    threshold: { derivedFrom: 'mais' },
  });
  assert.match(title, /Seuil dépassé/);
  assert.match(title, /pH du sol/, 'le titre nomme la grandeur en français');
  assert.match(body, /Parcelle Mbandaka/);
  assert.match(body, /8,2 pH/, 'la valeur observée figure en toutes lettres');
  // Plus entre crochets : `[` et `]` sont au jeu **étendu** GSM, donc comptés
  // double. La plage est écrite « 5,5 à 7 ».
  assert.match(body, /5,5 à 7/, 'la plage attendue figure');
  assert.match(body, /mais/, 'la culture de référence est citée');
  /**
   * Le SMS est le canal principal : il doit tenir dans **un segment**, pas deux.
   *
   * La borne était 320 — soit deux segments, donc le double du coût. Elle est
   * ramenée à 160, la capacité d'un segment GSM-7. `tests/alertMessageGsm.test.mjs`
   * vérifie en plus l'encodage, car un message de 100 caractères en UCS-2 ne
   * tient pas dans un segment non plus.
   */
  assert.ok(body.length <= 160, `message trop long pour un segment GSM-7 (${body.length})`);
});

test('Message : une prévision est annoncée comme telle, avec sa date', () => {
  const { title, body } = buildAlertMessage({
    sourceType: 'FORECAST',
    parameter: 'moisture',
    plotName: 'Parcelle Mbandaka',
    observed: 12,
    unit: '%',
    min: 20,
    max: 60,
    predictedBreachAt: '2026-11-05T00:00:00Z',
  });
  assert.match(title, /Prévision défavorable/);
  assert.match(title, /humidité volumique du sol/);
  assert.match(body, /sortira de/, 'le franchissement à venir est annoncé');
  assert.match(body, /05\/11\/2026/);
  // Raccourci pour tenir dans un segment : « Prévision vérifiée meilleure que la
  // persistance » faisait déborder le message sur quatre segments en UCS-2.
  assert.match(body, /Batt la persistance/, 'la preuve de qualité est rappelée');
});

test('Message : un capteur muet donne le silence constaté et le seuil', () => {
  const { title, body } = buildAlertMessage({
    sourceType: 'SENSOR_SILENCE',
    parameter: SENSOR_SILENCE_PARAMETER,
    deviceLabel: 'Sonde pH nord',
    silenceHours: 31.5,
    silenceThresholdHours: 24,
  });
  assert.match(title, /Capteur silencieux/);
  assert.match(body, /Sonde pH nord/);
  assert.match(body, /31,5 h/);
  assert.match(body, /24 h/);
  assert.match(body, /Aucune mesure inventée/i, 'rien n’est inventé pendant le silence');
});

test('Message : une donnée simulée est étiquetée, jamais présentée comme réelle', () => {
  const { title, body } = buildAlertMessage({
    sourceType: 'MEASUREMENT',
    parameter: 'ph',
    plotName: 'Parcelle test',
    observed: 8.2,
    unit: 'pH',
    min: 5.5,
    max: 7,
    simulated: true,
  });
  assert.match(title, /^\[SIMULÉ\]/);
  assert.match(body, /^\[SIMULÉ\]/);

  const real = buildAlertMessage({
    sourceType: 'MEASUREMENT',
    parameter: 'ph',
    plotName: 'Parcelle test',
    observed: 8.2,
    unit: 'pH',
    min: 5.5,
    max: 7,
  });
  assert.doesNotMatch(real.title, /SIMULÉ/);
  assert.doesNotMatch(real.body, /SIMULÉ/);
});

test('Message : les libellés sont en français, jamais des noms de champs', () => {
  assert.equal(parameterLabel('ph'), 'pH du sol');
  assert.equal(parameterLabel('moisture'), 'humidité volumique du sol');
  assert.equal(parameterLabel('ec'), 'salinité du sol (conductivité électrique)');
  assert.equal(parameterLabel('airTemperatureC'), 'température de l’air');
  assert.equal(parameterLabel(SENSOR_SILENCE_PARAMETER), 'capteur silencieux');
  // Clé inconnue : repli sur la clé plutôt qu'un libellé vide.
  assert.equal(parameterLabel('inconnu'), 'inconnu');
});
