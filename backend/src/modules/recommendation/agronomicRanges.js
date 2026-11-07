/**
 * Référentiel agronomique — clés, règles d'usage.
 *
 * **Aucune valeur n'est codée en dur ici.** Les plages vivent en base
 * (`CropAgronomicRange`) et sont alimentées soit par l'import CSV du tableau
 * « Plages agronomiques », soit par un admin via les routes dédiées.
 *
 * Pourquoi ce choix : une plage saisie « de mémoire » dans le code n'a ni
 * source citable ni validateur, et elle survivrait silencieusement à tout
 * changement de référentiel. Le moteur traite donc un paramètre sans plage en
 * base comme **non évalué**, jamais comme favorable.
 *
 * Ce module ne contient que ce qui est structurel : les clés de paramètre,
 * les critères éliminatoires, et les prédicats qui décident si une plage est
 * utilisable.
 */
import { SOIL_PARAMETER_KEYS } from '../soil/soil.schema.js';

/**
 * Clés de paramètre.
 *
 * Elles reprennent **le vocabulaire existant** du système : les `key` des
 * analyses de sol (`SOIL_PARAMETER_KEYS`, `src/modules/soil/soil.schema.js`),
 * que `fuseProfile()` conserve tels quels. Les inventer ici — par exemple
 * « salinityDsm » au lieu de « ec » — créerait un référentiel que le moteur ne
 * saurait jamais rapprocher des mesures réelles.
 */
export const RANGE_KEYS = Object.freeze({
  PH: 'ph',
  /**
   * Température de l'**AIR** en °C.
   *
   * Attention : une fourchette de température issue d'un référentiel
   * générique porte sur la température de l'**air**, pas sur celle du sol. Les
   * deux diffèrent de plusieurs degrés et ne sont pas interchangeables —
   * `sourceNote` doit le rappeler sur chaque plage concernée, et l'explication
   * de la recommandation le reprend.
   *
   * Ce n'est pas un paramètre d'analyse de sol mais une métrique de sonde
   * (`SensorReading.metric`, champ libre) : la température de l'air vient de
   * la station météo de l'exploitation, jamais d'une analyse pédologique.
   */
  AIR_TEMPERATURE: 'airTemperatureC',
  /** Humidité volumique du sol en % — source principale : sonde, puis Sentinel-1. */
  SOIL_MOISTURE: 'moisture',
  /** Salinité (conductivité électrique) en dS/m — critère éliminatoire. */
  SALINITY: 'ec',
  /** Profondeur racinaire utile en cm. */
  ROOT_DEPTH: 'depthCm',
});

/**
 * Garde de cohérence avec le vocabulaire du module sol.
 *
 * Le moteur lit l'état du sol produit par `fuseProfile()`, dont les clés sont
 * celles de `SoilParameter.key`. Si `RANGE_KEYS` s'en écarte, les mesures
 * existent en base mais ne sont jamais appariées aux plages : le critère
 * remonte « non évalué » et le moteur semble fonctionner alors qu'il ignore
 * la donnée. Ce contrôle échoue au démarrage plutôt que de laisser passer.
 *
 * Seule `airTemperatureC` est hors liste, volontairement : c'est une métrique
 * de sonde, pas un paramètre d'analyse de sol.
 */
const SOIL_VOCABULARY_EXCEPTIONS = new Set([RANGE_KEYS.AIR_TEMPERATURE]);
for (const [name, key] of Object.entries(RANGE_KEYS)) {
  if (SOIL_VOCABULARY_EXCEPTIONS.has(key)) continue;
  if (!SOIL_PARAMETER_KEYS.includes(key)) {
    throw new Error(
      `RANGE_KEYS.${name} = « ${key} » n'appartient pas au vocabulaire des analyses de sol `
      + `(${SOIL_PARAMETER_KEYS.join(', ')}). Le moteur ne pourrait jamais apparier cette mesure.`,
    );
  }
}

/** Unité attendue par paramètre : sert à valider un import ou une saisie. */
export const RANGE_UNITS = Object.freeze({
  [RANGE_KEYS.PH]: 'pH',
  [RANGE_KEYS.AIR_TEMPERATURE]: '°C',
  [RANGE_KEYS.SOIL_MOISTURE]: '%',
  // `ec` est une conductivité électrique : l'unité usuelle est le dS/m.
  [RANGE_KEYS.SALINITY]: 'dS/m',
  [RANGE_KEYS.ROOT_DEPTH]: 'cm',
});

/** Libellé lisible, pour l'explication en français. */
export const RANGE_LABELS = Object.freeze({
  [RANGE_KEYS.PH]: 'pH du sol',
  [RANGE_KEYS.AIR_TEMPERATURE]: 'température de l’air',
  [RANGE_KEYS.SOIL_MOISTURE]: 'humidité volumique du sol',
  [RANGE_KEYS.SALINITY]: 'salinité du sol (conductivité électrique)',
  [RANGE_KEYS.ROOT_DEPTH]: 'profondeur racinaire',
});

/** Critères dont le dépassement écarte la culture — s'ils peuvent être évalués. */
export const ELIMINATION_KEYS = Object.freeze([RANGE_KEYS.SALINITY]);

/**
 * Une plage est-elle utilisable ?
 *
 * Incomplet = bornes manquantes, bornes inversées, ou statut absent. Dans ces
 * cas le moteur répond « critère non évalué » plutôt que de deviner.
 */
export const isRangeUsable = (range) =>
  Boolean(range) &&
  Number.isFinite(range.minValue ?? range.min) &&
  Number.isFinite(range.maxValue ?? range.max) &&
  Boolean(range.status) &&
  range.status !== 'RETIRED' &&
  (range.minValue ?? range.min) <= (range.maxValue ?? range.max);

/** Normalise une ligne de base vers la forme attendue par le moteur. */
export const toRange = (row) =>
  row
    ? {
        /**
         * Identifiant de la ligne. Il sert à l'instantané enregistré avec la
         * recommandation : sans lui, on ne peut pas retrouver la plage exacte
         * qui a servi au calcul, ni dire si elle a été modifiée depuis.
         */
        id: row.id ?? null,
        key: row.parameterKey,
        min: row.minValue,
        max: row.maxValue,
        /** Version de la ligne : distingue deux corrections successives. */
        version: row.version ?? null,
        /** Lot de référentiel (`production`, `scoring`, …). */
        datasetLabel: row.datasetLabel ?? null,
        // Bornes tolérées, `null` quand elles ne sont pas renseignées : le
        // moteur retombe alors sur un verdict binaire, il n'invente rien.
        toleratedMin: row.toleratedMin ?? null,
        toleratedMax: row.toleratedMax ?? null,
        unit: row.unit,
        status: row.status,
        sourceType: row.sourceType ?? null,
        sourceReference: row.sourceReference ?? null,
        sourceNote: row.sourceNote ?? null,
        scientificName: row.scientificName ?? null,
        zone: row.zone ?? null,
        validatedBy: row.validatedBy ?? null,
        validatedAt: row.validatedAt ?? null,
      }
    : null;

/**
 * Les quatre limites sont-elles toutes renseignées ?
 *
 * Il en faut **quatre**, pas trois : avec une seule borne tolérée, on ne peut
 * calculer une décroissance que d'un côté, et compléter l'autre serait une
 * invention.
 */
export const hasToleratedBounds = (range) =>
  Number.isFinite(range?.toleratedMin) && Number.isFinite(range?.toleratedMax);

/**
 * Score d'**adéquation** d'une valeur mesurée à une plage agronomique.
 *
 * Ce n'est **ni un rendement ni une probabilité de réussite** : c'est la mesure
 * dans laquelle une valeur observée convient à une culture, d'après des
 * fourchettes de référence. Un score de 1 ne promet pas une récolte, et un score
 * de 0 ne prouve pas l'échec — les fourchettes elles-mêmes portent un statut
 * (`PROVISIONAL` / `VALIDATED`) qui borne la confiance qu'on peut leur accorder.
 *
 * Notation, quand les quatre limites existent :
 *
 * ```
 *  toléré min      idéal min            idéal max      toléré max
 *      │               │                    │               │
 *      0 ─────────── 1 ═══════════════════ 1 ──────────── 0
 *         décroissance     plein accord        décroissance
 * ```
 *
 * **Si une seule borne tolérée manque, ou les deux, la fonction retombe sur un
 * verdict binaire** — dans la plage idéale ou non. Aucune limite n'est
 * inventée pour « compléter » la plage : une frontière que personne n'a
 * mesurée produirait un score qui semblerait gradué sans l'être.
 *
 * @returns {{ mode: 'GRADED'|'BINARY', score: number, met: boolean }|null}
 *   `null` si la valeur n'est pas numérique.
 */
/**
 * @param {object} range Plage agronomique.
 * @param {number} value Valeur à noter.
 * @param {object} [options]
 * @param {boolean} [options.allowGraded=true] `false` pour imposer le verdict
 *   binaire même quand les quatre limites existent. C'est ce qui permet à une
 *   version du moteur notant en binaire (1.0) de rester fidèle à sa règle : sans
 *   ce paramètre, la présence de bornes tolérées en base suffirait à changer le
 *   calcul d'une version qui n'est pas censée en tenir compte.
 */
export const adequacyScore = (range, value, { allowGraded = true } = {}) => {
  if (!range || !Number.isFinite(value)) return null;

  const { min, max } = range;
  const met = value >= min && value <= max;

  if (!allowGraded || !hasToleratedBounds(range)) {
    // Verdict binaire : comportement antérieur, inchangé.
    return { mode: 'BINARY', score: met ? 1 : 0, met };
  }

  if (met) return { mode: 'GRADED', score: 1, met: true };

  if (value < min) {
    // Bande de décroissance de largeur nulle : toute valeur sous l'idéal est
    // déjà hors du toléré. Diviser par zéro donnerait `Infinity`, pas 0.
    const band = min - range.toleratedMin;
    if (band <= 0 || value <= range.toleratedMin) {
      return { mode: 'GRADED', score: 0, met: false };
    }
    return { mode: 'GRADED', score: (value - range.toleratedMin) / band, met: false };
  }

  const band = range.toleratedMax - max;
  if (band <= 0 || value >= range.toleratedMax) {
    return { mode: 'GRADED', score: 0, met: false };
  }
  return { mode: 'GRADED', score: (range.toleratedMax - value) / band, met: false };
};

/**
 * Au moins une plage provisoire a-t-elle servi ?
 * Détermine l'étiquette « indicative » de la recommandation.
 */
export const hasProvisionalRange = (ranges) =>
  Object.values(ranges ?? {}).some(
    (range) => isRangeUsable(range) && range.status === 'PROVISIONAL',
  );

/** Bornes physiques plausibles : un import corrompu doit être refusé, pas enregistré. */
export const PHYSICAL_BOUNDS = Object.freeze({
  [RANGE_KEYS.PH]: { min: 0, max: 14 },
  [RANGE_KEYS.AIR_TEMPERATURE]: { min: -20, max: 60 },
  [RANGE_KEYS.SOIL_MOISTURE]: { min: 0, max: 100 },
  [RANGE_KEYS.SALINITY]: { min: 0, max: 100 },
  [RANGE_KEYS.ROOT_DEPTH]: { min: 0, max: 5000 },
});
