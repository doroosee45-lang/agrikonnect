import test from 'node:test';
import assert from 'node:assert/strict';

import {
  IMPORT_COLUMNS,
  IMPORT_EXAMPLE,
  IMPORT_HEADER,
  PARAMETER_LABELS,
  REQUIRED_COLUMNS,
  SOURCE_TYPE_MENU,
  buildTemplateCsv,
  normalizeHeader,
  parseCsvLine,
  parseCsvText,
  readImportRow,
  readNumber,
  resolveImportColumns,
  resolveParameterKey,
  resolveSourceType,
  resolveZone,
} from '../src/modules/recommendation/agronomicRangesCsv.js';
import { ZONE_CANONICAL } from '../src/modules/recommendation/agronomicRangesCsv.js';
import { RANGE_KEYS } from '../src/modules/recommendation/agronomicRanges.js';

/**
 * Tests **unitaires purs** du lecteur CSV du tableau « Plages agronomiques ».
 *
 * Aucun Prisma, aucune base, aucune requête HTTP : le module testé ne fait que
 * transformer du texte. Ce sont ces cas limites — guillemets, séparateurs,
 * accents, alias, lignes vides — qui cassent silencieusement un import réel, et
 * ils se vérifient bien mieux ici que dans une recette de bout en bout.
 */

/* ─────────────────────── Découpage d'une ligne ─────────────────────── */

test('CSV : séparateur point-virgule', () => {
  assert.deepEqual(parseCsvLine('manioc;ph;4.5;7.5'), ['manioc', 'ph', '4.5', '7.5']);
});

test('CSV : séparateur virgule', () => {
  assert.deepEqual(parseCsvLine('manioc,ph,4.5,7.5'), ['manioc', 'ph', '4.5', '7.5']);
});

test('CSV : séparateur tabulation', () => {
  assert.deepEqual(parseCsvLine('manioc\tph\t4.5'), ['manioc', 'ph', '4.5']);
});

test('CSV : les espaces autour des cellules sont retirés', () => {
  assert.deepEqual(parseCsvLine('  manioc ;  ph  ; 4.5 '), ['manioc', 'ph', '4.5']);
});

test('CSV : une cellule protégée par des guillemets conserve son séparateur', () => {
  // Cas réel : la source précise contient une virgule.
  const cells = parseCsvLine('manioc;ph;"Référentiel pédologique, Équateur 2026";4.5');
  assert.deepEqual(cells, ['manioc', 'ph', 'Référentiel pédologique, Équateur 2026', '4.5']);
});

test('CSV : des guillemets doublés deviennent un guillemet littéral', () => {
  const cells = parseCsvLine('manioc;ph;"Plage dite ""idéale""";4.5');
  assert.deepEqual(cells, ['manioc', 'ph', 'Plage dite "idéale"', '4.5']);
});

test('CSV : une cellule vide entre deux séparateurs reste vide', () => {
  assert.deepEqual(parseCsvLine('manioc;;4.5'), ['manioc', '', '4.5']);
});

test('CSV : une cellule vide protégée par des guillemets reste vide', () => {
  assert.deepEqual(parseCsvLine('manioc;"";4.5'), ['manioc', '', '4.5']);
});

/* ─────────────────────── Accents et casse ─────────────────────── */

test('Normalisation : accents, casse, espaces et ponctuation sont ignorés', () => {
  assert.equal(normalizeHeader('Paramètre'), 'parametre');
  assert.equal(normalizeHeader('  IDÉAL Min '), 'idealmin');
  assert.equal(normalizeHeader('Salinité maximale (EC)'), 'salinitemaximaleec');
  assert.equal(normalizeHeader("Température de l'air"), 'temperaturedelair');
  assert.equal(normalizeHeader('Nom scientifique'), 'nomscientifique');
});

test('Paramètre : les libellés français du tableau sont résolus', () => {
  assert.equal(resolveParameterKey('pH du sol'), RANGE_KEYS.PH);
  assert.equal(resolveParameterKey("Température de l'air"), RANGE_KEYS.AIR_TEMPERATURE);
  assert.equal(resolveParameterKey('Humidité volumique du sol'), RANGE_KEYS.SOIL_MOISTURE);
  assert.equal(resolveParameterKey('Salinité maximale (EC)'), RANGE_KEYS.SALINITY);
  assert.equal(resolveParameterKey('Profondeur racinaire'), RANGE_KEYS.ROOT_DEPTH);
});

test('Paramètre : les clés techniques restent acceptées', () => {
  assert.equal(resolveParameterKey('ph'), RANGE_KEYS.PH);
  assert.equal(resolveParameterKey('airTemperatureC'), RANGE_KEYS.AIR_TEMPERATURE);
  assert.equal(resolveParameterKey('moisture'), RANGE_KEYS.SOIL_MOISTURE);
  assert.equal(resolveParameterKey('ec'), RANGE_KEYS.SALINITY);
  assert.equal(resolveParameterKey('depthCm'), RANGE_KEYS.ROOT_DEPTH);
});

test('Paramètre : la casse et les accents ne changent rien', () => {
  assert.equal(resolveParameterKey('PH DU SOL'), RANGE_KEYS.PH);
  assert.equal(resolveParameterKey('  humidité volumique du sol  '), RANGE_KEYS.SOIL_MOISTURE);
  assert.equal(resolveParameterKey('AİRTEMPERATUREC'), RANGE_KEYS.AIR_TEMPERATURE);
});

test('Paramètre : un libellé inconnu ne devine rien', () => {
  assert.equal(resolveParameterKey('Teneur en azote'), null);
  assert.equal(resolveParameterKey(''), null);
  assert.equal(resolveParameterKey(null), null);
});

/* ─────────────────────── Type de source ─────────────────────── */

test('Type de source : les trois valeurs du menu sont reconnues', () => {
  assert.equal(resolveSourceType('Agronome'), 'AGRONOMIST');
  assert.equal(resolveSourceType('Publication'), 'PUBLICATION');
  assert.equal(resolveSourceType('Pilote'), 'PILOT');
});

test('Type de source : « A choisir » est traité comme vide, pas comme un type', () => {
  assert.equal(resolveSourceType('A choisir'), null);
  assert.equal(resolveSourceType('À choisir'), null);
  assert.equal(resolveSourceType('a choisir'), null);
  assert.equal(resolveSourceType(''), null);
  assert.equal(resolveSourceType(null), null);
});

test('Type de source : une valeur hors menu est signalée, pas substituée', () => {
  // `undefined` = inconnue : le service doit la refuser, jamais la remplacer
  // par un type par défaut.
  assert.equal(resolveSourceType('Wikipédia'), undefined);
  assert.equal(resolveSourceType('Internet'), undefined);
});

test('Type de source : le menu ne contient aucune valeur prohibée', () => {
  const values = Object.values(SOURCE_TYPE_MENU).filter(Boolean);
  assert.deepEqual([...new Set(values)].sort(), ['AGRONOMIST', 'PILOT', 'PUBLICATION']);
});

/* ─────────────────────── Zone concernée ─────────────────────── */

test('Zone : les accents ne changent rien', () => {
  assert.equal(resolveZone('Équateur'), 'Equateur');
  assert.equal(resolveZone('Equateur'), 'Equateur');
  assert.equal(resolveZone('équateur'), 'Equateur');
  assert.equal(resolveZone('EQUATEUR'), 'Equateur');
  assert.equal(resolveZone('  Équateur  '), 'Equateur');
});

test('Zone : Bandundu est reconnu sans casse ni accent', () => {
  assert.equal(resolveZone('Bandundu'), 'Bandundu');
  assert.equal(resolveZone('bandundu'), 'Bandundu');
  assert.equal(resolveZone('BANDUNDU'), 'Bandundu');
  assert.equal(resolveZone('Bandundu '), 'Bandundu');
});

test('Zone : « Les deux » couvre les deux provinces, quelle que soit la casse', () => {
  assert.equal(resolveZone('Les deux'), 'Les deux');
  assert.equal(resolveZone('les deux'), 'Les deux');
  assert.equal(resolveZone('LES DEUX'), 'Les deux');
  assert.equal(resolveZone('les  deux'), 'Les deux');
});

test('Zone : une case vide reste vide', () => {
  assert.equal(resolveZone(''), null);
  assert.equal(resolveZone('   '), null);
  assert.equal(resolveZone(null), null);
  assert.equal(resolveZone(undefined), null);
});

test('Zone : une zone non reconnue est conservée, pas rejetée ni devinée', () => {
  // Un référentiel peut circonscrire une fourchette à un bassin ou à un type
  // de sol : ce n'est pas une province, et ce n'est pas une erreur.
  assert.equal(resolveZone('Bassin de la Ruki'), 'Bassin de la Ruki');
  assert.equal(resolveZone('Sables du Kalahari'), 'Sables du Kalahari');
});

test('Zone : les trois formes canoniques sont exactement celles des calendriers', () => {
  // Alignées sur `SUPPORTED_PROVINCES` : si le score filtre un jour par zone,
  // la comparaison pourra se faire sans renormaliser de part et d'autre.
  assert.deepEqual([...ZONE_CANONICAL], ['Equateur', 'Bandundu', 'Les deux']);
});

test('Zone : l’exemple du modèle laisse la zone vide', () => {
  // Une zone inventée dans un modèle serait recopiée telle quelle.
  assert.equal(IMPORT_EXAMPLE[10], '');
});

/* ─────────────────────── Lecture numérique ─────────────────────── */

test('Nombres : une case vide reste vide', () => {
  assert.equal(readNumber(''), null);
  assert.equal(readNumber('   '), null);
  assert.equal(readNumber(null), null);
  assert.equal(readNumber(undefined), null);
});

test('Nombres : la virgule décimale francophone est acceptée', () => {
  assert.equal(readNumber('4,5'), 4.5);
  assert.equal(readNumber('4.5'), 4.5);
});

test('Nombres : un texte non numérique ne devient pas 0', () => {
  assert.equal(readNumber('à définir'), null);
  assert.equal(readNumber('N/A'), null);
});

/* ─────────────────────── Résolution des colonnes ─────────────────────── */

test('Colonnes : les 15 en-têtes du tableau sont tous résolus', () => {
  const { columns, missing } = resolveImportColumns(IMPORT_HEADER);
  assert.deepEqual(missing, [], `colonnes manquantes : ${missing.join(', ')}`);
  for (const field of Object.keys(IMPORT_COLUMNS)) {
    assert.ok(columns[field], `le champ « ${field} » n'est pas résolu`);
  }
});

test('Colonnes : les en-têtes anglais sont résolus aussi', () => {
  const { columns, missing } = resolveImportColumns([
    'Crop', 'Scientific name', 'Parameter', 'Unit', 'Ideal min', 'Ideal max',
    'Tolerated min', 'Tolerated max', 'Source type', 'Precise source', 'Zone',
    'Status', 'Validated by', 'Validation date', 'Remarks',
  ]);
  assert.deepEqual(missing, []);
  assert.equal(columns.cropSlug, 'Crop');
  assert.equal(columns.toleratedMin, 'Tolerated min');
  assert.equal(columns.validatedAt, 'Validation date');
  assert.equal(columns.sourceNote, 'Remarks');
});

test('Colonnes : les colonnes obligatoires manquantes sont nommées', () => {
  const { missing } = resolveImportColumns(['Culture', 'Idéal min', 'Idéal max']);
  assert.deepEqual(missing.sort(), ['parameterKey', 'unit'].sort());
  assert.ok(REQUIRED_COLUMNS.includes('cropSlug'));
});

test('Colonnes : un fichier sans en-tête reconnu liste tout ce qui manque', () => {
  const { missing } = resolveImportColumns(['toto', 'titi']);
  assert.deepEqual(missing, [...REQUIRED_COLUMNS]);
});

/* ─────────────────────── Texte complet ─────────────────────── */

test('Texte : les lignes vides sont ignorées sans décaler les numéros', () => {
  const text = [
    'Culture;Paramètre;Unité;Idéal min;Idéal max',
    'manioc;pH du sol;pH;4.5;7.5',
    '',
    '   ',
    'mais;pH du sol;pH;5.5;7.0',
    '',
  ].join('\n');

  const { headerCells, rows } = parseCsvText(text);
  assert.equal(headerCells[0], 'Culture');
  assert.equal(rows.length, 2, 'deux lignes de données, les vides ignorées');
  // Les numéros correspondent au fichier tel qu'on le voit, pas à l'ordre de lecture.
  assert.equal(rows[0].lineNumber, 2);
  assert.equal(rows[1].lineNumber, 5);
});

test('Texte : les fins de ligne Windows sont acceptées', () => {
  const { rows } = parseCsvText('Culture;Paramètre\r\nmanioc;pH\r\n');
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].cells, ['manioc', 'pH']);
});

test('Texte : un fichier vide ne produit ni en-tête ni ligne', () => {
  assert.deepEqual(parseCsvText(''), { headerCells: [], rows: [] });
  assert.deepEqual(parseCsvText('\n\n  \n'), { headerCells: [], rows: [] });
});

/* ─────────────────────── Lecture d'une ligne ─────────────────────── */

test('Ligne : les 15 colonnes sont lues, les cases vides restent vides', () => {
  const { headerCells, rows } = parseCsvText([IMPORT_HEADER.join(';'), IMPORT_EXAMPLE.join(';')].join('\n'));
  const { indices } = resolveImportColumns(headerCells);
  const record = readImportRow(rows[0].cells, indices);

  assert.equal(record.cropSlug, 'exemple');
  assert.equal(record.scientificName, 'Exemplum fictivum');
  assert.equal(record.parameterKey, RANGE_KEYS.PH);
  assert.equal(record.unit, 'pH');
  assert.equal(record.minValue, 5.5);
  assert.equal(record.maxValue, 7.0);
  assert.equal(record.toleratedMin, 4.5);
  assert.equal(record.toleratedMax, 8.0);
  assert.equal(record.sourceType, 'AGRONOMIST');
  assert.equal(record.sourceReference, 'Exemple de format');
  // Cases vides du modèle : elles restent vides, rien n'est complété.
  assert.equal(record.zone, null);
  assert.equal(record.validatedBy, null);
  assert.equal(record.validatedAt, null);
  assert.equal(record.status, 'PROVISIONAL');
});

test('Ligne : la zone est ramenée à sa forme canonique', () => {
  const { headerCells, rows } = parseCsvText([
    IMPORT_HEADER.join(';'),
    'manioc;;pH du sol;pH;4.5;7.5;;;Publication;Revue X;équateur;PROVISIONAL;;;',
  ].join('\n'));
  const { indices } = resolveImportColumns(headerCells);
  const record = readImportRow(rows[0].cells, indices);

  assert.equal(record.zoneRaw, 'équateur');
  assert.equal(record.zone, 'Equateur');
});

test('Ligne : une colonne absente du fichier donne undefined, pas une valeur', () => {
  const { headerCells, rows } = parseCsvText(
    ['Culture;Paramètre;Unité;Idéal min;Idéal max', 'manioc;pH du sol;pH;4.5;7.5'].join('\n'),
  );
  const { indices } = resolveImportColumns(headerCells);
  const record = readImportRow(rows[0].cells, indices);

  assert.equal(record.cropSlug, 'manioc');
  // Ces colonnes n'existent pas dans le fichier : aucune valeur n'est inventée.
  assert.equal(record.toleratedMin, undefined);
  assert.equal(record.toleratedMax, undefined);
  assert.equal(record.sourceType, undefined);
  assert.equal(record.sourceTypeRaw, null);
  assert.equal(record.zone, undefined);
  assert.equal(record.zoneRaw, null);
  assert.equal(record.validatedBy, undefined);
});

test('Ligne : un paramètre non reconnu est signalé, pas approximé', () => {
  const { headerCells, rows } = parseCsvText(
    [IMPORT_HEADER.join(';'), 'manioc;;Teneur en azote;%;1;2;;;;;;;;;'].join('\n'),
  );
  const { indices } = resolveImportColumns(headerCells);
  const record = readImportRow(rows[0].cells, indices);

  assert.equal(record.parameterKey, null);
  assert.equal(record.parameterKeyAsWritten, 'Teneur en azote');
});

test('Ligne : le statut annoncé est lu en majuscules mais n’est pas appliqué ici', () => {
  const { headerCells, rows } = parseCsvText(
    [IMPORT_HEADER.join(';'), 'manioc;pH du sol;pH;4.5;7.5;;;;Publication;Revue X;Équateur;validated;Dr. Y;2026-01-01;'].join('\n'),
  );
  const { indices } = resolveImportColumns(headerCells);
  const record = readImportRow(rows[0].cells, indices);

  // Le lecteur ne fait que lire : c'est le service qui décide de ne pas valider.
  assert.equal(record.status, 'VALIDATED');
  assert.equal(record.validatedBy, 'Dr. Y');
  assert.equal(record.validatedAt, '2026-01-01');
});

/* ─────────────────────── Modèle ─────────────────────── */

test('Modèle : l’exemple a autant de cellules que l’en-tête', () => {
  assert.equal(IMPORT_HEADER.length, 15);
  assert.equal(IMPORT_EXAMPLE.length, 15);
});

test('Modèle : l’exemple est clairement fictif et ne cite aucune source réelle', () => {
  assert.equal(IMPORT_EXAMPLE[0], 'exemple');
  assert.equal(IMPORT_EXAMPLE[9], 'Exemple de format');
  const joined = IMPORT_EXAMPLE.join(' ').toLowerCase();
  assert.match(joined, /fictiv/);
});

test('Modèle : le CSV généré est relisible par le même lecteur', () => {
  const csv = buildTemplateCsv();
  assert.equal(csv.split('\n').length, 2);

  const { headerCells, rows } = parseCsvText(csv);
  const { indices, missing } = resolveImportColumns(headerCells);
  assert.deepEqual(missing, []);

  const record = readImportRow(rows[0].cells, indices);
  assert.equal(record.cropSlug, 'exemple');
  assert.equal(record.parameterKey, RANGE_KEYS.PH);
  assert.equal(record.toleratedMin, 4.5);
  assert.equal(record.toleratedMax, 8.0);
});

test('Modèle : chaque libellé français de paramètre figure bien dans la table', () => {
  for (const [key, labels] of Object.entries(PARAMETER_LABELS)) {
    for (const label of labels) {
      assert.equal(resolveParameterKey(label), key, `libellé « ${label} » non résolu`);
    }
  }
});

/* ─────── Instantané : `toRange` conserve ce qui permet de reproduire ─────── */

/**
 * `toRange` normalise une ligne de base vers la forme lue par le moteur.
 *
 * Il doit conserver l'identifiant, la version et le lot : ce sont les trois
 * champs qui permettent de retrouver **la ligne exacte** ayant servi à un
 * calcul, et donc de dire si une recommandation enregistrée est encore
 * reproductible ou si la plage a bougé depuis.
 */
test('toRange : l’identifiant, la version et le lot sont conservés', async () => {
  const { toRange } = await import('../src/modules/recommendation/agronomicRanges.js');
  const range = toRange({
    id: 'range-ph-001',
    parameterKey: 'ph',
    minValue: 5.0,
    maxValue: 6.0,
    toleratedMin: 4.5,
    toleratedMax: 8.0,
    unit: 'pH',
    status: 'PROVISIONAL',
    sourceType: 'PUBLICATION',
    sourceReference: 'Source de test',
    version: 3,
    datasetLabel: 'scoring',
  });

  assert.equal(range.id, 'range-ph-001');
  assert.equal(range.version, 3);
  assert.equal(range.datasetLabel, 'scoring');
  // Les quatre limites passent aussi : sans elles, rien n'est reproductible.
  assert.equal(range.min, 5.0);
  assert.equal(range.max, 6.0);
  assert.equal(range.toleratedMin, 4.5);
  assert.equal(range.toleratedMax, 8.0);
  assert.equal(range.sourceReference, 'Source de test');
});

test('toRange : une ligne sans identifiant ne casse pas le moteur', async () => {
  const { toRange } = await import('../src/modules/recommendation/agronomicRanges.js');
  const range = toRange({ parameterKey: 'ph', minValue: 5, maxValue: 6, unit: 'pH', status: 'PROVISIONAL' });
  assert.equal(range.id, null);
  assert.equal(range.version, null);
  assert.equal(range.datasetLabel, null);
});
