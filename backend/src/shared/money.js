/**
 * Exigences CDC couvertes : I18N-03.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
/**
 * Montants, devises et taux de change.
 *
 * BIL-02 / I18N-02 : un taux doit toujours être daté et sourcé.
 * On n'invente jamais de taux : sans taux fourni, la conversion est refusée.
 */

export const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
};

/**
 * @param {number} amount
 * @param {string} from devise source
 * @param {string} to devise cible
 * @param {{ value: number, date: string, source: string }} fxRate taux explicite
 */
export const convert = (amount, from, to, fxRate) => {
  if (from === to) return { amount: round(amount), fxRate: null };
  if (!fxRate || !fxRate.value || !fxRate.date || !fxRate.source) {
    return {
      amount: null,
      error:
        'Conversion impossible : aucun taux daté et sourcé fourni (BIL-02). Le montant reste dans sa devise d\'origine.',
    };
  }
  return {
    amount: round(Number(amount) * Number(fxRate.value)),
    fxRate: { value: fxRate.value, date: fxRate.date, source: fxRate.source },
  };
};

export const validFxRate = (fxRate) =>
  Boolean(fxRate && fxRate.value && fxRate.date && fxRate.source);
