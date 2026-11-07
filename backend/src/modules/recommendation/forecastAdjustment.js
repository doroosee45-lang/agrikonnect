/**
 * Ajustement des critères par la prévision — CDC : « noter les cultures
 * compatibles sur des plages idéales **ajustées par la prévision** ».
 *
 * Le problème que ce module résout : une recommandation porte sur une période
 * (60 jours), alors que l'état du sol est une photographie d'aujourd'hui.
 * Noter une culture sur la seule valeur du jour revient à ignorer ce qui va se
 * passer pendant le cycle.
 *
 * Trois règles, dans l'ordre d'importance :
 *
 *  1. **La prévision ne peut que durcir un critère, jamais l'assouplir.** Si le
 *     sol est mauvais aujourd'hui et prévu bon dans trois semaines, la culture
 *     n'est pas recommandable : on sème maintenant. Inversement, si la valeur
 *     du jour est conforme mais que la prévision la fait sortir de la plage
 *     pendant le cycle, le critère échoue.
 *  2. **On n'écarte pas une culture sur un écart plus petit que l'erreur
 *     déclarée du modèle.** Si la valeur prévue dépasse la borne de moins que
 *     le MAE, le franchissement est dans le bruit du modèle : le critère reste
 *     satisfait mais est signalé « à surveiller ». Éliminer sur du bruit serait
 *     plus nuisible que se tromper.
 *  3. **Une couverture partielle est dite, pas masquée.** Si la prévision couvre
 *     21 des 60 jours de la période, l'ajustement porte cette proportion et
 *     l'explication l'énonce.
 *
 * Module pur : aucune base, aucun effet de bord. Tout est testable en isolation.
 */

/**
 * Une prévision n'est exploitable que si elle bat la persistance.
 *
 * `false` **et** `null` refusent tous les deux : l'absence de preuve n'est pas
 * une preuve. C'est la même condition que celle du job d'alertes, pour qu'un
 * même enregistrement soit traité de la même manière partout.
 */
export const isUsablePrediction = (prediction) => prediction?.beatsBaseline === true;

const toTime = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : null;
};

const daysBetween = (from, to) => Math.max(0, (to - from) / 86_400_000);

/**
 * Retient les points de prévision qui tombent dans la fenêtre de semis.
 *
 * Les points déjà passés sont écartés : ils ne prédisent rien, ils constatent,
 * et relèvent du volet mesure.
 */
export const pointsInWindow = (prediction, { periodStart, periodEnd, now }) => {
  const start = Math.max(toTime(now) ?? 0, toTime(periodStart) ?? 0);
  const end = toTime(periodEnd);
  if (!Number.isFinite(end)) return [];

  return (prediction?.values ?? [])
    .map((point) => ({ ...point, time: toTime(point.at) }))
    .filter((point) => point.time !== null && point.time > start && point.time <= end)
    .sort((a, b) => a.time - b.time);
};

/**
 * Résume une prévision sur la fenêtre : extrêmes, couverture, incertitude.
 *
 * Rend `null` quand la prévision n'apporte rien sur la période — le critère
 * sera alors noté sur la seule mesure, et l'ajustement en dira le motif.
 */
export const summarizeWindow = (prediction, window) => {
  const points = pointsInWindow(prediction, window);
  if (points.length === 0) return null;

  let lowest = points[0];
  let highest = points[0];
  for (const point of points) {
    if (point.value < lowest.value) lowest = point;
    if (point.value > highest.value) highest = point;
  }

  /**
   * Étendue **temporelle** des points, et non écart entre les extrêmes de
   * valeur. `points` est trié par date : les deux bornes sont les premier et
   * dernier points. Les confondre avec `lowest`/`highest` (ordonnés par valeur)
   * donnerait une étendue négative, donc une couverture de 0 sur une série en
   * baisse — c'est-à-dire exactement le cas d'usage principal.
   */
  const spanDays = daysBetween(points[0].time, points.at(-1).time);

  const periodDays = daysBetween(
    Math.max(toTime(window.now) ?? 0, toTime(window.periodStart) ?? 0),
    toTime(window.periodEnd),
  );

  return {
    parameter: prediction.parameter,
    pointsUsed: points.length,
    /** Borne basse prévue, et sa date : c'est elle qui fait échouer un minimum. */
    predictedMin: lowest.value,
    predictedMinAt: lowest.at,
    predictedMax: highest.value,
    predictedMaxAt: highest.at,
    /**
     * L'intervalle à 95 % du point le plus pessimiste, quand le moteur a pu le
     * quantifier. `null` signifie « incertitude non quantifiable », pas « nulle ».
     */
    predictedMinLow: lowest.low ?? null,
    predictedMinHigh: lowest.high ?? null,
    predictedMaxLow: highest.low ?? null,
    predictedMaxHigh: highest.high ?? null,
    horizonDays: prediction.horizonDays,
    mae: Number.isFinite(prediction.mae) ? prediction.mae : null,
    rmse: Number.isFinite(prediction.rmse) ? prediction.rmse : null,
    baselineMae: Number.isFinite(prediction.baselineMae) ? prediction.baselineMae : null,
    modelVersionId: prediction.modelVersionId ?? null,
    computedAt: prediction.computedAt ?? null,
    periodDays: Number(periodDays.toFixed(2)),
    /**
     * Part de la période réellement couverte par la prévision. En dessous de 1,
     * l'ajustement ne parle que d'une partie du cycle — et le dit.
     */
    coverageRatio: periodDays > 0 ? Number(Math.min(1, spanDays / periodDays).toFixed(3)) : 0,
    simulated: prediction.mode === 'SIMULATED',
  };
};

/**
 * Construit les projections utilisables, par paramètre.
 *
 * Ne retient que les prévisions qui battent la persistance **et** qui apportent
 * au moins un point dans la fenêtre. Tout le reste est écarté avec son motif,
 * pour que l'absence d'ajustement soit traçable plutôt que silencieuse.
 */
export const buildProjections = (predictions, window) => {
  const projections = {};
  const skipped = [];

  for (const prediction of predictions ?? []) {
    if (!isUsablePrediction(prediction)) {
      skipped.push({
        parameter: prediction.parameter,
        reason: 'FORECAST_NOT_PROVEN',
        detail: 'La prévision ne bat pas la persistance : elle ne peut pas fonder une décision.',
      });
      continue;
    }
    const summary = summarizeWindow(prediction, window);
    if (!summary) {
      skipped.push({
        parameter: prediction.parameter,
        reason: 'NO_POINT_IN_PERIOD',
        detail: 'Aucun point prévu dans la période de semis demandée.',
      });
      continue;
    }
    projections[prediction.parameter] = summary;
  }

  return { projections, skipped };
};

/**
 * Applique une projection à un critère de plage.
 *
 * @returns {{met: boolean|null, downgraded: boolean, watch: object|null,
 *            reason: string|null, projection: object|null}}
 *          `met` vaut `null` quand le critère n'était pas évaluable : une
 *          prévision ne remplace pas une mesure manquante.
 */
export const applyProjection = ({ range, projection, measuredMet, measuredValue }) => {
  if (!projection || measuredMet === null || measuredMet === undefined) {
    return {
      met: measuredMet ?? null,
      downgraded: false,
      watch: null,
      reason: null,
      projection: null,
      scoredValue: measuredValue ?? null,
    };
  }

  const belowLimit = range?.min !== null && range?.min !== undefined
    && projection.predictedMin < range.min;
  const aboveLimit = range?.max !== null && range?.max !== undefined
    && projection.predictedMax > range.max;

  if (!belowLimit && !aboveLimit) {
    return {
      met: measuredMet,
      downgraded: false,
      watch: null,
      reason: null,
      projection,
      scoredValue: measuredValue ?? null,
    };
  }

  const direction = belowLimit ? 'BELOW' : 'ABOVE';
  const limit = belowLimit ? range.min : range.max;
  const projectedValue = belowLimit ? projection.predictedMin : projection.predictedMax;
  const projectedAt = belowLimit ? projection.predictedMinAt : projection.predictedMaxAt;
  const margin = Math.abs(projectedValue - limit);

  const breach = {
    direction,
    limit,
    projectedValue,
    projectedAt,
    margin: Number(margin.toFixed(4)),
    mae: projection.mae,
    unit: range?.unit ?? null,
  };

  /**
   * Sans erreur déclarée du modèle, impossible de dire si le franchissement est
   * réel ou du bruit : on ne durcit pas le critère, on le signale.
   */
  const robust = Number.isFinite(projection.mae) && margin > projection.mae;

  if (!robust) {
    return {
      met: measuredMet,
      downgraded: false,
      watch: { ...breach, cause: 'WITHIN_MODEL_ERROR' },
      reason: null,
      projection,
      // Franchissement non robuste : la valeur notée reste la mesure. Durcir
      // sur du bruit ferait varier le score au gré de l'erreur du modèle.
      scoredValue: measuredValue ?? null,
    };
  }

  /**
   * Valeur retenue pour la notation : la **plus défavorable** entre la mesure et
   * la prévision.
   *
   * C'est ce qui garantit l'invariant « une prévision ne peut que durcir un
   * score, jamais l'améliorer » : si la mesure est déjà pire que la prévision,
   * c'est elle qui est notée ; sinon c'est la prévision. Prendre
   * `projectedValue` seul pourrait **remonter** un score, ce qui ferait dire à
   * une prévision qu'une parcelle mesurée défavorable va s'arranger.
   */
  const worst = direction === 'BELOW'
    ? Math.min(Number.isFinite(measuredValue) ? measuredValue : projectedValue, projectedValue)
    : Math.max(Number.isFinite(measuredValue) ? measuredValue : projectedValue, projectedValue);

  return {
    // Une mesure déjà hors plage le reste : la prévision ne sauve rien.
    met: false,
    downgraded: measuredMet === true,
    watch: null,
    scoredValue: worst,
    reason:
      `Prévu hors plage pendant la période : ${projectedValue} ${range?.unit ?? ''} `
      + `${direction === 'BELOW' ? 'sous le minimum' : 'au-dessus du maximum'} de ${limit} `
      + `(marge ${breach.margin}, erreur du modèle ${projection.mae}).`,
    projection,
  };
};

/**
 * Reformule un ajustement en français, pour l'explication destinée à
 * l'agriculteur.
 *
 * Chaque nombre cité ici provient de `projection` ou de `breach`, donc des
 * données du moteur — aucune valeur n'est inventée au moment de la rédaction.
 */
export const describeAdjustment = (parameterLabel, projection, breach) => {
  const covered = `${projection.pointsUsed} point(s) prévu(s) sur ${projection.periodDays} jour(s) de période`;
  const partial = projection.coverageRatio < 1
    ? ` — la prévision ne couvre que ${Math.round(projection.coverageRatio * 100)} % de la période`
    : '';

  if (breach) {
    return (
      `${parameterLabel} : ${covered}${partial}. `
      + `Valeur prévue la plus défavorable ${breach.projectedValue} ${breach.unit ?? ''} `
      + `le ${new Date(breach.projectedAt).toISOString().slice(0, 10)}, `
      + `${breach.direction === 'BELOW' ? 'sous le minimum' : 'au-dessus du maximum'} de ${breach.limit}. `
      + `Marge ${breach.margin}, erreur du modèle ${breach.mae}.`
    );
  }

  return (
    `${parameterLabel} : ${covered}${partial}. Prévu entre ${projection.predictedMin} et `
    + `${projection.predictedMax} — dans la plage favorable sur toute la période.`
  );
};
