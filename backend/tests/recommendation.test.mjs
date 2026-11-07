import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CROP_CALENDARS,
  SUPPORTED_PROVINCES,
  cropsPlantableInMonths,
  isCalendarValidated,
  resolveCalendar,
} from '../src/modules/recommendation/cropCalendars.js';
import { SOIL_PARAMETER_KEYS } from '../src/modules/soil/soil.schema.js';
import {
  ELIMINATION_KEYS,
  PHYSICAL_BOUNDS,
  RANGE_KEYS,
  RANGE_LABELS,
  RANGE_UNITS,
  hasProvisionalRange,
  isRangeUsable,
  toRange,
} from '../src/modules/recommendation/agronomicRanges.js';
import {
  AIR_VS_SOIL_CAVEAT,
  MAX_PERIOD_DAYS,
  MIN_EVALUATED_CRITERIA,
  scoreCrop,
} from '../src/modules/recommendation/recommendation.service.js';
import {
  CLOUD_COVER_REJECT_PCT,
  PRIMARY_MOISTURE_SOURCE,
  SUBSURFACE_CAVEAT,
  resolveMoistureSource,
} from '../src/config/satellite.js';

/**
 * Moteur de recommandation culturale — RDC (Équateur, Bandundu).
 *
 * Le référentiel agronomique vit en base (`CropAgronomicRange`), pas dans le
 * code : aucune fourchette n'est codée en dur ici non plus, chacune est
 * construite explicitement dans le test qui s'en sert.
 *
 * Ce qui est vérifié, ce sont les règles qui empêchent le moteur de mentir :
 * une plage sans provenance est refusée à l'écriture, une plage hors bornes
 * physiques aussi, une validation exige un validateur nommé et une source
 * citable, un calendrier provisoire rend la sortie « indicative », un critère
 * éliminatoire non mesurable n'élimine pas, et une scène optique trop nuageuse
 * est refusée au profit du radar.
 */

/* ─────────────────────── Calendriers provinciaux ─────────────────────── */

test('Calendriers : les deux provinces de déploiement sont couvertes', () => {
  assert.deepEqual([...SUPPORTED_PROVINCES], ['Equateur', 'Bandundu']);
  for (const province of SUPPORTED_PROVINCES) {
    const calendar = CROP_CALENDARS[province];
    assert.ok(calendar, `calendrier manquant pour ${province}`);
    // Le libellé affiche l'accent ; la clé d'index, non.
    assert.equal(Object.keys(calendar.crops).length > 0, true, `${province} sans culture`);
  }
});

test('Calendriers : la résolution ignore accents et casse', () => {
  for (const spelling of ['Équateur', 'equateur', 'EQUATEUR', ' Équateur ']) {
    const calendar = resolveCalendar(spelling);
    assert.equal(calendar?.province, 'Équateur', `échec pour « ${spelling} »`);
  }
  assert.equal(resolveCalendar('Nord-Kivu'), null);
  assert.equal(resolveCalendar(undefined), null);
});

test('Calendriers : chaque culture a au moins une fenêtre de semis cohérente', () => {
  for (const [provinceKey, calendar] of Object.entries(CROP_CALENDARS)) {
    assert.ok(['PROVISIONAL', 'VALIDATED'].includes(calendar.status), provinceKey);
    for (const [slug, crop] of Object.entries(calendar.crops)) {
      assert.equal(crop.cropSlug, slug, `${provinceKey}/${slug} : identifiant incohérent`);
      assert.ok(crop.label, `${slug} sans libellé`);
      assert.ok(Array.isArray(crop.windows) && crop.windows.length > 0, `${slug} sans fenêtre`);
      for (const window of crop.windows) {
        assert.ok(
          Number.isInteger(window.sowingStartMonth) && window.sowingStartMonth >= 1 && window.sowingStartMonth <= 12,
          `${slug} : mois de début invalide`,
        );
        assert.ok(
          Number.isInteger(window.sowingEndMonth) && window.sowingEndMonth >= 1 && window.sowingEndMonth <= 12,
          `${slug} : mois de fin invalide`,
        );
      }
    }
  }
});

test('Calendriers : un calendrier provisoire est explicitement non validé', () => {
  for (const calendar of Object.values(CROP_CALENDARS)) {
    // Ni agronome validateur ni source citable : ils ne peuvent donc pas être
    // présentés comme validés.
    assert.equal(calendar.status, 'PROVISIONAL');
    assert.equal(calendar.validatedBy, null);
    assert.equal(calendar.source.reference, null);
    assert.equal(isCalendarValidated(calendar), false);
  }
  assert.equal(
    isCalendarValidated({ status: 'VALIDATED', validatedBy: 'Dr. X', source: { reference: 'ITA 2019' } }),
    true,
  );
});

/** Calendrier minimal, pour tester la logique de fenêtre indépendamment des données. */
const calendarWith = (windows) => ({
  province: 'Test',
  status: 'PROVISIONAL',
  crops: { test: { cropSlug: 'test', label: 'Culture test', windows } },
});

test('Calendriers : l’intervalle de semis est circulaire sur l’année', () => {
  const narrow = calendarWith([{ sowingStartMonth: 1, sowingEndMonth: 3 }]);
  assert.equal(cropsPlantableInMonths(narrow, 2, 2).length, 1);
  assert.equal(cropsPlantableInMonths(narrow, 5, 5).length, 0);

  // Cas qui chevauche le 31 décembre : novembre → février.
  const spanning = calendarWith([{ sowingStartMonth: 11, sowingEndMonth: 2 }]);
  assert.equal(cropsPlantableInMonths(spanning, 12, 12).length, 1, 'décembre doit être semable');
  assert.equal(cropsPlantableInMonths(spanning, 1, 1).length, 1, 'janvier doit être semable');
  assert.equal(cropsPlantableInMonths(spanning, 6, 6).length, 0);
});

test('Calendriers : la période demandée sélectionne la bonne fenêtre', () => {
  const calendar = CROP_CALENDARS.Equateur;
  const septembre = cropsPlantableInMonths(calendar, 9, 10);
  assert.ok(septembre.length > 0, 'aucune culture semable en septembre–octobre');
  // Chaque culture retenue expose la fenêtre qui a motivé son inclusion :
  // c'est ce qui rend le choix explicable.
  for (const crop of septembre) {
    assert.ok(crop.matchedWindow, `${crop.cropSlug} sans fenêtre appariée`);
    assert.ok(crop.matchedWindow.label, `${crop.cropSlug} sans libellé de fenêtre`);
  }
});

/* ───────────────────── Référentiel : règles d'usage ───────────────────── */

/** Construit une plage telle que la renverrait la base, après `toRange`. */
const makeRange = (key, min, max, status = 'PROVISIONAL', extra = {}) => ({
  key,
  min,
  max,
  unit: RANGE_UNITS[key],
  status,
  sourceReference: null,
  sourceNote: null,
  ...extra,
});

/** Référence d'une culture, sous la forme produite par `rangesForCrops`. */
const refOf = (cropSlug, ranges) => ({ cropSlug, ranges });

const cropEntry = (cropSlug = 'mais', label = 'Maïs') => ({ cropSlug, label, cycleDays: 120 });

test('Référentiel : une plage incomplète n’est jamais utilisable', () => {
  assert.equal(isRangeUsable(null), false);
  assert.equal(isRangeUsable(undefined), false);
  // Bornes manquantes — le cas d'une plage jamais renseignée.
  assert.equal(isRangeUsable({ min: null, max: null, status: 'PROVISIONAL' }), false);
  assert.equal(isRangeUsable({ min: 5, max: null, status: 'PROVISIONAL' }), false);
  // Bornes inversées.
  assert.equal(isRangeUsable({ min: 8, max: 5, status: 'PROVISIONAL' }), false);
  // Statut absent.
  assert.equal(isRangeUsable({ min: 5, max: 7 }), false);
  // Plage retirée du référentiel.
  assert.equal(isRangeUsable({ min: 5, max: 7, status: 'RETIRED' }), false);
  // Plage complète.
  assert.equal(isRangeUsable({ min: 5, max: 7, status: 'VALIDATED' }), true);
  assert.equal(isRangeUsable({ min: 5, max: 7, status: 'PROVISIONAL' }), true);
});

test('Référentiel : `toRange` normalise une ligne de base', () => {
  const normalized = toRange({
    parameterKey: 'ph',
    minValue: 5.5,
    maxValue: 7,
    unit: 'pH',
    status: 'VALIDATED',
    sourceReference: 'Référentiel agronomique de test — Zea mays',
    sourceNote: null,
    validatedBy: 'Dr. Mukendi',
    validatedAt: new Date('2026-10-01'),
  });
  assert.equal(normalized.key, 'ph');
  assert.equal(normalized.min, 5.5);
  assert.equal(normalized.max, 7);
  assert.equal(normalized.status, 'VALIDATED');
  assert.equal(normalized.sourceReference, 'Référentiel agronomique de test — Zea mays');
  assert.equal(normalized.validatedBy, 'Dr. Mukendi');
  assert.equal(toRange(null), null);
});

test('Référentiel : une plage provisoire suffit à rendre la sortie indicative', () => {
  assert.equal(hasProvisionalRange({ ph: makeRange('ph', 5, 7, 'VALIDATED') }), false);
  assert.equal(hasProvisionalRange({ ph: makeRange('ph', 5, 7, 'PROVISIONAL') }), true);
  // Mélange : une seule provisoire suffit.
  assert.equal(
    hasProvisionalRange({
      ph: makeRange('ph', 5, 7, 'VALIDATED'),
      ec: makeRange('ec', 0, 4, 'PROVISIONAL'),
    }),
    true,
  );
  // Une plage inutilisable n’entre pas dans le calcul.
  assert.equal(hasProvisionalRange({ ph: null }), false);
  assert.equal(hasProvisionalRange({}), false);
});

test('Référentiel : la salinité est le seul critère éliminatoire', () => {
  assert.deepEqual([...ELIMINATION_KEYS], [RANGE_KEYS.SALINITY]);
});

test('Référentiel : chaque paramètre a une unité et des bornes physiques', () => {
  for (const key of Object.values(RANGE_KEYS)) {
    assert.ok(RANGE_UNITS[key], `unité manquante pour ${key}`);
    const bounds = PHYSICAL_BOUNDS[key];
    assert.ok(bounds, `bornes physiques manquantes pour ${key}`);
    assert.ok(bounds.min < bounds.max, key);
  }
  // Le pH ne peut pas sortir de 0–14 : c’est ce qui rejette un import corrompu.
  assert.deepEqual(PHYSICAL_BOUNDS[RANGE_KEYS.PH], { min: 0, max: 14 });
});

test('Référentiel : la température d’un référentiel générique est celle de l’air, pas du sol', () => {
  // La clé est nommée explicitement `airTemperatureC` : une fourchette de
  // température issue d’un référentiel générique porte
  // sur la température de l’air. Les confondre fausserait tout le classement.
  assert.equal(RANGE_KEYS.AIR_TEMPERATURE, 'airTemperatureC');
  assert.equal(RANGE_UNITS[RANGE_KEYS.AIR_TEMPERATURE], '°C');
});

/* ─────────────────── Notation (moteur, sans base) ─────────────────── */

test('Notation : aucun critère évaluable ⇒ non classable, jamais un faux score', () => {
  // Cas d'un référentiel vide en base : aucune plage.
  const result = scoreCrop(
    cropEntry(),
    refOf('mais', {}),
    { ph: { value: 6.4, unit: 'pH', source: 'measured_lab', confidence: 'high' } },
  );
  assert.equal(result.usable, false);
  assert.equal(result.score, null, 'aucun score ne doit être produit');
  assert.equal(result.coverage, 0);
  assert.equal(result.evaluatedCount, 0);
  assert.equal(result.criteria.length, 0);
  assert.equal(result.tooFewCriteria, true);
  assert.equal(result.eliminated, null, 'on n’élimine pas faute de données');
});

test('Notation : un critère sans plage remonte « non évalué » et n’abaisse pas le score', () => {
  const result = scoreCrop(
    cropEntry(),
    refOf('mais', {
      ph: makeRange('ph', 5.5, 7, 'VALIDATED'),
      ec: makeRange('ec', 0, 4, 'VALIDATED'),
      moisture: null,
    }),
    {
      ph: { value: 6.4, unit: 'pH', source: 'measured_lab', confidence: 'high' },
      ec: { value: 1, unit: 'dS/m', source: 'measured_lab', confidence: 'high' },
      moisture: { value: 22, unit: '%', source: 'measured_sensor', confidence: 'high' },
    },
  );
  const moisture = result.notEvaluated.find((entry) => entry.key === 'moisture');
  assert.ok(moisture, 'l’humidité mesurée doit apparaître comme non évaluée');
  assert.equal(moisture.cause, 'NO_REFERENCE');
  assert.match(moisture.reason, /aucune plage/i);
  // Seuls les critères avec plage comptent dans le dénominateur.
  assert.equal(result.evaluatedCount, 2);
  assert.equal(result.coverage, 1, 'tout ce qui était évaluable a été évalué');
});

test('Notation : la couverture mesure les mesures manquantes, pas l’étendue du référentiel', () => {
  // Deux plages définies, une seule mesurée → 50 %, et non 25 % si l’on
  // comptait les plages inexistantes. Sans cette distinction, un référentiel
  // partiel rendrait tout classement impossible, même sur une parcelle
  // parfaitement documentée.
  const ranges = {
    ph: makeRange('ph', 5.5, 7, 'VALIDATED'),
    ec: makeRange('ec', 0, 4, 'VALIDATED'),
  };
  const result = scoreCrop(
    cropEntry(),
    refOf('mais', ranges),
    { ph: { value: 6.4, unit: 'pH', source: 'measured_lab', confidence: 'high' } },
  );
  assert.equal(result.evaluatedCount, 1);
  assert.equal(result.coverage, 0.5);
  assert.equal(result.usable, false, 'sous le seuil MIN_COVERAGE de 0,6');
  assert.equal(result.tooFewCriteria, true, 'un seul critère évalué : sous le minimum');
  const missing = result.notEvaluated.find((entry) => entry.key === 'ec');
  assert.equal(missing.cause, 'NO_MEASUREMENT');
});

test('Notation : deux critères évalués et couverts suffisent à classer', () => {
  assert.equal(MIN_EVALUATED_CRITERIA, 2);
  const ranges = {
    ph: makeRange('ph', 5.5, 7, 'VALIDATED'),
    ec: makeRange('ec', 0, 4, 'VALIDATED'),
  };
  const result = scoreCrop(cropEntry(), refOf('mais', ranges), {
    ph: { value: 6.4, unit: 'pH', source: 'measured_lab', confidence: 'high' },
    ec: { value: 1, unit: 'dS/m', source: 'measured_lab', confidence: 'high' },
  });
  assert.equal(result.evaluatedCount, 2);
  assert.equal(result.coverage, 1);
  assert.equal(result.usable, true, 'un classement doit être possible');
  assert.equal(result.tooFewCriteria, false);
  // Les deux critères sont dans leur plage : score maximal.
  assert.equal(result.score, 1);
  // La fenêtre de semis et le libellé sont conservés pour l’affichage.
  assert.equal(result.cropSlug, 'mais');
  assert.equal(result.label, 'Maïs');
});

test('Notation : le score suit le facteur le plus limitant, et un dépassement le réduit', () => {
  const ranges = {
    ph: makeRange('ph', 5.5, 7, 'VALIDATED'),
    ec: makeRange('ec', 0, 4, 'VALIDATED'),
  };
  const inRange = scoreCrop(cropEntry(), refOf('mais', ranges), {
    ph: { value: 6.4, unit: 'pH', source: 'measured_lab', confidence: 'high' },
    ec: { value: 1, unit: 'dS/m', source: 'measured_lab', confidence: 'high' },
  });
  const outRange = scoreCrop(cropEntry(), refOf('mais', ranges), {
    // pH 4,4 : hors plage.
    ph: { value: 4.4, unit: 'pH', source: 'measured_lab', confidence: 'high' },
    ec: { value: 1, unit: 'dS/m', source: 'measured_lab', confidence: 'high' },
  });
  assert.equal(inRange.score, 1);
  // Règle par défaut (2.0) : facteur le plus limitant. Le pH hors plage vaut 0,
  // et c'est lui qui décide du score — il n'est pas compensé par la salinité
  // favorable. Sous la règle 1.0 (moyenne), le même cas donnait 0,5.
  assert.equal(outRange.score, 0, 'le critère défavorable devient le facteur limitant');
  assert.equal(outRange.eliminated, null, 'le pH n’est pas un critère éliminatoire');
  assert.equal(outRange.usable, true);
  assert.equal(outRange.criteria.find((c) => c.key === 'ph').met, false);
  assert.match(outRange.criteria.find((c) => c.key === 'ph').explanation, /hors plage/);
});

test('Notation : la salinité au-dessus de la plage élimine la culture', () => {
  const ranges = {
    ph: makeRange('ph', 5.5, 7, 'VALIDATED'),
    // Plage VALIDATED : sans elle, le critère n’est pas évaluable.
    ec: makeRange('ec', 0, 4, 'VALIDATED'),
  };
  const result = scoreCrop(cropEntry(), refOf('mais', ranges), {
    ph: { value: 6.4, unit: 'pH', source: 'measured_lab', confidence: 'high' },
    ec: { value: 9.5, unit: 'dS/m', source: 'measured_lab', confidence: 'high' },
  });
  assert.ok(result.eliminated, 'la culture doit être éliminée');
  assert.equal(result.eliminated.key, 'ec');
  assert.equal(result.eliminated.observed, 9.5);
  assert.equal(result.eliminated.limit, 4);
  assert.equal(result.usable, false);
  assert.equal(result.score, null);
  assert.match(result.eliminated.reason, /éliminatoire/);
});

test('Notation : un critère éliminatoire sans plage n’élimine pas', () => {
  // Règle essentielle : faute de plage enregistrée, le moteur ne peut pas
  // affirmer que la salinité disqualifie la culture. Il s’abstient.
  const result = scoreCrop(
    cropEntry(),
    refOf('mais', { ph: makeRange('ph', 5.5, 7, 'VALIDATED'), ec: null }),
    {
      ph: { value: 6.4, unit: 'pH', source: 'measured_lab', confidence: 'high' },
      ec: { value: 99, unit: 'dS/m', source: 'measured_lab', confidence: 'high' },
    },
  );
  assert.equal(result.eliminated, null, 'sans plage, aucune élimination n’est prononçable');
  const notEvaluated = result.notEvaluated.find((entry) => entry.key === 'ec');
  assert.equal(notEvaluated.cause, 'NO_REFERENCE');
});

test('Notation : la confiance est tracée sur le critère mais ne pondère pas le score', () => {
  /**
   * Contrat réel, vérifié : le score est la part de critères favorables et le
   * poids de chaque critère vaut 1. La confiance n'entre pas dans le calcul —
   * elle sert en amont (quelle mesure l'emporte lors de la fusion) et reste
   * affichée critère par critère pour que l'agriculteur voie d'où vient chaque
   * valeur. Ce test fixe ce comportement pour qu'il ne dérive pas en silence.
   */
  const ranges = {
    ph: makeRange('ph', 5.5, 7, 'VALIDATED'),
    ec: makeRange('ec', 0, 4, 'VALIDATED'),
  };
  const salinity = { value: 1, unit: 'dS/m', source: 'measured_lab', confidence: 'high' };
  const high = scoreCrop(cropEntry(), refOf('mais', ranges), {
    ...{ ec: salinity },
    ph: { value: 6.4, unit: 'pH', source: 'measured_lab', confidence: 'high' },
  });
  const low = scoreCrop(cropEntry(), refOf('mais', ranges), {
    ec: salinity,
    ph: { value: 6.4, unit: 'pH', source: 'declared', confidence: 'low' },
  });
  assert.equal(high.score, low.score, 'le score ne dépend pas de la confiance');
  // En revanche la provenance et la confiance restent lisibles.
  const phCriterion = low.criteria.find((c) => c.key === 'ph');
  assert.equal(phCriterion.confidence, 'low');
  assert.equal(phCriterion.source, 'declared');
});

test('Notation : un état vide ne produit aucun score', () => {
  const result = scoreCrop(
    cropEntry(),
    refOf('mais', { ph: makeRange('ph', 5.5, 7, 'VALIDATED') }),
    {},
  );
  assert.equal(result.score, null);
  assert.equal(result.coverage, 0);
  assert.equal(result.usable, false);
  assert.equal(result.eliminated, null);
});

/* ─────────── Satellite : humidité de surface seulement ─────────── */

test('Satellite : Sentinel-1 radar est la source principale d’humidité', () => {
  assert.equal(PRIMARY_MOISTURE_SOURCE.id, 'sentinel-1');
  assert.equal(PRIMARY_MOISTURE_SOURCE.role, 'principal');
  // Le radar ne prétend jamais mesurer le sous-sol.
  assert.equal(PRIMARY_MOISTURE_SOURCE.measuresSubsurface, false);
  assert.equal(PRIMARY_MOISTURE_SOURCE.cloudInsensitive, true);
  // Aucune scène précisée : le radar gagne, quelle que soit la nébulosité.
  assert.equal(resolveMoistureSource({ cloudCoverPct: 100 }).source.id, 'sentinel-1');
  assert.equal(resolveMoistureSource({ cloudCoverPct: null }).source.id, 'sentinel-1');
  assert.equal(resolveMoistureSource().source.id, 'sentinel-1');
});

test('Satellite : une scène optique exploitable est retenue, mais en complément', () => {
  const resolved = resolveMoistureSource({ cloudCoverPct: 10, availableSource: 'sentinel-2' });
  assert.equal(resolved.source.id, 'sentinel-2');
  assert.equal(resolved.source.role, 'complément');
  assert.equal(resolved.source.measuresSubsurface, false);
  assert.equal(resolved.degraded, false);
});

test('Satellite : une scène optique trop nuageuse est refusée, avec bascule radar', () => {
  assert.equal(CLOUD_COVER_REJECT_PCT, 40);
  // Au seuil et au-delà, l'optique est refusé — pas seulement dégradé : une
  // valeur douteuse finit toujours par être lue comme une mesure.
  for (const cloudCoverPct of [CLOUD_COVER_REJECT_PCT, 85, 100]) {
    const resolved = resolveMoistureSource({ cloudCoverPct, availableSource: 'sentinel-2' });
    assert.equal(resolved.source.id, 'sentinel-1', `à ${cloudCoverPct} % de nuages, le radar doit prendre le relais`);
    assert.equal(resolved.rejectedSource, 'sentinel-2');
    assert.match(resolved.reason, /refusée/);
  }
  // Juste sous le seuil, l'optique reste acceptable.
  assert.equal(
    resolveMoistureSource({ cloudCoverPct: CLOUD_COVER_REJECT_PCT - 1, availableSource: 'sentinel-2' }).source.id,
    'sentinel-2',
  );
  // Le radar, lui, n'est jamais refusé pour cause de nuages.
  assert.equal(resolveMoistureSource({ cloudCoverPct: 100, availableSource: 'sentinel-1' }).source.id, 'sentinel-1');
});

test('Satellite : la réserve sur le sous-sol est systématiquement rappelée', () => {
  assert.match(SUBSURFACE_CAVEAT, /sous-sol/);
  assert.match(SUBSURFACE_CAVEAT, /sonde/);
  // Aucune source satellite ne prétend mesurer le sous-sol.
  for (const availableSource of ['sentinel-1', 'sentinel-2']) {
    assert.equal(
      resolveMoistureSource({ cloudCoverPct: 0, availableSource }).source.measuresSubsurface,
      false,
    );
  }
});

/* ─────────── Intégration : chemin complet et cloisonnement ─────────── */

import { prisma } from '../src/config/prisma.js';
import { withFakePrisma } from './helpers/fakePrisma.mjs';
import * as recommendationService from '../src/modules/recommendation/recommendation.service.js';
import * as rangesService from '../src/modules/recommendation/agronomicRanges.service.js';

const ORG = 'org_equateur';
const OTHER = 'org_autre';

const reqAs = (organizationId = ORG) => ({
  tenant: { organizationId, effectiveRoles: ['FARMER'] },
  user: { id: 'user_1', roles: ['FARMER'] },
  headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1',
  requestId: 'req_test',
});

const PERIOD = { periodStart: new Date('2026-09-01'), periodEnd: new Date('2026-10-31') };

/**
 * Plages de référence en base, pour le lot `production`.
 *
 * Trois paramètres renseignés avec une source citable : c'est le minimum pour
 * que le moteur puisse classer (MIN_EVALUATED_CRITERIA = 2). Les valeurs sont
 * des fixtures de test, pas le référentiel réel — celui-ci vient de l'import
 * du tableau « Plages agronomiques » et n'est pas saisi à la main.
 */
const rangeRow = (parameterKey, minValue, maxValue, unit, extra = {}) => ({
  id: `range_mais_${parameterKey}`,
  organizationId: null,
  cropSlug: 'mais',
  parameterKey,
  minValue,
  maxValue,
  unit,
  status: 'PROVISIONAL',
  sourceReference: 'Source de test (fictive)',
  sourceNote: null,
  datasetLabel: 'production',
  validatedBy: null,
  validatedAt: null,
  deletedAt: null,
  version: 1,
  ...extra,
});

const referenceRows = () => [
  rangeRow('ph', 5.5, 7, 'pH'),
  rangeRow('airTemperatureC', 21, 30, '°C', {
    // La température d'un référentiel générique est celle de l'air : la note le rappelle.
    sourceNote: 'Température de l’air (référentiel générique), et non température du sol.',
  }),
  rangeRow('ec', 0, 4, 'dS/m'),
];

const store = (overrides = {}) => ({
  plot: [
    {
      id: 'plot_mbandaka',
      organizationId: ORG,
      farmId: 'farm_1',
      name: 'Parcelle Mbandaka',
      areaHa: 3,
      deletedAt: null,
    },
    {
      id: 'plot_autre_org',
      organizationId: OTHER,
      farmId: 'farm_2',
      name: 'Parcelle d’une autre organisation',
      deletedAt: null,
    },
  ],
  farm: [
    { id: 'farm_1', organizationId: ORG, countryCode: 'CD', province: 'Équateur' },
    { id: 'farm_2', organizationId: OTHER, countryCode: 'CD', province: 'Nord-Kivu' },
  ],
  soilAssessment: [],
  soilParameter: [],
  sensorReading: [],
  sensorAnomaly: [],
  iotDevice: [],
  satelliteObservation: [],
  cropRecommendation: [],
  cropAgronomicRange: [],
  /**
   * Déclaré vide explicitement : `createRecommendation` charge les prévisions
   * de la parcelle. Un modèle absent du store ferait retomber fakePrisma sur le
   * vrai client Prisma — et le test échouerait sur une base injoignable au lieu
   * de tester le moteur.
   */
  soilPrediction: [],
  auditLog: [],
  ...overrides,
});

/** pH et salinité mesurés en laboratoire sur la parcelle. */
const labData = {
  soilAssessment: [
    {
      id: 'assess_1',
      plotId: 'plot_mbandaka',
      organizationId: ORG,
      countryCode: 'CD',
      assessedAt: new Date('2026-08-01'),
      deletedAt: null,
    },
  ],
  soilParameter: [
    { id: 'sp_ph', assessmentId: 'assess_1', key: 'ph', value: 6.4, numericValue: 6.4, unit: 'pH', source: 'measured_lab', confidence: 'high', measuredAt: new Date('2026-08-01'), deletedAt: null, organizationId: ORG },
    { id: 'sp_sal', assessmentId: 'assess_1', key: 'ec', value: 1.2, numericValue: 1.2, unit: 'dS/m', source: 'measured_lab', confidence: 'high', measuredAt: new Date('2026-08-01'), deletedAt: null, organizationId: ORG },
  ],
};

/** Station météo de l'exploitation : la température de l'air vient de là. */
const stationData = {
  sensorReading: [
    {
      id: 'sr_temp',
      plotId: 'plot_mbandaka',
      organizationId: ORG,
      deviceId: 'device_station_1',
      metric: 'airTemperatureC',
      value: 25,
      unit: '°C',
      source: 'measured_sensor',
      confidence: 'high',
      at: new Date('2026-08-25'),
      depthCm: null,
      mode: 'REAL',
      deletedAt: null,
    },
  ],
};

/** Parcelle documentée : trois critères évaluables sur trois. */
const documentedStore = (extra = {}) =>
  store({ ...labData, ...stationData, cropAgronomicRange: referenceRows(), ...extra });

const expectStatus = async (promise, status, pattern = null) => {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, status, `statut attendu ${status}, reçu ${error.status} (${error.message})`);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
};

test('Recommandation : la parcelle d’une autre organisation est invisible (404, pas 403)', async () => {
  const { restore } = await withFakePrisma(prisma, store());
  try {
    // 404 et non 403 : révéler l'existence de la parcelle d'un tiers serait
    // déjà une fuite d'information.
    await expectStatus(recommendationService.createRecommendation('plot_autre_org', PERIOD, reqAs()), 404);
    await expectStatus(recommendationService.listRecommendations('plot_autre_org', reqAs()), 404);
  } finally {
    restore();
  }
});

test('Recommandation : une province hors déploiement est refusée (409)', async () => {
  const { restore } = await withFakePrisma(prisma, store());
  try {
    // farm_2 est au Nord-Kivu : hors des deux provinces du déploiement.
    await expectStatus(
      recommendationService.createRecommendation('plot_autre_org', PERIOD, reqAs(OTHER)),
      409,
      /Nord-Kivu/,
    );
  } finally {
    restore();
  }
});

test('Recommandation : un horizon hors limites est refusé par le service lui-même', async () => {
  assert.equal(MAX_PERIOD_DAYS, 365);
  const { restore } = await withFakePrisma(prisma, store());
  try {
    await expectStatus(
      recommendationService.createRecommendation(
        'plot_mbandaka',
        { periodStart: new Date('2026-09-01'), periodEnd: new Date('2027-12-31') },
        reqAs(),
      ),
      422,
      /365/,
    );
    await expectStatus(
      recommendationService.createRecommendation(
        'plot_mbandaka',
        { periodStart: new Date('2026-10-01'), periodEnd: new Date('2026-09-01') },
        reqAs(),
      ),
      422,
      /postérieure/,
    );
  } finally {
    restore();
  }
});

test('Recommandation : référentiel vide ⇒ INSUFFICIENT_DATA explicite et tracé', async () => {
  // Aucune plage en base : le moteur ne peut rien classer, et le dit.
  const { restore } = await withFakePrisma(prisma, store(labData));
  try {
    const result = await recommendationService.createRecommendation('plot_mbandaka', PERIOD, reqAs());
    assert.equal(result.recommendation.status, 'INSUFFICIENT_DATA');
    assert.equal(result.recommendation.scores.length, 0);
    assert.equal(result.counts.ranked, 0);
    assert.ok(result.counts.candidates > 0, 'le calendrier proposait pourtant des cultures');
    assert.match(result.recommendation.insufficiencyReason, /critères agronomiques évaluables/);
    assert.equal(result.indicative, true);
    assert.ok(
      result.indicativeReasons.some((reason) => /calendrier/i.test(reason)),
      'le calendrier provisoire doit être signalé',
    );
    // Le lot de référentiel utilisé est tracé dans la recommandation.
    assert.equal(result.recommendation.explanation.reference.datasetLabel, 'production');
    assert.equal(result.recommendation.explanation.reference.calendarStatus, 'PROVISIONAL');
    // Les mesures de référence sont conservées pour l'explication.
    assert.equal(result.recommendation.referenceMeasurements.ph.value, 6.4);
    assert.equal(result.recommendation.referenceMeasurements.ph.origin, 'soil-assessment');
    assert.equal(result.recommendation.referenceMeasurements.ph.mode, 'REAL');
  } finally {
    restore();
  }
});

test('Recommandation : référentiel renseigné ⇒ classement produit et étiqueté indicatif', async () => {
  const { restore } = await withFakePrisma(prisma, documentedStore());
  try {
    const result = await recommendationService.createRecommendation('plot_mbandaka', PERIOD, reqAs());
    const recommendation = result.recommendation;
    assert.equal(recommendation.status, 'ACTIVE');
    assert.ok(recommendation.scores.length > 0, 'au moins une culture doit être classée');
    assert.equal(recommendation.insufficiencyReason, null);
    assert.equal(result.counts.ranked, recommendation.scores.length);

    // Calendrier provisoire + plages provisoires ⇒ sortie indicative.
    assert.equal(result.indicative, true);
    assert.ok(result.indicativeReasons.some((reason) => /calendrier/i.test(reason)));
    assert.ok(result.indicativeReasons.some((reason) => /plages agronomiques/i.test(reason)));

    const best = recommendation.scores[0];
    assert.equal(best.evaluatedCount ?? best.criteria.length, 3);
    assert.equal(best.coverage, 1);
    assert.ok(best.score > 0);

    // Les seuils de surveillance sont dérivés des plages réelles, pas inventés.
    assert.equal(recommendation.thresholds.ph.min, 5.5);
    assert.equal(recommendation.thresholds.ph.max, 7);
    assert.equal(recommendation.thresholds.ph.rangeStatus, 'PROVISIONAL');
    assert.equal(recommendation.thresholds.ec.max, 4);
  } finally {
    restore();
  }
});

test('Recommandation : le texte d’explication ne cite que des chiffres présents dans les données', async () => {
  const { restore } = await withFakePrisma(prisma, documentedStore());
  try {
    const { recommendation } = await recommendationService.createRecommendation(
      'plot_mbandaka',
      PERIOD,
      reqAs(),
    );
    const explanation = await recommendationService.explainRecommendation(recommendation.id, reqAs());

    assert.equal(explanation.language, 'fr');
    assert.ok(explanation.text.length > 0);
    assert.equal(explanation.indicative, true);

    /**
     * Ensemble des nombres que le moteur connaît vraiment : mesures de
     * référence, durée demandée, nombre de cultures, scores et couvertures.
     * Tout chiffre du texte doit en provenir — sinon le gabarit invente.
     */
    const allowed = new Set();
    allowed.add(String(recommendation.requestedDays));
    allowed.add(String(recommendation.scores.length));
    for (const entry of recommendation.scores) {
      allowed.add(String(Math.round((entry.score ?? 0) * 100)));
      allowed.add(String(Math.round((entry.coverage ?? 0) * 100)));
    }
    for (const measurement of Object.values(recommendation.referenceMeasurements)) {
      if (Number.isFinite(measurement.value)) allowed.add(String(measurement.value));
    }

    // La version du moteur est une **donnée** (celle qui a servi au calcul), pas
    // un chiffre inventé : le texte la cite pour rester interprétable.
    for (const token of String(recommendation.ruleSetVersion ?? '').match(/\d+(?:[.,]\d+)?/g) ?? []) {
      allowed.add(token.replace(',', '.'));
    }

    const found = [...explanation.text.matchAll(/\d+(?:[.,]\d+)?/g)].map((match) => match[0].replace(',', '.'));
    assert.ok(found.length > 0, 'le texte devrait citer au moins un chiffre');
    for (const token of found) {
      assert.ok(allowed.has(token), `le nombre « ${token} » du texte ne vient pas des données du moteur`);
    }
  } finally {
    restore();
  }
});

test('Explication : la mise en garde air ≠ sol apparaît quand le critère air est évalué', async () => {
  // `documentedStore()` réunit pH et salinité de laboratoire **et** une lecture
  // de station météo à 25 °C : le critère « température de l'air » du référentiel
  // est donc réellement évalué, et le texte doit le signaler comme tel.
  const { restore } = await withFakePrisma(prisma, documentedStore());
  try {
    const { recommendation } = await recommendationService.createRecommendation(
      'plot_mbandaka',
      PERIOD,
      reqAs(),
    );
    const explanation = await recommendationService.explainRecommendation(recommendation.id, reqAs());

    assert.ok(
      recommendation.scores.some((entry) => entry.criteria.some((c) => c.key === 'airTemperatureC')),
      'le scénario de test doit évaluer le critère air',
    );
    assert.match(explanation.text, /celle de l\u2019air/);
    assert.match(explanation.text, /pas une température de sol/);
    // Le texte nomme la grandeur, jamais la clé technique.
    assert.doesNotMatch(explanation.text, /airTemperatureC/);
    assert.match(explanation.text, /température de l\u2019air/);
  } finally {
    restore();
  }
});

test('Explication : sans station météo, la température de l\u2019air reste non évaluée', async () => {
  // Mêmes plages, mais aucune lecture `airTemperatureC` : le moteur ne doit ni
  // substituer une température de sol, ni afficher la mise en garde air/sol.
  const { restore } = await withFakePrisma(
    prisma,
    store({ ...labData, cropAgronomicRange: referenceRows() }),
  );
  try {
    const { recommendation } = await recommendationService.createRecommendation(
      'plot_mbandaka',
      PERIOD,
      reqAs(),
    );
    const explanation = await recommendationService.explainRecommendation(recommendation.id, reqAs());

    const scored = recommendation.scores.find((entry) => entry.cropSlug);
    const air = scored.notEvaluated.find((entry) => entry.key === 'airTemperatureC');
    assert.ok(air, 'la température de l\u2019air doit remonter non évaluée');
    assert.equal(air.cause, 'NO_MEASUREMENT');

    assert.match(explanation.text, /Non évalué : température de l\u2019air/);
    assert.doesNotMatch(explanation.text, /celle de l\u2019air/);
    assert.doesNotMatch(explanation.text, /airTemperatureC/);
  } finally {
    restore();
  }
});

test('Recommandation : l’explication d’un INSUFFICIENT_DATA donne le motif, pas un classement', async () => {
  const { restore } = await withFakePrisma(prisma, store(labData));
  try {
    const { recommendation } = await recommendationService.createRecommendation(
      'plot_mbandaka',
      PERIOD,
      reqAs(),
    );
    const explanation = await recommendationService.explainRecommendation(recommendation.id, reqAs());
    assert.equal(explanation.indicative, true);
    assert.match(explanation.text, /Aucune recommandation/);
    assert.match(explanation.text, /critères agronomiques évaluables/);
  } finally {
    restore();
  }
});

test('Recommandation : refuser une recommandation INSUFFICIENT_DATA est un conflit', async () => {
  const { restore } = await withFakePrisma(prisma, store(labData));
  try {
    const { recommendation } = await recommendationService.createRecommendation(
      'plot_mbandaka',
      PERIOD,
      reqAs(),
    );
    await expectStatus(
      recommendationService.decideRecommendation(recommendation.id, { decision: 'REJECTED' }, reqAs()),
      409,
      /INSUFFICIENT_DATA/,
    );
  } finally {
    restore();
  }
});

test('Recommandation : accepter remplace la recommandation active précédente', async () => {
  const { restore } = await withFakePrisma(prisma, documentedStore());
  try {
    const first = await recommendationService.createRecommendation('plot_mbandaka', PERIOD, reqAs());
    const accepted = await recommendationService.decideRecommendation(
      first.recommendation.id,
      { decision: 'ACCEPTED' },
      reqAs(),
    );
    assert.equal(accepted.status, 'ACTIVE');

    const second = await recommendationService.createRecommendation('plot_mbandaka', PERIOD, reqAs());
    // Tant que l'agriculteur n'a pas décidé, l'ancienne reste active.
    let history = await recommendationService.listRecommendations('plot_mbandaka', reqAs());
    assert.equal(history.items.filter((item) => item.status === 'ACTIVE').length, 2);

    await recommendationService.decideRecommendation(
      second.recommendation.id,
      { decision: 'ACCEPTED' },
      reqAs(),
    );
    history = await recommendationService.listRecommendations('plot_mbandaka', reqAs());
    assert.equal(history.items.filter((item) => item.status === 'ACTIVE').length, 1);
    assert.equal(history.items.filter((item) => item.status === 'SUPERSEDED').length, 1);
  } finally {
    restore();
  }
});

test('Recommandation : l’humidité satellite ne comble que l’absence de sonde, en confiance faible', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    documentedStore({
      satelliteObservation: [
        {
          id: 'obs_1',
          organizationId: ORG,
          plotId: 'plot_mbandaka',
          provider: 'sentinel-1',
          index: 'S1_SOIL_MOISTURE',
          cloudCover: null,
          value: 31,
          unit: '%',
          observedAt: new Date('2026-08-20'),
          mode: 'REAL',
          deletedAt: null,
        },
      ],
    }),
  );
  try {
    const result = await recommendationService.createRecommendation('plot_mbandaka', PERIOD, reqAs());
    const moisture = result.recommendation.referenceMeasurements.moisture;
    assert.ok(moisture, 'l’humidité satellite doit combler l’absence de sonde');
    assert.equal(moisture.confidence, 'low');
    assert.equal(moisture.origin, 'satellite:sentinel-1');
    assert.equal(moisture.value, 31);
    assert.match(moisture.caveat, /sous-sol/);
    assert.equal(result.satellite.filled, true);
    // Le pH mesuré en laboratoire n'est jamais écrasé par le satellite.
    assert.equal(result.recommendation.referenceMeasurements.ph.origin, 'soil-assessment');
  } finally {
    restore();
  }
});

/**
 * Même scène satellite, seul le `mode` change.
 *
 * La paire est délibérée : si le filtre disparaissait, le premier cas passerait
 * au vert en utilisant la valeur simulée. Comparer les deux rend la régression
 * visible plutôt que de constater une absence.
 */
const satelliteObservationWithMode = (mode) => ({
  id: 'obs_simulee',
  organizationId: ORG,
  plotId: 'plot_mbandaka',
  provider: 'sentinel-1',
  index: 'S1_SOIL_MOISTURE',
  cloudCover: null,
  value: 31,
  unit: '%',
  observedAt: new Date('2026-08-20'),
  mode,
  deletedAt: null,
});

test('Recommandation : une observation satellite SIMULATED est ignorée, et l’exclusion est dite', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    documentedStore({ satelliteObservation: [satelliteObservationWithMode('SIMULATED')] }),
  );
  try {
    const result = await recommendationService.createRecommendation('plot_mbandaka', PERIOD, reqAs());

    assert.equal(
      result.recommendation.referenceMeasurements.moisture,
      undefined,
      'une scène simulée ne doit jamais devenir une mesure de référence',
    );
    assert.equal(result.satellite.filled, false);
    assert.equal(result.satellite.ignoredSimulated, 1, 'le nombre de scènes écartées est déclaré');
    assert.match(result.satellite.reason, /SIMULATED/);

    // Aucune culture ne peut être notée sur l'humidité à partir du simulé.
    for (const crop of result.recommendation.candidates ?? []) {
      const criterion = (crop.criteria ?? []).find((entry) => entry.key === RANGE_KEYS.SOIL_MOISTURE);
      assert.ok(
        !criterion || criterion.status === 'NOT_EVALUATED',
        `l'humidité simulée ne doit pas fonder un critère évalué : ${JSON.stringify(criterion)}`,
      );
    }
  } finally {
    restore();
  }
});

test('Recommandation : la même scène en mode REAL est bien utilisée', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    documentedStore({ satelliteObservation: [satelliteObservationWithMode('REAL')] }),
  );
  try {
    const result = await recommendationService.createRecommendation('plot_mbandaka', PERIOD, reqAs());

    const moisture = result.recommendation.referenceMeasurements.moisture;
    assert.ok(moisture, 'le mode est bien la seule différence avec le cas précédent');
    assert.equal(moisture.value, 31);
    assert.equal(moisture.origin, 'satellite:sentinel-1');
    assert.equal(result.satellite.filled, true);
  } finally {
    restore();
  }
});

test('Recommandation : une sonde d’humidité prime sur le satellite', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    documentedStore({
      sensorReading: [
        ...stationData.sensorReading,
        {
          id: 'sr_moisture',
          plotId: 'plot_mbandaka',
          organizationId: ORG,
          deviceId: 'device_sonde_1',
          metric: 'moisture',
          value: 27,
          unit: '%',
          source: 'measured_sensor',
          confidence: 'high',
          at: new Date('2026-08-26'),
          depthCm: 30,
          mode: 'REAL',
          deletedAt: null,
        },
      ],
      satelliteObservation: [
        {
          id: 'obs_1',
          organizationId: ORG,
          plotId: 'plot_mbandaka',
          provider: 'sentinel-1',
          index: 'S1_SOIL_MOISTURE',
          value: 31,
          unit: '%',
          observedAt: new Date('2026-08-20'),
          mode: 'REAL',
          deletedAt: null,
        },
      ],
    }),
  );
  try {
    const result = await recommendationService.createRecommendation('plot_mbandaka', PERIOD, reqAs());
    const moisture = result.recommendation.referenceMeasurements.moisture;
    assert.equal(moisture.value, 27, 'la sonde doit l’emporter');
    assert.equal(moisture.origin, 'sensor');
    assert.equal(result.satellite.filled, false);
    assert.match(result.satellite.reason, /sonde/);
  } finally {
    restore();
  }
});

test('Recommandation : une scène NDVI n’est jamais lue comme une humidité du sol', async () => {
  /**
   * `SatelliteObservation.value` n'a de sens que par rapport à `index`, dont
   * la valeur par défaut est NDVI. Un NDVI vaut typiquement 0 à 1 : le prendre
   * pour un pourcentage d'humidité produirait un chiffre plausible et faux.
   */
  const { restore } = await withFakePrisma(
    prisma,
    documentedStore({
      satelliteObservation: [
        {
          id: 'obs_ndvi',
          organizationId: ORG,
          plotId: 'plot_mbandaka',
          provider: 'sentinel-2',
          index: 'NDVI',
          value: 0.72,
          unit: null,
          observedAt: new Date('2026-08-20'),
          mode: 'REAL',
          deletedAt: null,
        },
      ],
    }),
  );
  try {
    const result = await recommendationService.createRecommendation('plot_mbandaka', PERIOD, reqAs());
    assert.equal(result.satellite.filled, false, 'un NDVI ne doit pas combler l’humidité');
    assert.equal(result.recommendation.referenceMeasurements.moisture, undefined);
    assert.match(result.satellite.reason, /NDVI/);
    assert.match(result.satellite.reason, /S1_SOIL_MOISTURE/);
  } finally {
    restore();
  }
});

test('Recommandation : une mesure simulée n’entre pas dans l’état du sol', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    documentedStore({
      sensorReading: [
        {
          id: 'sr_simulated',
          plotId: 'plot_mbandaka',
          organizationId: ORG,
          deviceId: 'device_simule',
          metric: 'moisture',
          value: 42,
          unit: '%',
          source: 'measured_sensor',
          confidence: 'high',
          at: new Date('2026-08-27'),
          depthCm: 30,
          mode: 'SIMULATED',
          deletedAt: null,
        },
      ],
    }),
  );
  try {
    const result = await recommendationService.createRecommendation('plot_mbandaka', PERIOD, reqAs());
    // Aucune sonde réelle et aucun satellite : l'humidité reste non évaluée.
    assert.equal(result.recommendation.referenceMeasurements.moisture, undefined);
  } finally {
    restore();
  }
});

/* ─────────── Référentiel : écriture, validation, cloisonnement ─────────── */

const adminReq = (organizationId = ORG) => ({
  ...reqAs(organizationId),
  tenant: { organizationId, effectiveRoles: ['ADMIN'] },
  user: { id: 'user_admin', roles: ['ADMIN'] },
});

const newRange = (overrides = {}) => ({
  cropSlug: 'mais',
  parameterKey: 'ph',
  minValue: 5.5,
  maxValue: 7,
  unit: 'pH',
  sourceReference: 'Référentiel agronomique de test — Zea mays',
  ...overrides,
});

test('Référentiel : une plage sans aucune provenance est refusée', async () => {
  const { restore } = await withFakePrisma(prisma, store());
  try {
    const { sourceReference, ...noProvenance } = newRange();
    await expectStatus(rangesService.createRange(noProvenance, adminReq()), 422, /provenance/);
  } finally {
    restore();
  }
});

test('Référentiel : une borne hors limites physiques est refusée', async () => {
  const { restore } = await withFakePrisma(prisma, store());
  try {
    // pH à 42 : manifestement un import corrompu.
    await expectStatus(
      rangesService.createRange(newRange({ maxValue: 42 }), adminReq()),
      422,
      /physiquement plausible/,
    );
    // Bornes inversées.
    await expectStatus(
      rangesService.createRange(newRange({ minValue: 7, maxValue: 5.5 }), adminReq()),
      422,
      /supérieure à la borne maximale/,
    );
  } finally {
    restore();
  }
});

test('Référentiel : une unité incohérente est refusée', async () => {
  const { restore } = await withFakePrisma(prisma, store());
  try {
    await expectStatus(
      rangesService.createRange(newRange({ unit: 'dS/m' }), adminReq()),
      422,
      /Unité incohérente/,
    );
  } finally {
    restore();
  }
});

test('Référentiel : un paramètre inconnu est refusé', async () => {
  const { restore } = await withFakePrisma(prisma, store());
  try {
    await expectStatus(
      rangesService.createRange(newRange({ parameterKey: 'organicPct', unit: '%' }), adminReq()),
      422,
      /Paramètre inconnu/,
    );
  } finally {
    restore();
  }
});

test('Référentiel : créer une plage déjà présente est un conflit', async () => {
  const { restore } = await withFakePrisma(prisma, store({ cropAgronomicRange: referenceRows() }));
  try {
    await expectStatus(
      rangesService.createRange(newRange({ minValue: 5, maxValue: 6.5 }), adminReq()),
      409,
      /existe déjà/,
    );
  } finally {
    restore();
  }
});

test('Référentiel : créer une plage VALIDATED exige un validateur nommé', async () => {
  const { restore } = await withFakePrisma(prisma, store());
  try {
    await expectStatus(
      rangesService.createRange(newRange({ status: 'VALIDATED' }), adminReq()),
      422,
      /validateur nommé/,
    );
  } finally {
    restore();
  }
});

test('Référentiel : une plage créée sans statut demandé est provisoire', async () => {
  const { restore } = await withFakePrisma(prisma, store());
  try {
    const created = await rangesService.createRange(newRange(), adminReq());
    assert.equal(created.status, 'PROVISIONAL');
    assert.equal(created.validatedBy, null);
    assert.equal(created.validatedAt, null);
    assert.equal(created.datasetLabel, 'production');
  } finally {
    restore();
  }
});

test('Référentiel : valider exige une source citable', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      cropAgronomicRange: [
        rangeRow('ph', 5.5, 7, 'pH', { sourceReference: null, sourceNote: 'valeur locale non sourcée' }),
      ],
    }),
  );
  try {
    await expectStatus(
      rangesService.validateRange('range_mais_ph', { validatedBy: 'Dr. Mukendi' }, adminReq()),
      409,
      /source citable/,
    );
  } finally {
    restore();
  }
});

test('Référentiel : valider sans nom de validateur est refusé', async () => {
  const { restore } = await withFakePrisma(prisma, store({ cropAgronomicRange: referenceRows() }));
  try {
    await expectStatus(
      rangesService.validateRange('range_mais_ph', { validatedBy: ' ' }, adminReq()),
      422,
      /nom du validateur/,
    );
  } finally {
    restore();
  }
});

test('Référentiel : la validation horodate et nomme le validateur', async () => {
  const { restore } = await withFakePrisma(prisma, store({ cropAgronomicRange: referenceRows() }));
  try {
    const validated = await rangesService.validateRange(
      'range_mais_ph',
      { validatedBy: 'Dr. Mukendi', validatedAt: new Date('2026-10-01') },
      adminReq(),
    );
    assert.equal(validated.status, 'VALIDATED');
    assert.equal(validated.validatedBy, 'Dr. Mukendi');
    assert.ok(validated.validatedAt instanceof Date);
    // Une fois validée, la plage ne rend plus la recommandation « indicative ».
    assert.equal(hasProvisionalRange({ ph: toRange(validated) }), false);
  } finally {
    restore();
  }
});

test('Référentiel : modifier une plage validée la fait redevenir provisoire', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      cropAgronomicRange: [
        rangeRow('ph', 5.5, 7, 'pH', {
          status: 'VALIDATED',
          validatedBy: 'Dr. Mukendi',
          validatedAt: new Date('2026-10-01'),
        }),
      ],
    }),
  );
  try {
    const updated = await rangesService.updateRange(
      'range_mais_ph',
      { minValue: 5, maxValue: 6.8 },
      adminReq(),
    );
    // La validation portait sur les anciennes bornes : elle ne peut survivre.
    assert.equal(updated.status, 'PROVISIONAL');
    assert.equal(updated.validatedBy, null);
    assert.equal(updated.validatedAt, null);
    assert.equal(updated.minValue, 5);
    assert.equal(updated.maxValue, 6.8);
    assert.equal(updated.version, 2);
  } finally {
    restore();
  }
});

test('Référentiel : le paramètre d’une plage ne se change pas', async () => {
  const { restore } = await withFakePrisma(prisma, store({ cropAgronomicRange: referenceRows() }));
  try {
    await expectStatus(
      rangesService.updateRange('range_mais_ph', { parameterKey: 'ec' }, adminReq()),
      422,
      /ne se modifie pas/,
    );
  } finally {
    restore();
  }
});

test('Référentiel : modifier une plage inexistante est un 404', async () => {
  const { restore } = await withFakePrisma(prisma, store());
  try {
    await expectStatus(
      rangesService.updateRange('range_introuvable', { minValue: 5 }, adminReq()),
      404,
    );
    await expectStatus(rangesService.getRange('range_introuvable'), 404);
  } finally {
    restore();
  }
});

test('Référentiel : retirer une plage la sort du référentiel actif sans l’effacer', async () => {
  const { restore } = await withFakePrisma(prisma, store({ cropAgronomicRange: referenceRows() }));
  try {
    const retired = await rangesService.retireRange('range_mais_ph', adminReq());
    assert.equal(retired.status, 'RETIRED');
    // La ligne existe toujours : l'historique du référentiel est conservé.
    assert.ok(await rangesService.getRange('range_mais_ph'));

    const { byCrop } = await rangesService.rangesForCrops(['mais']);
    assert.equal(byCrop.mais.ph, undefined, 'une plage retirée ne doit plus être lue');
    assert.ok(byCrop.mais.ec, 'les autres plages doivent subsister');
  } finally {
    restore();
  }
});

test('Référentiel : le moteur ne lit que le lot actif, jamais un lot de test', async () => {
  // Une plage étiquetée `test` ne doit jamais influencer la production.
  const { restore } = await withFakePrisma(
    prisma,
    store({
      cropAgronomicRange: [
        rangeRow('ph', 1, 2, 'pH', { id: 'range_test_ph', datasetLabel: 'test' }),
      ],
    }),
  );
  try {
    const { byCrop, datasetLabel } = await rangesService.rangesForCrops(['mais']);
    assert.equal(datasetLabel, 'production');
    assert.deepEqual(byCrop, {}, 'aucune plage du lot « test » ne doit être lue en production');
  } finally {
    restore();
  }
});

test('Référentiel : la plage d’une organisation prime sur la plage plateforme', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      cropAgronomicRange: [
        rangeRow('ph', 5.5, 7, 'pH'),
        rangeRow('ph', 5, 6.5, 'pH', {
          id: 'range_mais_ph_org',
          organizationId: ORG,
          sourceReference: 'Validation locale — coopérative de Mbandaka',
        }),
      ],
    }),
  );
  try {
    const { byCrop } = await rangesService.rangesForCrops(['mais'], { organizationId: ORG });
    assert.equal(byCrop.mais.ph.min, 5, 'la plage organisationnelle doit l’emporter');
    assert.equal(byCrop.mais.ph.max, 6.5);

    // Une autre organisation ne voit que la plage plateforme.
    const other = await rangesService.rangesForCrops(['mais'], { organizationId: OTHER });
    assert.equal(other.byCrop.mais.ph.min, 5.5);
  } finally {
    restore();
  }
});

test('Référentiel : chaque écriture est auditée', async () => {
  const { fake, restore } = await withFakePrisma(prisma, store({ cropAgronomicRange: referenceRows() }));
  try {
    await rangesService.validateRange('range_mais_ph', { validatedBy: 'Dr. Mukendi' }, adminReq());
    await rangesService.retireRange('range_mais_ec', adminReq());

    const logs = fake._store.auditLog;
    const actions = logs.map((log) => log.action);
    assert.ok(actions.includes('agronomicRange.validate'), `audit manquant : ${actions.join(', ')}`);
    assert.ok(actions.includes('agronomicRange.retire'), `audit manquant : ${actions.join(', ')}`);
    for (const log of logs) {
      assert.equal(log.resource, 'CropAgronomicRange');
      assert.ok(log.resourceId, 'une entrée d’audit sans identifiant de ressource est inexploitable');
    }
  } finally {
    restore();
  }
});

test('Référentiel : le lot actif est celui de la configuration', async () => {
  const { restore } = await withFakePrisma(prisma, store());
  try {
    const { datasetLabel } = await rangesService.rangesForCrops([]);
    assert.equal(datasetLabel, 'production');
    // Un lot de test reste lisible quand on le demande explicitement.
    const explicit = await rangesService.rangesForCrops(['mais'], { datasetLabel: 'test' });
    assert.equal(explicit.datasetLabel, 'test');
  } finally {
    restore();
  }
});


/* ------------------------------------------------------------------ *
 * Température de l'air (référentiel générique) vs température de sol (mesurée)
 * ------------------------------------------------------------------ */

test('Température : la plage d\u2019un référentiel générique porte sur l\u2019AIR et porte un libellé qui le dit', () => {
  assert.equal(RANGE_KEYS.AIR_TEMPERATURE, 'airTemperatureC');
  assert.equal(RANGE_LABELS[RANGE_KEYS.AIR_TEMPERATURE], 'température de l\u2019air');
  // Le libellé ne doit pas être confondable avec une température de sol.
  assert.doesNotMatch(RANGE_LABELS[RANGE_KEYS.AIR_TEMPERATURE], /sol/i);
  // Aucun paramètre d'analyse de sol ne porte ce nom : c'est une métrique de
  // station météo, jamais une mesure pédologique.
  assert.ok(!SOIL_PARAMETER_KEYS.includes(RANGE_KEYS.AIR_TEMPERATURE));
});

test('Température : une mesure de sol ne peut jamais satisfaire le critère « air »', () => {
  const result = scoreCrop(
    cropEntry(),
    refOf('mais', {
      airTemperatureC: makeRange('airTemperatureC', 21, 30, 'PROVISIONAL'),
    }),
    {
      // Ce que produit réellement une sonde enterrée : pH, salinité, humidité.
      // Aucune de ces grandeurs n'est une température de l'air.
      ph: { value: 6.4, unit: 'pH', source: 'measured_sensor', confidence: 'high' },
      ec: { value: 1.2, unit: 'dS/m', source: 'measured_sensor', confidence: 'high' },
      moisture: { value: 28, unit: '%', source: 'measured_sensor', confidence: 'high' },
    },
  );
  const air = result.notEvaluated.find((entry) => entry.key === 'airTemperatureC');
  assert.ok(air, 'le critère air doit remonter non évalué, pas deviné');
  assert.equal(air.cause, 'NO_MEASUREMENT');
  assert.equal(air.label, 'température de l\u2019air');
  assert.match(air.reason, /mesure absente/i);
  assert.equal(result.evaluatedCount, 0, 'aucune mesure de sol n\u2019a été substituée');
  assert.equal(result.score, null, 'rien d\u2019évaluable : pas de score inventé');
  assert.equal(result.usable, false);
});

test('Température : seule une lecture portant la métrique « airTemperatureC » l\u2019évalue', () => {
  const result = scoreCrop(
    cropEntry(),
    refOf('mais', {
      airTemperatureC: makeRange('airTemperatureC', 21, 30, 'PROVISIONAL'),
    }),
    {
      airTemperatureC: {
        value: 26,
        unit: '°C',
        source: 'measured_sensor',
        confidence: 'high',
        origin: 'sensor',
      },
    },
  );
  const criterion = result.criteria.find((c) => c.key === 'airTemperatureC');
  assert.ok(criterion, 'le critère doit être évalué');
  assert.equal(criterion.met, true);
  assert.equal(criterion.label, 'température de l\u2019air');
  assert.equal(criterion.observed, 26);
  assert.equal(result.evaluatedCount, 1);
});

test('Explication : les critères sont nommés en français, jamais par leur clé technique', () => {
  const result = scoreCrop(
    cropEntry(),
    refOf('mais', {
      ph: makeRange('ph', 5.5, 7, 'VALIDATED'),
      airTemperatureC: makeRange('airTemperatureC', 21, 30, 'PROVISIONAL'),
      moisture: null,
    }),
    {
      ph: { value: 6.4, unit: 'pH', source: 'measured_lab', confidence: 'high' },
      moisture: { value: 22, unit: '%', source: 'measured_sensor', confidence: 'high' },
    },
  );
  for (const criterion of result.criteria) {
    assert.equal(criterion.label, RANGE_LABELS[criterion.key]);
    // Un libellé lisible contient un espace ; un nom de champ est un seul
    // identifiant. « pH du sol » passe, « airTemperatureC » non.
    assert.doesNotMatch(
      criterion.label,
      /^[a-z][A-Za-z0-9]*$/,
      'un nom de champ a fuité dans le libellé',
    );
    assert.notEqual(criterion.label, criterion.key);
  }
  for (const entry of result.notEvaluated) {
    assert.equal(entry.label, RANGE_LABELS[entry.key]);
    assert.ok(entry.reason.includes(RANGE_LABELS[entry.key]), 'le motif doit nommer la grandeur');
  }
});

test('Explication : la mise en garde air ≠ sol est exportée et sans ambiguïté', () => {
  assert.match(AIR_VS_SOIL_CAVEAT, /celle de l\u2019air/i);
  assert.match(AIR_VS_SOIL_CAVEAT, /pas une température de sol/i);
  assert.match(AIR_VS_SOIL_CAVEAT, /station météo/i);
  assert.match(AIR_VS_SOIL_CAVEAT, /diffèrent de plusieurs degrés/i);
});

test('Explication : le critère éliminatoire est nommé, pas exposé sous forme de clé', () => {
  const result = scoreCrop(
    cropEntry(),
    refOf('mais', { ec: makeRange('ec', 0, 4, 'VALIDATED') }),
    { ec: { value: 9, unit: 'dS/m', source: 'measured_lab', confidence: 'high' } },
  );
  assert.ok(result.eliminated, 'la salinité excessive doit éliminer la culture');
  assert.equal(result.eliminated.label, RANGE_LABELS.ec);
  assert.match(result.eliminated.reason, /éliminatoire/);
  assert.match(result.eliminated.reason, /salinité/i);
});

/* ─────────────── fraîcheur de l'état du sol ─────────────── */

/**
 * Régression : à provenance égale, c'est la mesure la plus **récente** qui
 * doit l'emporter.
 *
 * `buildSoilState` trie les lectures par date décroissante puis remplace la
 * valeur en place dès qu'une provenance au moins aussi fiable arrive. Avec une
 * comparaison large (`<=`), chaque itération écrasait la précédente et la boucle
 * terminait sur la mesure la plus ancienne : le classement et les seuils
 * d'alerte reposaient sur une photographie périmée, alors que le commentaire du
 * code annonçait l'inverse. Le test verrouille le sens de la comparaison.
 */
test('État du sol : à provenance égale, la mesure la plus récente prime', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      sensorReading: [
        {
          id: 'sr_vieux', plotId: 'plot_fraicheur', organizationId: ORG, deviceId: 'device_1',
          metric: 'moisture', value: 45, unit: '%', source: 'measured_sensor',
          confidence: 'high', at: new Date('2026-08-01'), depthCm: 30, mode: 'REAL',
        },
        {
          id: 'sr_moyen', plotId: 'plot_fraicheur', organizationId: ORG, deviceId: 'device_1',
          metric: 'moisture', value: 35, unit: '%', source: 'measured_sensor',
          confidence: 'high', at: new Date('2026-08-20'), depthCm: 30, mode: 'REAL',
        },
        {
          id: 'sr_recent', plotId: 'plot_fraicheur', organizationId: ORG, deviceId: 'device_1',
          metric: 'moisture', value: 25.5, unit: '%', source: 'measured_sensor',
          confidence: 'high', at: new Date('2026-09-09'), depthCm: 30, mode: 'REAL',
        },
      ],
    }),
  );
  try {
    const { state } = await recommendationService.buildSoilState(null, 'plot_fraicheur');
    assert.equal(state.moisture.value, 25.5, 'la mesure du 9 septembre doit l’emporter sur celle du 1er août');
    assert.equal(state.moisture.measuredAt.toISOString(), new Date('2026-09-09').toISOString());
  } finally {
    restore();
  }
});

test('État du sol : une provenance plus fiable l’emporte même si elle est plus ancienne', async () => {
  const { restore } = await withFakePrisma(
    prisma,
    store({
      sensorReading: [
        {
          id: 'sr_recent', plotId: 'plot_priorite', organizationId: ORG, deviceId: 'device_1',
          metric: 'ph', value: 7.8, unit: 'pH', source: 'measured_sensor',
          confidence: 'high', at: new Date('2026-09-09'), depthCm: null, mode: 'REAL',
        },
        {
          id: 'sr_labo', plotId: 'plot_priorite', organizationId: ORG, deviceId: 'device_1',
          metric: 'ph', value: 6.4, unit: 'pH', source: 'measured_lab',
          confidence: 'high', at: new Date('2026-08-01'), depthCm: null, mode: 'REAL',
        },
      ],
    }),
  );
  try {
    const { state } = await recommendationService.buildSoilState(null, 'plot_priorite');
    // Le laboratoire (priorité 1) prime sur la sonde (priorité 2), même plus ancien.
    assert.equal(state.ph.value, 6.4);
    assert.equal(state.ph.source, 'measured_lab');
  } finally {
    restore();
  }
});
