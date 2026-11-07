/**
 * Exigences CDC couvertes : I18N-03.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
/**
 * Référentiel des unités agricoles (PROD-02).
 * Les conversions sont centralisées ici : aucune conversion en dur dans les services.
 * Une unité locale (sac, régime, cuvette…) doit être définie dans le référentiel
 * `Country.units` / `Crop.units` pour être convertible ; sinon elle est stockée
 * telle quelle et `quantityKg` reste null (jamais de valeur inventée).
 */

const KG_FACTORS = {
  kg: 1,
  g: 0.001,
  tonne: 1000,
  t: 1000,
  quintal: 100,
  sac: 50, // valeur par défaut paramétrable par pays/culture
  litre: 1, // équivalence masse/volume uniquement pour l'eau ; à surcharger par culture
  l: 1,
};

export const KNOWN_UNITS = Object.keys(KG_FACTORS);

/**
 * Convertit une quantité vers les kilogrammes.
 * @param {number} quantity
 * @param {string} unit
 * @param {Record<string, number>} [overrides] table de conversion pays/culture (ex. { sac: 100 })
 * @returns {number|null} null si l'unité n'est pas convertible (on ne devine pas)
 */
export const toKilograms = (quantity, unit, overrides = {}) => {
  if (quantity === null || quantity === undefined) return null;
  const key = String(unit ?? '').trim().toLowerCase();
  const factor = overrides?.[key] ?? KG_FACTORS[key];
  if (!factor) return null;
  return Math.round(Number(quantity) * factor * 1000) / 1000;
};

export const isConvertible = (unit, overrides = {}) => {
  const key = String(unit ?? '').trim().toLowerCase();
  return Boolean(overrides?.[key] ?? KG_FACTORS[key]);
};
