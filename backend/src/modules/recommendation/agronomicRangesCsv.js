/**
 * Lecture du tableau « Plages agronomiques » au format CSV.
 *
 * Ce module est **pur** : aucune base, aucun Prisma, aucune requête. Il ne fait
 * que transformer du texte en enregistrements, ce qui permet de le tester
 * directement (guillemets, séparateurs, accents, alias, lignes vides).
 *
 * Deux principes guident la lecture :
 *  • **les cases vides restent vides.** Une colonne absente du fichier, ou une
 *    cellule vide, donne `null` — jamais une valeur par défaut. Inventer une
 *    limite tolérée pour compléter une ligne incomplète fausserait le score ;
 *  • **un import ne valide rien.** Le statut annoncé par le fichier est lu et
 *    conservé pour information, mais c'est la route de validation qui décide.
 */
import { RANGE_KEYS } from './agronomicRanges.js';

/**
 * Colonnes du tableau, avec leurs alias.
 *
 * Les en-têtes peuvent être en français ou en anglais ; la casse, les accents,
 * les espaces et la ponctuation sont ignorés.
 */
export const IMPORT_COLUMNS = Object.freeze({
  cropSlug: ['culture', 'cultureslug', 'crop', 'cropslug'],
  scientificName: ['nomscientifique', 'scientificname', 'nomlatin', 'latin'],
  parameterKey: ['parametre', 'parameterkey', 'parameter', 'cle', 'key'],
  unit: ['unite', 'unit'],
  minValue: ['idealmin', 'minideal', 'min', 'minvalue', 'bornemin', 'minimale'],
  maxValue: ['idealmax', 'maxideal', 'max', 'maxvalue', 'bornemax', 'maximale'],
  toleratedMin: ['toleremin', 'toleratedmin', 'tolmin', 'min toléré', 'borne tolérée min'],
  toleratedMax: ['toleremax', 'toleratedmax', 'tolmax', 'max toléré', 'borne tolérée max'],
  sourceType: ['typedesource', 'sourcetype', 'typeprovenance', 'provenance'],
  sourceReference: ['sourceprecise', 'sourcereference', 'source', 'reference'],
  zone: ['zoneconcernee', 'zone', 'region'],
  status: ['statut', 'status'],
  validatedBy: ['validepar', 'validatedby', 'validateur'],
  validatedAt: ['datedevalidation', 'datevalidation', 'validationdate', 'validatedat'],
  sourceNote: ['remarques', 'remarque', 'remarks', 'remark', 'sourcenote', 'note', 'commentaire', 'comment'],
});

/** Colonnes sans lesquelles une ligne n'a pas de sens. */
export const REQUIRED_COLUMNS = Object.freeze([
  'cropSlug',
  'parameterKey',
  'unit',
  'minValue',
  'maxValue',
]);

/** En-tête attendu, dans l'ordre du tableau. */
export const IMPORT_HEADER = Object.freeze([
  'Culture',
  'Nom scientifique',
  'Paramètre',
  'Unité',
  'Idéal min',
  'Idéal max',
  'Toléré min',
  'Toléré max',
  'Type de source',
  'Source précise',
  'Zone concernée',
  'Statut',
  'Validé par',
  'Date de validation',
  'Remarques',
]);

/**
 * Ligne d'exemple **clairement fictive**.
 *
 * Elle ne cite aucune source réelle : un exemple qui ressemblerait à une
 * référence publiée serait recopié tel quel et finirait en base comme une
 * provenance vérifiée.
 */
export const IMPORT_EXAMPLE = Object.freeze([
  'exemple',
  'Exemplum fictivum',
  'pH du sol',
  'pH',
  '5.5',
  '7.0',
  '4.5',
  '8.0',
  'Agronome',
  'Exemple de format',
  '',
  'PROVISIONAL',
  '',
  '',
  'Ligne d’exemple : valeurs fictives, à remplacer.',
]);

/**
 * Libellés français du paramètre, tels qu'ils figurent au tableau.
 *
 * Les clés techniques (`ph`, `ec`, `depthCm`…) restent acceptées : les deux
 * vocabulaires désignent la même chose et le fichier peut venir de l'un ou
 * l'autre.
 */
export const PARAMETER_LABELS = Object.freeze({
  [RANGE_KEYS.PH]: ['pH du sol', 'pH'],
  [RANGE_KEYS.AIR_TEMPERATURE]: ["Température de l'air", 'Température air', 'Température de l’air'],
  [RANGE_KEYS.SOIL_MOISTURE]: ['Humidité volumique du sol', 'Humidité du sol', 'Humidité volumique'],
  [RANGE_KEYS.SALINITY]: ['Salinité maximale (EC)', 'Salinité maximale', 'Salinité'],
  [RANGE_KEYS.ROOT_DEPTH]: ['Profondeur racinaire', 'Profondeur racinaire utile'],
});

/**
 * Valeurs réelles de la provenance.
 *
 * Trois valeurs, et seulement trois : un type par défaut attribué d'office
 * serait une provenance inventée, ce qui est précisément ce que le suivi de
 * source doit empêcher.
 */
export const SOURCE_TYPES = Object.freeze(['AGRONOMIST', 'PUBLICATION', 'PILOT']);

/** Libellés affichés, identiques à ceux du menu du tableau. */
export const SOURCE_TYPE_LABELS = Object.freeze({
  AGRONOMIST: 'Agronome',
  PUBLICATION: 'Publication',
  PILOT: 'Pilote',
});

/** Table inverse normalisée : libellé → clé technique. */
const PARAMETER_LOOKUP = (() => {
  const map = new Map();
  for (const [key, labels] of Object.entries(PARAMETER_LABELS)) {
    map.set(normalizeHeader(key), key);
    for (const label of labels) map.set(normalizeHeader(label), key);
  }
  return map;
})();

/**
 * Menu « Type de source » du formulaire.
 *
 * « A choisir » est la valeur non renseignée du menu : elle est traitée comme
 * vide, pas comme un type inconnu. Aucune valeur par défaut n'est substituée.
 */
export const SOURCE_TYPE_MENU = Object.freeze({
  'achoisir': null,
  'agronome': 'AGRONOMIST',
  'publication': 'PUBLICATION',
  'pilote': 'PILOT',
  // Formes techniques acceptées pour un appel direct à l'API.
  'agronomist': 'AGRONOMIST',
  'pilot': 'PILOT',
});

/**
 * Zones reconnues, sous leur forme canonique.
 *
 * Les deux provinces sont écrites **exactement** comme dans
 * `SUPPORTED_PROVINCES` (`cropCalendars.js`) : si un jour le score filtre par
 * zone, la comparaison pourra se faire sans renormaliser de part et d'autre.
 * « Les deux » couvre les deux provinces d'un même déploiement.
 */
export const ZONE_CANONICAL = Object.freeze(['Equateur', 'Bandundu', 'Les deux']);

/**
 * Ramène une zone à sa forme canonique, sans tenir compte des accents ni de la
 * casse : « Équateur », « Equateur », « équateur » et « EQUATEUR » donnent la
 * même valeur.
 *
 * Une zone non reconnue est **conservée telle quelle** (espaces retirés), pas
 * rejetée : un référentiel peut légitimement circonscrire une fourchette à un
 * bassin ou à un type de sol qui n'est pas une province. Inventer une
 * province par approximation serait pire que de garder ce qui est écrit.
 */
export function resolveZone(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const normalized = normalizeHeader(value);
  return ZONE_CANONICAL.find((candidate) => normalizeHeader(candidate) === normalized) ?? value;
}

/** Normalise un en-tête ou un libellé : sans casse, accent, espace ni ponctuation. */
export function normalizeHeader(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Découpe une ligne CSV en gérant guillemets doubles et échappements.
 *
 * Un découpage naïf casserait toute cellule contenant le séparateur — or
 * « Source précise » et « Remarques » sont précisément les colonnes où l'on
 * écrit des virgules.
 */
export function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        // `""` à l'intérieur d'un champ protégé = un guillemet littéral.
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',' || char === ';' || char === '\t') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

/**
 * Découpe un texte CSV en lignes numérotées.
 *
 * Les lignes vides sont ignorées mais **leur numéro est conservé** : un rapport
 * d'erreur qui dirait « ligne 3 » alors que le fichier en montre quatre serait
 * inutilisable pour retrouver l'endroit à corriger.
 */
export function parseCsvText(text) {
  const rawLines = String(text ?? '').split(/\r?\n/);
  const rows = [];
  let headerCells = null;

  rawLines.forEach((rawLine, index) => {
    if (rawLine.trim().length === 0) return;
    const cells = parseCsvLine(rawLine);
    if (headerCells === null) {
      headerCells = cells;
      return;
    }
    rows.push({ lineNumber: index + 1, cells });
  });

  return { headerCells: headerCells ?? [], rows };
}

/**
 * Associe chaque champ attendu à la colonne du fichier qui le porte.
 *
 * Retourne aussi la liste des colonnes obligatoires manquantes, pour que
 * l'erreur nomme ce qui manque au lieu de produire des lignes toutes invalides.
 */
export function resolveImportColumns(headerCells) {
  const byNormalized = new Map(headerCells.map((cell) => [normalizeHeader(cell), cell]));
  const columns = {};

  for (const [field, aliases] of Object.entries(IMPORT_COLUMNS)) {
    columns[field] = null;
    for (const alias of aliases) {
      const normalized = normalizeHeader(alias);
      if (byNormalized.has(normalized)) {
        columns[field] = byNormalized.get(normalized);
        break;
      }
    }
  }

  const missing = REQUIRED_COLUMNS.filter((field) => columns[field] === null);

  // Les index, et non les noms : `readImportRow` reçoit les cellules d'une
  // ligne de données, où le nom de l'en-tête n'apparaît évidemment pas.
  const indices = Object.fromEntries(
    Object.entries(columns).map(([field, name]) => [
      field,
      name === null ? -1 : headerCells.indexOf(name),
    ]),
  );

  return { columns, indices, missing, headerCells };
}

/** Résout un paramètre : libellé français du tableau ou clé technique. */
export function resolveParameterKey(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  return PARAMETER_LOOKUP.get(normalizeHeader(value)) ?? null;
}

/** Résout le type de source. « A choisir » et vide donnent `null`. */
export function resolveSourceType(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const normalized = normalizeHeader(value);
  if (!(normalized in SOURCE_TYPE_MENU)) return undefined; // valeur inconnue
  return SOURCE_TYPE_MENU[normalized];
}

/** Nombre décimal ou `null`. Une case vide reste vide. */
export function readNumber(raw) {
  const value = String(raw ?? '').trim();
  if (value === '') return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Transforme une ligne en enregistrement.
 *
 * `indices` vient de `resolveImportColumns` : c'est la position de chaque champ
 * dans l'en-tête, donc aussi dans chaque ligne de données.
 *
 * `undefined` signale « colonne absente du fichier » et `null` « cellule vide » :
 * les deux restent vides en sortie, mais la distinction permet au service de ne
 * pas écraser une valeur existante avec un champ que le fichier ne mentionnait
 * pas.
 */
export function readImportRow(cells, indices) {
  const cell = (field) => {
    const index = indices?.[field] ?? -1;
    if (index < 0) return undefined;
    const value = (cells[index] ?? '').trim();
    return value === '' ? null : value;
  };

  // `readNumber` renvoie `null` sur une cellule vide ; ici il faut garder
  // `undefined` quand la colonne est absente du fichier.
  const optionalNumber = (field) => {
    const raw = cell(field);
    return raw === undefined ? undefined : readNumber(raw);
  };

  const rawParameter = cell('parameterKey');
  const rawSourceType = cell('sourceType');
  const rawZone = cell('zone');
  const status = cell('status');

  return {
    cropSlug: cell('cropSlug'),
    scientificName: cell('scientificName'),
    // `undefined` = colonne absente, `null` = cellule vide : ne pas écraser
    // cette différence, le service s'en sert pour ne pas vider une valeur.
    parameterKey: rawParameter === undefined ? undefined : resolveParameterKey(rawParameter),
    parameterKeyAsWritten: rawParameter ?? null,
    unit: cell('unit'),
    minValue: optionalNumber('minValue'),
    maxValue: optionalNumber('maxValue'),
    toleratedMin: optionalNumber('toleratedMin'),
    toleratedMax: optionalNumber('toleratedMax'),
    sourceType: rawSourceType === undefined ? undefined : resolveSourceType(rawSourceType),
    // Valeur brute conservée : elle seule permet de distinguer « colonne
    // absente » d'« valeur hors menu », que `sourceType` confondrait.
    sourceTypeRaw: rawSourceType ?? null,
    sourceReference: cell('sourceReference'),
    // Colonne absente → `undefined` (on ne touche pas la valeur existante) ;
    // cellule vide → `null` ; sinon forme canonique.
    zone: rawZone === undefined ? undefined : resolveZone(rawZone),
    zoneRaw: rawZone ?? null,
    status: status ? String(status).toUpperCase() : null,
    validatedBy: cell('validatedBy'),
    validatedAt: cell('validatedAt'),
    sourceNote: cell('sourceNote'),
  };
}

/**
 * Construit le texte du modèle téléchargeable.
 *
 * Séparateur `;` : c'est celui que produit un tableur francophone, et il évite
 * d'avoir à protéger chaque cellule contenant une virgule.
 */
export function buildTemplateCsv() {
  return [IMPORT_HEADER.join(';'), IMPORT_EXAMPLE.join(';')].join('\n');
}
