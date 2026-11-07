import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { analyseMessage, toGsm7, truncateForSms, SEGMENT_LIMITS } from '../src/integrations/twilio.js';
import { buildAlertMessage } from '../src/modules/alerts/alerts.service.js';

/**
 * Gabarits d'alerte : **un segment, en GSM-7, ou le test échoue.**
 *
 * ## Pourquoi cette contrainte est testée et pas seulement recommandée
 *
 * Un SMS GSM-7 porte **160 caractères** ; en UCS-2, **70**. Un seul caractère
 * hors du jeu fait basculer **tout** le message. Ce n'est pas une question de
 * style : la facture double, et le point de coupure change — la page Twilio pour
 * la RDC prévient que la concaténation « varie selon l'encodage ».
 *
 * **C'est déjà arrivé dans ce dépôt.** Les gabarits précédents utilisaient le
 * tiret cadratin `—` comme séparateur, partout. Résultat mesuré : chaque message
 * partait en **UCS-2, sur 3 ou 4 segments**. Personne ne s'en était aperçu,
 * parce que rien ne le mesurait.
 *
 * Les caractères fautifs ne sont pas ceux qu'on croit. Sont **hors** du jeu
 * GSM 03.38, vérifié un par un :
 *
 *  - `—` `–` tirets cadratin et demi-cadratin — insérés automatiquement par les
 *    correcteurs ;
 *  - `’` apostrophe typographique — idem ;
 *  - `« »` guillemets français ;
 *  - `…` points de suspension ;
 *  - `°` **degré** — donc `°C`, l'unité des alertes de température ;
 *  - `ô` `î` `ï` `ê` `â` `û` `ë` et `ç` **minuscule** — alors que `é`, `è`,
 *    `ù`, `à` et `Ç` majuscule, eux, y sont.
 *
 * Sont au jeu **étendu** (donc comptés double) : `[` `]` `{` `}` `\` `^` `~` `|`
 * `€`. Les gabarits évitent les crochets pour cette raison.
 */

/* ────────────────────── Le texte rédigé lui-même ────────────────────── */

/**
 * Analyse statique du **code source** des gabarits.
 *
 * Tester seulement la sortie ne suffirait pas : `smsText()` assainit les valeurs
 * dynamiques, et un filet de sécurité ne doit pas servir à masquer un gabarit
 * mal rédigé. On lit donc le fichier et on vérifie les littéraux de
 * `buildAlertMessage` directement.
 */
const SOURCE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'modules',
  'alerts',
  'alerts.service.js',
);

const extractTemplateLiterals = () => {
  const source = readFileSync(SOURCE_PATH, 'utf8');
  const start = source.indexOf('export const buildAlertMessage');
  assert.ok(start > 0, 'buildAlertMessage introuvable dans le source');
  // La fonction s'arrête au séparateur de section suivant.
  const end = source.indexOf('/* ─', start);
  assert.ok(end > start, 'fin de buildAlertMessage introuvable');
  const block = source.slice(start, end);

  /**
   * Segments de **corps** uniquement.
   *
   * Le titre n'est pas envoyé par SMS : il sert à l'in-app et à l'email, et
   * conserve légitimement sa typographie (`—`). Scanner tout le bloc produirait
   * deux faux positifs permanents, et un test qui échoue toujours ne sert à
   * rien. On découpe donc le bloc en paires `title:` / `body:` et on ne garde
   * que ce qui suit `body:`.
   */
  const bodies = [];
  const markers = [...block.matchAll(/\b(title|body):/g)];
  for (let index = 0; index < markers.length; index += 1) {
    if (markers[index][1] !== 'body') continue;
    const from = markers[index].index;
    const to = index + 1 < markers.length ? markers[index + 1].index : block.length;
    bodies.push(block.slice(from, to));
  }
  assert.ok(bodies.length >= 3, `corps de gabarit trouvés : ${bodies.length}`);

  /**
   * Dans un template literal, tout ce qui n'est pas `${...}` est du texte
   * **rédigé** : c'est celui-là qui doit être propre. Les `${...}` sont des
   * valeurs dynamiques, assainies par `smsText()`.
   */
  const literals = [];
  for (const body of bodies) {
    for (const match of body.matchAll(/'([^'\\\n]*)'/g)) literals.push(match[1]);
    for (const match of body.matchAll(/`([^`]*)`/g)) {
      for (const staticPart of match[1].split(/\$\{[^}]*\}/)) {
        if (staticPart.trim()) literals.push(staticPart);
      }
    }
  }
  return literals;
};

test('Gabarits : aucun caractère hors GSM-7 dans le texte rédigé', () => {
  const literals = extractTemplateLiterals();
  assert.ok(literals.length > 10, `littéraux extraits : ${literals.length}`);

  const offenders = [];
  for (const literal of literals) {
    const { nonGsm7 } = analyseMessage(literal);
    if (nonGsm7.length > 0) offenders.push({ literal, nonGsm7 });
  }

  assert.deepEqual(
    offenders,
    [],
    'ces fragments de gabarit forceraient l’UCS-2 et doubleraient le coût de chaque SMS : '
    + JSON.stringify(offenders, null, 2),
  );
});

/**
 * Le titre, lui, n'est pas contraint : il sert à l'in-app et à l'email, jamais
 * au SMS. Ce test fixe cette frontière pour qu'elle ne soit pas « corrigée » par
 * erreur dans un sens ou dans l'autre.
 */
test('Gabarits : le titre peut contenir un tiret cadratin, le corps non', () => {
  const message = buildAlertMessage({
    sourceType: 'MEASUREMENT',
    parameter: 'ph',
    plotName: 'Parcelle',
    observed: 8.5,
    unit: 'pH',
    min: 5.5,
    max: 7,
  });
  assert.match(message.title, /—/, 'le titre garde sa typographie : il n’est pas envoyé par SMS');
  assert.equal(
    analyseMessage(message.body).nonGsm7.length,
    0,
    'le corps, lui, part par SMS : aucun caractère hors GSM-7',
  );
});

/* ───────────────── Sortie réelle, entrées propres ───────────────── */

/**
 * Entrées **déjà propres** : si la sortie contient malgré tout un caractère hors
 * GSM-7, c'est le gabarit qui est en cause, pas la donnée.
 */
const CLEAN_CASES = [
  ['mesure', {
    sourceType: 'MEASUREMENT', parameter: 'moisture', plotName: 'Parcelle Nord',
    observed: 38.2, unit: '%', min: 40, max: 70, threshold: { derivedFrom: 'mais' },
  }],
  ['mesure sans reference', {
    sourceType: 'MEASUREMENT', parameter: 'ph', plotName: 'Parcelle Sud',
    observed: 8.5, unit: 'pH', min: 5.5, max: 7,
  }],
  ['prevision', {
    sourceType: 'FORECAST', parameter: 'moisture', plotName: 'Parcelle Nord',
    observed: 35, unit: '%', min: 40, max: 70, predictedBreachAt: new Date('2026-11-05'),
  }],
  ['silence capteur', {
    sourceType: 'SENSOR_SILENCE', deviceLabel: 'Sonde pH nord',
    silenceHours: 47.5, silenceThresholdHours: 24,
  }],
];

for (const [name, args] of CLEAN_CASES) {
  for (const simulated of [false, true]) {
    test(`Gabarits : ${name}${simulated ? ' (simulé)' : ''} tient dans un segment GSM-7`, () => {
      const { body } = buildAlertMessage({ ...args, simulated });
      const result = analyseMessage(body);

      assert.deepEqual(
        result.nonGsm7,
        [],
        `caractères hors GSM-7 dans : ${body}`,
      );
      assert.equal(result.encoding, 'GSM7', `encodage obtenu pour : ${body}`);
      assert.equal(
        result.segments,
        1,
        `${result.characterCount} caractères : le message déborde sur ${result.segments} segments — ${body}`,
      );
    });
  }
}

/* ─────────── Sortie réelle, entrées hostiles ─────────── */

/**
 * Les valeurs dynamiques ne sont **pas** sous le contrôle du gabarit : un nom de
 * parcelle saisi par l'agriculteur, un libellé d'appareil, une unité. Ces cas
 * vérifient que `smsText()` les rattrape.
 */
const HOSTILE_CASES = [
  ['nom de parcelle long et typographique', {
    sourceType: 'MEASUREMENT', parameter: 'moisture',
    plotName: 'Parcelle expérimentale nord-est secteur 3',
    observed: 38.2, unit: '%', min: 40, max: 70, threshold: { derivedFrom: 'mais' },
  }],
  ['libellé de paramètre avec apostrophe typographique', {
    // `RANGE_LABELS` contient réellement « température de l’air » avec une
    // apostrophe typographique, et « salinité du sol (conductivité électrique) »
    // qui fait 41 caractères.
    sourceType: 'FORECAST', parameter: 'airTemperatureC', plotName: 'Parcelle Nord',
    observed: 41, unit: '°C', min: 21, max: 30, predictedBreachAt: new Date('2026-11-05'),
  }],
  ['unité en degrés', {
    sourceType: 'MEASUREMENT', parameter: 'airTemperatureC', plotName: 'Parcelle Nord',
    observed: 41, unit: '°C', min: 21, max: 30,
  }],
  ['référence longue', {
    sourceType: 'MEASUREMENT', parameter: 'ec', plotName: 'Parcelle Nord',
    observed: 2.4, unit: 'dS/m', min: 0, max: 1.5,
    threshold: { derivedFrom: 'Référentiel agronomique de test — Maïs' },
  }],
  ['libellé d’appareil long', {
    sourceType: 'SENSOR_SILENCE', deviceLabel: 'Sonde pH nord secteur 4 — station météo',
    silenceHours: 47.5, silenceThresholdHours: 24,
  }],
];

for (const [name, args] of HOSTILE_CASES) {
  test(`Gabarits : ${name} — la valeur dynamique est rattrapée`, () => {
    const { body } = buildAlertMessage({ ...args, simulated: false });
    const result = analyseMessage(body);

    assert.deepEqual(result.nonGsm7, [], `caractères hors GSM-7 passés au travers : ${body}`);
    assert.equal(result.encoding, 'GSM7', body);
    assert.equal(
      result.segments,
      1,
      `${result.characterCount} caractères, ${result.segments} segments — ${body}`,
    );
  });
}

/**
 * Le pire cas combiné : préfixe `[SIMULÉ]`, noms longs partout, unité en degrés,
 * référence longue. C'est la borne haute du budget.
 */
test('Gabarits : le pire cas combiné reste dans un segment', () => {
  const { body } = buildAlertMessage({
    sourceType: 'MEASUREMENT',
    parameter: 'ec',
    plotName: 'Parcelle expérimentale nord-est secteur 3',
    observed: 2.4,
    unit: 'dS/m',
    min: 0,
    max: 1.5,
    threshold: { derivedFrom: 'Référentiel agronomique de test — Maïs' },
    simulated: true,
  });
  const result = analyseMessage(body);
  assert.equal(result.encoding, 'GSM7', body);
  assert.equal(result.segments, 1, `${result.characterCount}/160 — ${body}`);
  // Marge affichée : si elle fond, le prochain nom de parcelle un peu long
  // fera déborder le message sans qu'aucun test ne change.
  assert.ok(
    result.characterCount <= 158,
    `marge trop faible : ${result.characterCount}/160 — ${body}`,
  );
});

/* ───────────────────── Assainisseur et troncature ───────────────────── */

test('toGsm7 : les signes typographiques ont un équivalent fidèle', () => {
  assert.equal(toGsm7('l’alerte'), "l'alerte");
  // Les guillemets français portent des espaces intérieures : elles sont
  // conservées, seule la ponctuation change.
  assert.equal(toGsm7('« semer »'), '" semer "');
  assert.equal(toGsm7('attendre…'), 'attendre...');
  assert.equal(toGsm7('A — B'), 'A - B');
  assert.equal(toGsm7('œil'), 'oeil');
  assert.equal(analyseMessage(toGsm7('l’alerte « semer »… A — B')).encoding, 'GSM7');
});

/**
 * Contrairement aux signes, remplacer une lettre accentuée **retire un accent** :
 * « contrôle » devient « controle ». C'est une faute d'orthographe, pas une
 * translittération. D'où la règle : rédiger les gabarits sans ces lettres, et ne
 * laisser ce filet intervenir que sur les valeurs qu'on ne contrôle pas.
 */
test('toGsm7 : les lettres accentuées hors du jeu perdent leur accent', () => {
  assert.equal(toGsm7('contrôle'), 'controle');
  assert.equal(toGsm7('maître maïs'), 'maitre mais');
  assert.equal(toGsm7('ça va'), 'ca va');
  // Le « Ç » majuscule est au jeu GSM : il ne doit pas être touché.
  assert.equal(toGsm7('Ça va'), 'Ça va');
  assert.equal(analyseMessage(toGsm7('Ça va')).encoding, 'GSM7');
});

test('toGsm7 : le degré devient « deg », sinon chaque alerte de température bascule', () => {
  assert.equal(toGsm7('°C'), 'degC');
  assert.equal(analyseMessage('41 °C').encoding, 'UCS2', 'le ° brut force l’UCS-2');
  assert.equal(analyseMessage(toGsm7('41 °C')).encoding, 'GSM7');
});

test('toGsm7 : un texte déjà propre n’est pas modifié', () => {
  const clean = "AGRIKONNET : seuil dépassé. Parcelle Nord - pH du sol à 8,5 pH, attendu 5,5 à 7 pH.";
  assert.equal(toGsm7(clean), clean);
});

test('truncateForSms : un texte court n’est pas touché', () => {
  assert.equal(truncateForSms('Sonde nord', 20), 'Sonde nord');
});

test('truncateForSms : un texte long est coupé sur un mot, avec un point final', () => {
  const result = truncateForSms('Parcelle expérimentale nord-est secteur 3', 20);
  assert.ok(result.length <= 20, `${result.length} caractères : ${result}`);
  assert.ok(result.endsWith('.'), 'la troncature doit se voir');
  // La coupe tombe après « expérimentale » tronqué, pas avant : revenir au
  // dernier espace donnerait « Parcelle. », qui ne dit plus rien.
  assert.equal(result, 'Parcelle expériment.', `coupure obtenue : ${result}`);
});

test('truncateForSms : la troncature assainit aussi', () => {
  const result = truncateForSms('Sonde pH nord secteur 4 — station météo', 24);
  assert.deepEqual(analyseMessage(result).nonGsm7, [], result);
});

test('truncateForSms : la coupe respecte le budget même sans espace', () => {
  const result = truncateForSms('abcdefghijklmnopqrstuvwxyz', 10);
  assert.ok(result.length <= 10, `${result.length} : ${result}`);
});

/* ─────────────────── Le contenu reste utile ─────────────────── */

/**
 * Raccourcir ne doit pas vider le message de ce qui le rend actionnable. Ces
 * assertions existent pour qu'une recherche de caractères ne se fasse pas au
 * prix du contenu.
 */
test('Gabarits : la valeur observée et la plage attendue restent citées', () => {
  const { body } = buildAlertMessage({
    sourceType: 'MEASUREMENT',
    parameter: 'moisture',
    plotName: 'Parcelle Nord',
    observed: 38.2,
    unit: '%',
    min: 40,
    max: 70,
  });
  assert.match(body, /38,2/, 'la valeur observée est citée, avec la virgule décimale');
  assert.match(body, /40 à 70/, 'la plage attendue est citée');
  assert.match(body, /Parcelle/, 'la parcelle est nommée');
});

test('Gabarits : l’alerte de silence nomme l’appareil et le seuil', () => {
  const { body } = buildAlertMessage({
    sourceType: 'SENSOR_SILENCE',
    deviceLabel: 'Sonde pH nord',
    silenceHours: 47.5,
    silenceThresholdHours: 24,
  });
  assert.match(body, /Sonde pH nord/);
  assert.match(body, /47,5/);
  assert.match(body, /24/);
});

test('Gabarits : un message simulé reste marqué comme tel', () => {
  const { body } = buildAlertMessage({
    sourceType: 'MEASUREMENT',
    parameter: 'ph',
    plotName: 'Parcelle Nord',
    observed: 8.5,
    unit: 'pH',
    min: 5.5,
    max: 7,
    simulated: true,
  });
  assert.match(body, /^\[SIMULÉ\]/, 'une valeur simulée ne doit jamais passer pour une mesure');
  assert.equal(analyseMessage(body).encoding, 'GSM7', 'le préfixe ne doit pas casser l’encodage');
});

/**
 * Le nom du produit est épelé correctement.
 *
 * Ce n'est pas un test de style : les trois gabarits d'alerte portaient
 * **`AGRIKONNET`**, sans le `C`, dans chaque SMS envoyé. Un agriculteur qui
 * reçoit un message signé d'un nom mal orthographié n'a aucune raison de le
 * rapprocher de l'application — et un canal d'alerte qui n'inspire pas
 * confiance n'est plus lu. La faute est restée invisible tant que rien ne
 * vérifiait l'orthographe.
 */
test('Gabarits : le nom du produit est épelé AGRIKONNECT, pas AGRIKONNET', () => {
  const bodies = [
    buildAlertMessage({
      sourceType: 'MEASUREMENT', parameter: 'ph', plotName: 'Parcelle Nord',
      observed: 8.5, unit: 'pH', min: 5.5, max: 7,
    }),
    buildAlertMessage({
      sourceType: 'FORECAST', parameter: 'moisture', plotName: 'Parcelle Nord',
      observed: 12, unit: '%', min: 20, max: 60, predictedBreachAt: new Date('2026-11-05'),
    }),
    buildAlertMessage({
      sourceType: 'SENSOR_SILENCE', deviceLabel: 'Sonde pH nord',
      silenceHours: 31.5, silenceThresholdHours: 24,
    }),
  ];
  for (const { body } of bodies) {
    assert.match(body, /^AGRIKONNECT[ :]?/, `signature mal orthographiée : ${body}`);
    assert.doesNotMatch(body, /AGRIKONNET\b/, `le C manque : ${body}`);
  }
});

test('Gabarits : les limites de segment utilisées sont celles normalisées', () => {
  // Si ces valeurs changent, tous les calculs de coût de cette suite changent
  // avec elles : mieux vaut le savoir explicitement.
  assert.equal(SEGMENT_LIMITS.GSM7.single, 160);
  assert.equal(SEGMENT_LIMITS.GSM7.multi, 153);
  assert.equal(SEGMENT_LIMITS.UCS2.single, 70);
  assert.equal(SEGMENT_LIMITS.UCS2.multi, 67);
});
