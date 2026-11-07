/**
 * Retours de saison — validations et règles de calcul.
 *
 * Ce qui est testé ici est la partie qui peut produire une valeur **fausse mais
 * plausible** : le rendement par hectare, les bornes de vraisemblance, et
 * l'exclusion des sources calculées. Le reste (persistance, tenant) est couvert
 * par `tests/e2e/seasons.e2e.test.mjs`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSeasonFeedbackSchema,
  updateSeasonFeedbackSchema,
  listSeasonFeedbackSchema,
  statsSeasonFeedbackSchema,
  yieldPerHectare,
  MAX_YIELD_KG_PER_HA,
} from '../src/modules/seasons/seasons.schema.js';

/** Saisie minimale valide, réutilisée et déformée par chaque test. */
const validPayload = () => ({
  plotId: 'plot_01HXY0000000000000000001',
  cropId: 'mais',
  season: 'Saison A',
  year: 2026,
  periodStart: '2026-03-01',
  periodEnd: '2026-06-30',
  actualYieldKg: 4200,
  areaHa: 1.5,
});

// ─── Saisie valide ───────────────────────────────────────────────

test('Saisons : une saisie complète et cohérente est acceptée', () => {
  const parsed = createSeasonFeedbackSchema.parse(validPayload());
  assert.equal(parsed.actualYieldKg, 4200);
  assert.equal(parsed.areaHa, 1.5);
  assert.ok(parsed.periodStart instanceof Date);
});

test('Saisons : la source par défaut est « declared », jamais calculée', () => {
  const parsed = createSeasonFeedbackSchema.parse(validPayload());
  assert.equal(parsed.source, 'declared');
});

test('Saisons : surface et observations sont facultatives', () => {
  const { areaHa, ...withoutArea } = validPayload();
  const parsed = createSeasonFeedbackSchema.parse(withoutArea);
  assert.equal(parsed.areaHa, undefined);
});

// ─── Sources calculées refusées ──────────────────────────────────

test('Saisons : satellite, derived et estimated sont refusés', () => {
  /*
   * Un retour de saison est une observation de ce qui a été récolté. Accepter
   * une valeur calculée ferait entrer dans la table de vérité un chiffre que
   * personne n'a mesuré — et les statistiques suivantes en hériteraient sans
   * qu'on puisse plus distinguer l'observé de l'estimé.
   */
  for (const source of ['satellite', 'derived', 'estimated', 'measured_sensor', 'photo_interpreted']) {
    assert.throws(
      () => createSeasonFeedbackSchema.parse({ ...validPayload(), source }),
      `la source ${source} ne doit pas être admissible`,
    );
  }
});

test('Saisons : les trois sources d’observation sont admises', () => {
  for (const source of ['declared', 'third_party_verified', 'measured_lab']) {
    assert.equal(
      createSeasonFeedbackSchema.parse({ ...validPayload(), source }).source,
      source,
    );
  }
});

// ─── Bornes de vraisemblance ─────────────────────────────────────

test('Saisons : un rendement par hectare invraisemblable est refusé', () => {
  // 100 t/ha sur 1 ha : aucune culture du calendrier n'atteint ça. Presque
  // toujours des grammes entrés comme kilogrammes.
  assert.throws(
    () =>
      createSeasonFeedbackSchema.parse({
        ...validPayload(),
        actualYieldKg: 100001,
        areaHa: 1,
      }),
    /100000 kg\/ha/,
  );
});

test('Saisons : la borne haute est exactement atteignable', () => {
  const parsed = createSeasonFeedbackSchema.parse({
    ...validPayload(),
    actualYieldKg: MAX_YIELD_KG_PER_HA,
    areaHa: 1,
  });
  assert.equal(parsed.actualYieldKg, MAX_YIELD_KG_PER_HA);
});

test('Saisons : sans surface, aucune borne par hectare ne s’applique', () => {
  /*
   * Refuser un total élevé sans surface serait faux : 100 t sur 200 ha est
   * banal. La borne ne peut s'appliquer que si la surface est connue.
   */
  const { areaHa, ...withoutArea } = validPayload();
  const parsed = createSeasonFeedbackSchema.parse({
    ...withoutArea,
    actualYieldKg: 100001,
  });
  assert.equal(parsed.actualYieldKg, 100001);
});

test('Saisons : un rendement nul ou négatif est refusé', () => {
  for (const actualYieldKg of [0, -1, -500]) {
    assert.throws(
      () => createSeasonFeedbackSchema.parse({ ...validPayload(), actualYieldKg }),
      `rendement ${actualYieldKg} accepté`,
    );
  }
});

// ─── Période ─────────────────────────────────────────────────────

test('Saisons : une période inversée est refusée', () => {
  assert.throws(
    () =>
      createSeasonFeedbackSchema.parse({
        ...validPayload(),
        periodStart: '2026-06-30',
        periodEnd: '2026-03-01',
      }),
    /fin de période/,
  );
});

test('Saisons : une période de longueur nulle est refusée', () => {
  assert.throws(
    () =>
      createSeasonFeedbackSchema.parse({
        ...validPayload(),
        periodStart: '2026-03-01',
        periodEnd: '2026-03-01',
      }),
    /fin de période/,
  );
});

test('Saisons : une année future au-delà de l’an prochain est refusée', () => {
  const tropLoin = new Date().getFullYear() + 2;
  assert.throws(
    () => createSeasonFeedbackSchema.parse({ ...validPayload(), year: tropLoin }),
    /Année future/,
  );
});

test('Saisons : l’an prochain est accepté — on déclare une saison en cours', () => {
  const parsed = createSeasonFeedbackSchema.parse({
    ...validPayload(),
    year: new Date().getFullYear() + 1,
  });
  assert.equal(parsed.year, new Date().getFullYear() + 1);
});

// ─── Champs inconnus ─────────────────────────────────────────────

test('Saisons : un champ inconnu est refusé', () => {
  /*
   * `.strict()` : sans ça, un client pourrait envoyer `score` ou `predictedYieldKg`
   * et croire que le backend l'a pris en compte, alors qu'il l'ignore.
   */
  assert.throws(
    () => createSeasonFeedbackSchema.parse({ ...validPayload(), predictedYieldKg: 5000 }),
    /predictedYieldKg|Unrecognized/,
  );
});

// ─── Mise à jour partielle ───────────────────────────────────────

test('Saisons : une mise à jour peut ne porter qu’un seul champ', () => {
  const parsed = updateSeasonFeedbackSchema.parse({ actualYieldKg: 3800 });
  assert.equal(parsed.actualYieldKg, 3800);
  assert.equal(parsed.plotId, undefined);
});

test('Saisons : la mise à jour refuse l’identifiant', () => {
  assert.throws(
    () => updateSeasonFeedbackSchema.parse({ id: 'season_01HXY0000000000000000001' }),
    /id|Unrecognized/,
  );
});

test('Saisons : la mise à jour vide est acceptée — le service ne changera rien', () => {
  assert.deepEqual(updateSeasonFeedbackSchema.parse({}), {});
});

// ─── Rendement par hectare ───────────────────────────────────────

test('yieldPerHectare : division exacte et arrondi à deux décimales', () => {
  assert.equal(yieldPerHectare(4200, 1.5), 2800);
  assert.equal(yieldPerHectare(1000, 3), 333.33);
  assert.equal(yieldPerHectare(1, 3), 0.33);
});

test('yieldPerHectare : aucune surface, aucun rendement par hectare', () => {
  /*
   * Renvoyer `null` et non `0` : `0` affirmerait qu'on a mesuré un rendement
   * nul, alors qu'on ne sait simplement rien.
   */
  assert.equal(yieldPerHectare(4200, null), null);
  assert.equal(yieldPerHectare(4200, undefined), null);
  assert.equal(yieldPerHectare(4200, 0), null, 'division par zéro');
  assert.equal(yieldPerHectare(4200, -1), null, 'surface négative');
});

test('yieldPerHectare : rendement absent ou non numérique', () => {
  assert.equal(yieldPerHectare(null, 1.5), null);
  assert.equal(yieldPerHectare('abc', 1.5), null);
  assert.equal(yieldPerHectare(undefined, 1.5), null);
});

// ─── Filtres de liste et de statistiques ─────────────────────────

test('Saisons : withRecommendation est un booléen depuis sa chaîne de query', () => {
  assert.equal(listSeasonFeedbackSchema.parse({ withRecommendation: 'true' }).withRecommendation, true);
  assert.equal(listSeasonFeedbackSchema.parse({ withRecommendation: 'false' }).withRecommendation, false);
  assert.equal(listSeasonFeedbackSchema.parse({}).withRecommendation, undefined);
});

test('Saisons : withRecommendation n’accepte pas n’importe quelle chaîne', () => {
  assert.throws(() => listSeasonFeedbackSchema.parse({ withRecommendation: 'oui' }));
});

test('Saisons : le regroupement statistique est borné à quatre axes', () => {
  for (const groupBy of ['crop', 'plot', 'season', 'year']) {
    assert.equal(statsSeasonFeedbackSchema.parse({ groupBy }).groupBy, groupBy);
  }
  assert.throws(() => statsSeasonFeedbackSchema.parse({ groupBy: 'country' }));
  assert.equal(statsSeasonFeedbackSchema.parse({}).groupBy, 'crop');
});
