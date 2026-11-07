/**
 * Libellés français des alertes, portés par l'API.
 *
 * ## Pourquoi ici et pas dans les écrans
 *
 * `list` et `get` renvoyaient les lignes Prisma brutes : `sourceType`,
 * `severity` et `status` arrivaient sous forme de codes d'enum
 * (`MEASUREMENT`, `WARNING`, `NEW`). Les écrans n'avaient alors que deux
 * options : afficher le code brut, ou **recopier une table de libellés** — avec
 * le même défaut qu'à l'écran 2 : une valeur d'enum ajoutée plus tard
 * n'apparaît nulle part, sans erreur.
 *
 * En portant les libellés côté serveur, une valeur nouvelle est nommée dès
 * qu'elle existe dans la table, et les deux clients affichent la même chose.
 *
 * Les libellés de grandeurs viennent de `RANGE_LABELS` (`agronomicRanges.js`),
 * **déjà utilisé par le moteur de recommandation** : une seconde table ici
 * divergerait de celle que l'agriculteur voit sur l'écran de recommandations.
 */
import { RANGE_LABELS } from '../recommendation/agronomicRanges.js';

/**
 * Source de l'alerte.
 *
 * `SENSOR_SILENCE` n'est pas une mauvaise mesure : c'est une **absence** de
 * remontée. Le libellé le dit, parce que « capteur silencieux » et « mesure
 * hors plage » n'appellent pas la même action.
 */
export const SOURCE_TYPE_LABELS = Object.freeze({
  MEASUREMENT: 'Mesure',
  FORECAST: 'Prévision',
  SENSOR_SILENCE: 'Capteur silencieux',
});

export const SEVERITY_LABELS = Object.freeze({
  INFO: 'Information',
  WARNING: 'Avertissement',
  CRITICAL: 'Critique',
});

export const STATUS_LABELS = Object.freeze({
  NEW: 'Nouvelle',
  READ: 'Lue',
  HANDLED: 'Traitée',
});

/**
 * Libellé d'une grandeur surveillée.
 *
 * `sensorSilence` est un cas particulier : ce n'est pas une grandeur agronomique
 * mais le paramètre synthétique des capteurs silencieux. Il n'est donc pas dans
 * `RANGE_LABELS` et est traité ici.
 */
export const parameterLabel = (parameter) =>
  parameter === 'sensorSilence'
    ? 'Délai depuis la dernière remontée'
    : RANGE_LABELS[parameter] ?? parameter;

/** Unité affichée, quand elle est connue. */
export const parameterUnit = (parameter, range = null) => {
  if (range?.unit) return range.unit;
  if (parameter === 'sensorSilence') return 'h';
  return null;
};

/**
 * Formate une plage pour l'affichage.
 *
 * Renvoie `null` quand la plage est inconnue : un écran qui n'a pas de plage
 * doit pouvoir le dire plutôt qu'afficher « null — null ».
 *
 * @param {{min?: number, max?: number, unit?: string}} [range]
 * @returns {string|null}
 */
export const formatRange = (range) => {
  if (!range || range.min === undefined || range.min === null) return null;
  const unite = range.unit ? ` ${range.unit}` : '';
  // Une borne supérieure absente sur un critère « au moins » est réelle, pas un manque.
  if (range.max === undefined || range.max === null) return `≥ ${range.min}${unite}`;
  if (range.min === range.max) return `${range.min}${unite}`;
  return `${range.min} – ${range.max}${unite}`;
};

/**
 * Enrichit une alerte de ses libellés et de sa plage.
 *
 * **Additif** : tous les champs d'origine sont conservés, rien n'est renommé.
 * Un appelant existant qui lit `alert.status` continue de fonctionner.
 *
 * @param {object} alert — ligne `ThresholdAlert`.
 * @param {object} [options]
 * @param {object|null} [options.range] — plage issue des `thresholds` de la
 *   recommandation liée : `{ min, max, unit, rangeStatus, derivedFrom }`.
 * @returns {object}
 */
export const describeAlert = (alert, { range = null } = {}) => {
  if (!alert) return alert;
  const plage = range ?? null;
  const unite = parameterUnit(alert.parameter, plage);

  return {
    ...alert,
    sourceTypeLabel: SOURCE_TYPE_LABELS[alert.sourceType] ?? alert.sourceType,
    severityLabel: SEVERITY_LABELS[alert.severity] ?? alert.severity,
    statusLabel: STATUS_LABELS[alert.status] ?? alert.status,
    parameterLabel: parameterLabel(alert.parameter),
    /** Unité de la grandeur, pour que « 6,1 » ne soit pas un nombre nu. */
    unit: unite,
    /**
     * Plage de référence, quand la recommandation liée en porte une.
     *
     * `null` est une information : sans plage, on ne peut pas dire si la valeur
     * observée est hors bornes — seulement qu'un seuil a été franchi.
     */
    range: plage
      ? {
          min: plage.min ?? null,
          max: plage.max ?? null,
          unit: plage.unit ?? null,
          label: formatRange(plage),
          /**
           * `PROVISIONAL` ou `VALIDATED`. Une alerte fondée sur une plage
           * provisoire doit le dire : le seuil franchi n'est pas encore un
           * seuil validé.
           */
          status: plage.rangeStatus ?? null,
          derivedFrom: plage.derivedFrom ?? null,
        }
      : null,
    /** Valeur observée formatée, ou `null` si l'alerte n'en porte pas. */
    observedLabel:
      alert.observedValue === null || alert.observedValue === undefined
        ? null
        : `${alert.observedValue}${unite ? ` ${unite}` : ''}`,
    /** Seuil de référence formaté. */
    referenceLabel: `${alert.referenceValue}${unite ? ` ${unite}` : ''}`,
    /**
     * Une alerte préventive annonce un franchissement **estimé** : la valeur
     * observée n'existe pas encore. L'écran doit pouvoir distinguer les deux
     * sans déduire cela de `observedValue === null`.
     */
    predictive: alert.predictive === true,
  };
};

/**
 * Valeurs de filtre acceptées par `GET /alerts`, **avec leur libellé**.
 *
 * Un écran qui construit ses filtres a besoin de nommer les valeurs de l'enum.
 * Sans cette route il devrait recopier `MEASUREMENT → « Mesure »` — exactement
 * le défaut que les libellés portés par l'API visent à supprimer : une valeur
 * d'enum ajoutée plus tard apparaîtrait dans les données sans jamais pouvoir
 * être filtrée, et sans erreur.
 *
 * Les libellés viennent des mêmes tables que ceux des alertes : impossible de
 * voir un filtre nommé autrement que les alertes qu'il filtre.
 *
 * `open` n'y figure pas comme valeur distincte : c'est un booléen, et il est
 * **exclusif** de `status` (`listAlertsQuery` renvoie 422 sinon).
 */
export const describeAlertFilters = () =>
  Object.freeze({
    sourceTypes: Object.freeze(
      Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => Object.freeze({ value, label })),
    ),
    severities: Object.freeze(
      Object.entries(SEVERITY_LABELS).map(([value, label]) => Object.freeze({ value, label })),
    ),
    statuses: Object.freeze(
      Object.entries(STATUS_LABELS).map(([value, label]) => Object.freeze({ value, label })),
    ),
  });
