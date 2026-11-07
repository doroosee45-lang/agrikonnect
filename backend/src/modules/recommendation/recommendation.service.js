/**
 * Moteur de recommandation culturale — quoi semer sur une période donnée.
 *
 * Portée : RDC uniquement (Équateur, Bandundu). Aucune abstraction multi-pays.
 *
 * Principes non négociables, hérités du CDC et du module Soil :
 *  1. **Aucune donnée inventée.** Une plage agronomique sans source fiable est
 *     vide ; le critère est alors « non évalué » et ne compte ni pour ni contre.
 *  2. **Explicable.** Chaque culture classée porte la décomposition critère par
 *     critère : ce qui la favorise, ce qui la pénalise, ce qui n'a pas pu être
 *     vérifié.
 *  3. **Indicatif tant que le référentiel n'est pas validé.** Calendriers et
 *     plages sont PROVISIONAL : la réponse de l'API le dit.
 *  4. **Un satellite ne mesure pas le sous-sol.** Sentinel-1 complète les zones
 *     sans sonde, en confiance faible, jamais en substitution.
 *  5. **Cloisonnement par organisation** sur chaque accès.
 *
 * Ce module **réutilise** l'évaluation de critères du module Soil
 * (`evaluateCriterion`, `fuseProfile`) plutôt que de la recopier : deux
 * implémentations divergeraient silencieusement.
 */
import { prisma } from '../../config/prisma.js';
import { excludedReadingIds } from '../anomalies/anomalies.service.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { assertOwnership } from '../../middleware/tenant.js';
import { audit } from '../../shared/audit.js';
import { env } from '../../config/env.js';
import { assertDataModeAllowed, dataModeLabel } from '../../shared/dataMode.js';
import {
  evaluateCriterion,
  fuseProfile,
  MIN_COVERAGE,
  SOURCE_PRIORITY,
} from '../soil/intelligence.service.js';
import { applyProjection, buildProjections } from './forecastAdjustment.js';
import {
  COMBINATION_RULES,
  DEFAULT_ENGINE_VERSION,
  ENGINE_VERSIONS,
  combineScores,
  describeEngine,
  resolveEngineVersion,
} from './engineVersions.js';
import {
  cropsPlantableInMonths,
  isCalendarValidated,
  resolveCalendar,
  SUPPORTED_PROVINCES,
} from './cropCalendars.js';
import {
  ELIMINATION_KEYS,
  hasProvisionalRange,
  isRangeUsable,
  RANGE_KEYS,
  RANGE_LABELS,
  adequacyScore,
} from './agronomicRanges.js';
import { rangesForCrops } from './agronomicRanges.service.js';
import {
  MOISTURE_INDEXES,
  PRIMARY_MOISTURE_SOURCE,
  resolveMoistureSource,
  SUBSURFACE_CAVEAT,
} from '../../config/satellite.js';

/** Version de la méthode de calcul : toute recommandation la porte. */
export const METHOD_VERSION = 'recommendation-v1';

/**
 * Ce qu'est un score, et ce qu'il n'est pas.
 *
 * Répété dans l'API et dans l'explication destinée à l'agriculteur : un nombre
 * entre 0 et 1 se lit facilement comme une chance de réussite, et ce serait une
 * promesse que le moteur ne peut pas tenir.
 */
export const SCORE_NOTICE =
  'Le score mesure l’adéquation entre l’état mesuré de la parcelle et les fourchettes '
  + 'agronomiques de référence. Ce n’est ni un rendement attendu, ni une probabilité de réussite.';

/**
 * Libellé français d'un critère, tel qu'il doit apparaître dans l'explication.
 *
 * L'explication est lue par l'agriculteur : elle ne doit pas exposer les noms
 * de champs (`airTemperatureC`) mais des grandeurs nommées. Le repli sur la clé
 * brute ne sert qu'à ne jamais produire un libellé vide si une clé nouvelle
 * apparaît sans libellé — ce que `tests/recommendation.test.mjs` signale.
 */
const labelOf = (key) => RANGE_LABELS[key] ?? key;

/**
 * Mise en garde air ≠ sol.
 *
 * Les fourchettes de température issues d'un référentiel générique portent
 * sur la température de l'**air**. Une
 * température de sol diffère de plusieurs degrés et ne peut pas la remplacer :
 * les deux ne sont jamais mélangées par le moteur (il apparie `airTemperatureC`
 * uniquement à une lecture de station météo portant cette même métrique). Quand
 * ce critère participe au classement, l'explication le dit explicitement.
 */
export const AIR_VS_SOIL_CAVEAT =
  'La température évaluée est celle de l’air, relevée par la station météo : '
  + 'ce n’est pas une température de sol, et les deux diffèrent de plusieurs degrés.';

/**
 * Durée maximale d'une période de semis, en jours.
 *
 * Au-delà d'une campagne, le classement ne correspond plus à aucune fenêtre de
 * semis réelle. La constante est partagée avec le schéma de route pour que les
 * deux couches refusent exactement la même chose.
 */
export const MAX_PERIOD_DAYS = 365;

/**
 * Nombre minimal de critères effectivement évalués pour oser classer une culture.
 *
 * Une couverture de 100 % sur un seul critère (le pH, seul renseigné dans le
 * référentiel provisoire) ne justifie pas une recommandation de semis. Le
 * moteur préfère dire « pas assez de critères » que classer sur une base aussi
 * étroite.
 */
export const MIN_EVALUATED_CRITERIA = 2;

/**
 * État du sol par paramètre, construit à partir des mesures réelles.
 *
 * Ordre de confiance : sonde et laboratoire d'abord (via `fuseProfile`, qui
 * applique déjà la priorité de source), puis les mesures de sonde horodatées,
 * enfin le satellite — et seulement pour l'humidité, et seulement en surface.
 */
/**
 * Construit l'état du sol d'une parcelle (mesures fusionnées, par paramètre).
 *
 * Exporté pour le job d'alertes : la surveillance doit comparer les seuils à
 * **exactement** le même état que celui qui a servi au calcul. Une seconde
 * construction, même proche, ferait diverger seuils et observations.
 */
export const buildSoilState = async (plot, plotId) => {
  const profile = await fuseProfile(plotId);
  const state = {};
  for (const [key, parameter] of Object.entries(profile.parameters ?? {})) {
    state[key] = {
      value: parameter.numericValue ?? parameter.value,
      unit: parameter.unit,
      source: parameter.source,
      confidence: parameter.confidence ?? 'medium',
      measuredAt: parameter.measuredAt,
      depthCm: null,
      origin: 'soil-assessment',
      mode: 'REAL',
    };
  }

  // Mesures de sonde : la profondeur compte. On retient la plus récente par
  // (paramètre, profondeur), et la plus proche de 30 cm comme valeur de surface.
  // Mesures signalées comme anomalies et non réhabilitées par un agronome.
  const excludedReadings = await excludedReadingIds(plotId);
  const readings = await prisma.sensorReading.findMany({
    where: {
      plotId,
      mode: { not: 'SIMULATED' },
      ...(excludedReadings.length > 0 ? { id: { notIn: excludedReadings } } : {}),
    },
    orderBy: { at: 'desc' },
    take: 500,
  });
  for (const reading of readings) {
    const key = reading.metric;
    const candidate = {
      value: reading.value,
      unit: reading.unit,
      source: reading.source ?? 'measured_sensor',
      confidence: reading.confidence ?? 'high',
      measuredAt: reading.at,
      depthCm: reading.depthCm ?? null,
      origin: 'sensor',
      mode: reading.mode ?? 'REAL',
      deviceId: reading.deviceId,
    };
    const existing = state[key];
    /**
     * Une sonde prime sur une analyse déclarée, et **à provenance égale la
     * mesure la plus fraîche prime**.
     *
     * La comparaison est stricte (`<`) et c'est délibéré : `readings` est trié
     * par date décroissante, donc la valeur en place est toujours plus récente
     * que le candidat. Avec `<=`, une provenance de même priorité écrasait la
     * valeur à chaque itération et la boucle terminait sur la mesure la plus
     * **ancienne** — l'inverse exact de l'intention affichée. Le classement et
     * les seuils d'alerte reposaient alors sur une photographie périmée.
     */
    if (!existing || (SOURCE_PRIORITY[candidate.source] ?? 99) < (SOURCE_PRIORITY[existing.source] ?? 99)) {
      state[key] = candidate;
    }
  }

  /**
   * Complément satellite **inclus ici**, et non après coup dans
   * `createRecommendation`.
   *
   * Le job d'alertes appelle cette même fonction en affirmant construire le même
   * état que le calcul. Tant que le comblement satellite restait dans
   * `createRecommendation`, cette affirmation était fausse : la surveillance
   * ignorait toute scène satellite, réelle comprise — donc aussi toute parcelle
   * sans sonde, précisément celles que le satellite est censé couvrir. Le
   * filtre `mode: { not: 'SIMULATED' }` s'applique alors aux deux appelants.
   */
  const satellite = await fillMoistureFromSatellite(plotId, state);

  return { state, readingsUsed: readings.length, satellite };
};

/**
 * Complète l'humidité manquante avec le satellite.
 *
 * Sentinel-1 (radar) est la source principale : les nuages fréquents de la zone
 * rendent l'optique peu exploitable. La valeur est marquée `confidence: 'low'`
 * et `source: 'satellite'` — elle ne remplace jamais une sonde.
 */
const fillMoistureFromSatellite = async (plotId, state) => {
  if (state[RANGE_KEYS.SOIL_MOISTURE]) {
    return { filled: false, reason: 'Une mesure de sonde existe : le satellite n’est pas utilisé.' };
  }

  /**
   * Filtré sur les index d'humidité : `value` n'a de sens que par rapport à
   * `index`, dont la valeur par défaut est NDVI. Prendre un NDVI pour un
   * pourcentage d'humidité donnerait un chiffre plausible et faux.
   */
  const observation = await prisma.satelliteObservation.findFirst({
    where: { plotId, index: { in: [...MOISTURE_INDEXES] }, mode: { not: 'SIMULATED' } },
    orderBy: { observedAt: 'desc' },
  });

  const resolved = resolveMoistureSource({
    cloudCoverPct: observation?.cloudCover ?? null,
    availableSource: observation?.provider ?? null,
  });

  if (!observation) {
    /**
     * Distinguer « rien » de « uniquement du simulé ».
     *
     * Dire « aucune observation » quand des scènes existent mais sont simulées
     * masquerait une donnée délibérément écartée. Le CDC exige que l'insuffisance
     * soit énoncée, pas passée sous silence : l'agriculteur doit pouvoir voir
     * qu'une scène existe et pourquoi elle n'est pas employée.
     */
    const simulatedCount = await prisma.satelliteObservation.count({
      where: { plotId, index: { in: [...MOISTURE_INDEXES] }, mode: 'SIMULATED' },
    });

    if (simulatedCount > 0) {
      return {
        filled: false,
        ignoredSimulated: simulatedCount,
        reason:
          `${simulatedCount} observation(s) satellite d’humidité existe(nt) pour cette parcelle, `
          + 'mais uniquement en mode SIMULATED : elles sont ignorées. '
          + 'Une valeur simulée n’est pas une mesure et ne peut pas fonder une recommandation.',
      };
    }

    return {
      filled: false,
      reason:
        'Aucune observation satellite d’humidité du sol pour cette parcelle '
        + `(index attendus : ${MOISTURE_INDEXES.join(', ')}). `
        + `Source attendue : ${PRIMARY_MOISTURE_SOURCE.id}. `
        + 'Les éventuelles scènes NDVI ne sont pas converties en humidité.',
    };
  }

  state[RANGE_KEYS.SOIL_MOISTURE] = {
    value: observation.value,
    unit: '%',
    source: 'satellite',
    confidence: resolved.source.confidence,
    measuredAt: observation.observedAt,
    depthCm: 0,
    origin: `satellite:${resolved.source.id}`,
    mode: observation.mode ?? 'REAL',
    satelliteSource: resolved.source.id,
    degraded: resolved.degraded,
    caveat: SUBSURFACE_CAVEAT,
  };

  return {
    filled: true,
    source: resolved.source.id,
    degraded: resolved.degraded,
    reason: resolved.reason ?? null,
    caveat: SUBSURFACE_CAVEAT,
  };
};

/** Évalue une culture contre l'état du sol. Totalement déterministe et testable. */
/**
 * Note une culture sur ses plages agronomiques.
 *
 * @param {object} [projections] Prévisions par paramètre, produites par
 *   `buildProjections`. Facultatif : sans lui, la notation porte sur la seule
 *   mesure du jour — comportement inchangé pour les appelants existants.
 *   Une prévision ne peut que **durcir** un critère, jamais l'assouplir.
 */
export const scoreCrop = (
  cropEntry,
  rangesEntry,
  state,
  projections = {},
  engine = resolveEngineVersion(DEFAULT_ENGINE_VERSION),
) => {
  const ranges = rangesEntry?.ranges ?? {};
  const criteria = [];
  const notEvaluated = [];
  /** Scores d'adéquation des critères effectivement évalués, pour la combinaison. */
  const criterionScores = [];
  let metWeight = 0;
  let evaluableWeight = 0;
  let forecastDowngrades = 0;
  /**
   * Ne compte que les critères pour lesquels une plage existe.
   *
   * Compter aussi les plages absentes reviendrait à pénaliser une culture pour
   * un référentiel incomplet : avec le référentiel provisoire actuel (seul le
   * pH est renseigné), la couverture plafonnerait à 25 % et **aucune** culture
   * ne pourrait jamais être classée. L'absence de référentiel est signalée par
   * `notEvaluated` et par l'étiquette « indicative », pas par le score.
   */
  let totalWeight = 0;
  let eliminated = null;

  for (const [key, range] of Object.entries(ranges)) {
    // Une plage absente ou incomplète n'est pas devinée : le critère est écarté
    // du calcul et signalé comme non évalué.
    if (!isRangeUsable(range)) {
      notEvaluated.push({
        key,
        label: labelOf(key),
        reason: `Aucune plage agronomique fiable pour ${labelOf(key)} : ce critère n’a pas été évalué.`,
        cause: 'NO_REFERENCE',
      });
      continue;
    }

    const weight = 1;
    totalWeight += weight;

    const parameter = state[key];
    const evaluation = evaluateCriterion(
      { type: 'range', min: range.min, max: range.max, label: key, unit: range.unit },
      parameter,
    );

    if (evaluation.met === null) {
      notEvaluated.push({
        key,
        label: labelOf(key),
        reason: `Mesure absente pour ${labelOf(key)} : critère non évalué.`,
        cause: 'NO_MEASUREMENT',
      });
      continue;
    }

    /**
     * Ajustement par la prévision sur la période de semis.
     *
     * La valeur du jour est conforme, mais la culture va rester en terre
     * pendant tout le cycle : c'est la trajectoire prévue qui décide.
     */
    const projected = applyProjection({
      range,
      projection: projections?.[key] ?? null,
      measuredMet: evaluation.met,
      measuredValue: evaluation.observed,
    });
    const met = projected.met === null ? evaluation.met : projected.met;
    if (projected.downgraded) forecastDowngrades += 1;

    /**
     * Score d'adéquation du paramètre.
     *
     * Il porte sur `projected.scoredValue`, c'est-à-dire la valeur **la plus
     * défavorable** entre la mesure et la prévision : une prévision ne peut que
     * durcir un score, jamais l'améliorer. Sans prévision, c'est la mesure.
     *
     * Le mode indique si la notation a pu être graduée. `BINARY` signifie que
     * les bornes tolérées manquent : le moteur ne les invente pas, il retombe
     * sur « dans la plage idéale ou non ».
     */
    const adequacy = adequacyScore(range, projected.scoredValue ?? evaluation.observed, {
      // Une version notant en binaire reste binaire, même si la plage en base
      // porte des bornes tolérées : la règle appartient à la version, pas aux
      // données.
      allowGraded: engine.scoring === 'GRADED_FOUR_LIMITS',
    });

    evaluableWeight += weight;
    if (met) metWeight += weight;
    if (adequacy) criterionScores.push(adequacy.score);

    /**
     * Critère éliminatoire : un dépassement écarte la culture, quel que soit le
     * score des autres critères. Encore faut-il pouvoir l'évaluer.
     *
     * **L'élimination reste fondée sur la mesure constatée** (`evaluation.met`,
     * pas `met`). Écarter définitivement une culture sur une prévision — avec
     * son erreur déclarée — serait plus nuisible qu'utile : le critère est
     * alors simplement non satisfait, et le franchissement prévu est signalé.
     */
    if (ELIMINATION_KEYS.includes(key) && !evaluation.met && evaluation.observed > range.max) {
      eliminated = {
        key,
        label: labelOf(key),
        observed: evaluation.observed,
        limit: range.max,
        unit: range.unit,
        reason: `Critère éliminatoire dépassé (${labelOf(key)}) : ${evaluation.observed} ${range.unit ?? ''} pour une limite de ${range.max}.`,
      };
    }

    criteria.push({
      key,
      label: labelOf(key),
      expected: evaluation.expected,
      observed: evaluation.observed,
      unit: parameter?.unit ?? range.unit,
      source: parameter?.source ?? null,
      confidence: parameter?.confidence ?? null,
      measuredAt: parameter?.measuredAt ?? null,
      origin: parameter?.origin ?? null,
      met,
      /**
       * Adéquation de 0 à 1. `scoringMode` dit comment elle a été obtenue :
       * `GRADED` sur les quatre limites, `BINARY` quand une borne tolérée
       * manque. Sans cette précision, un 0 binaire et un 0 gradué seraient
       * indiscernables alors qu'ils ne disent pas la même chose.
       */
      adequacy: adequacy ? Number(adequacy.score.toFixed(4)) : null,
      scoringMode: adequacy?.mode ?? null,
      weight,
      rangeStatus: range.status,
      /**
       * **Instantané de la plage ayant servi au calcul.**
       *
       * Sans lui, une recommandation enregistrée devient inreproductible dès
       * qu'un agronome corrige la plage : le score affiché ne correspondrait
       * plus à aucune ligne consultable, et personne ne pourrait dire si le
       * calcul était bon ou si la donnée a bougé. On recopie donc les quatre
       * limites, le statut, la source et l'identifiant de la ligne.
       *
       * `expected` (« entre 5 et 6 ») ne suffit pas : c'est une phrase mise en
       * forme pour l'affichage, elle perd les bornes tolérées et toute
       * précision numérique exploitable.
       */
      rangeSnapshot: {
        rangeId: range.id ?? null,
        parameterKey: range.parameterKey ?? key,
        idealMin: range.min ?? null,
        idealMax: range.max ?? null,
        toleratedMin: range.toleratedMin ?? null,
        toleratedMax: range.toleratedMax ?? null,
        unit: range.unit ?? null,
        status: range.status ?? null,
        sourceType: range.sourceType ?? null,
        sourceReference: range.sourceReference ?? null,
        /** Version de la ligne : distingue deux corrections successives. */
        rangeVersion: range.version ?? null,
        datasetLabel: range.datasetLabel ?? null,
      },
      explanation: projected.reason
        ? `${evaluation.reason} — ${projected.reason}`
        : evaluation.reason,
      /**
       * Provenance de la décision : mesure seule, ou mesure ajustée par une
       * prévision prouvée. Sans ce champ, un critère durci par la prévision
       * serait indiscernable d'un critère constaté.
       */
      forecastAdjusted: projected.projection !== null,
      /** Franchissement prévu mais dans l'erreur du modèle : à surveiller. */
      watch: projected.watch,
      downgradedByForecast: projected.downgraded,
      projection: projected.projection,
    });
  }

  const evaluatedCount = criteria.length;
  const coverage = totalWeight === 0 ? 0 : evaluableWeight / totalWeight;
  /**
   * Une culture éliminée n'a pas de score : elle est hors classement, pas mal
   * classée. Renvoyer un score ici laisserait croire qu'elle reste classable.
   */
  const combined = combineScores(criterionScores, engine);
  const score = eliminated || evaluableWeight === 0 ? null : combined;

  /**
   * Classement sur un seul critère : trop faible pour être présenté comme une
   * recommandation, même si la couverture est de 100 %. Le moteur le dit.
   */
  const tooFewCriteria = evaluatedCount < MIN_EVALUATED_CRITERIA;

  return {
    cropSlug: cropEntry.cropSlug,
    label: cropEntry.label,
    plantingWindow: cropEntry.matchedWindow?.label ?? null,
    cycleDays: cropEntry.cycleDays ?? null,
    score,
    /**
     * Version du moteur et règle de combinaison ayant produit ce score.
     *
     * Sans elles, un nombre seul est ininterprétable : « 0,62 » ne veut rien
     * dire tant qu'on ne sait pas si c'est une moyenne de verdicts binaires
     * (1.0) ou le plus bas de scores gradués (2.0).
     */
    ...describeEngine(engine),
    coverage,
    evaluatedCount,
    criteria,
    notEvaluated,
    eliminated,
    tooFewCriteria,
    /** Nombre de critères durcis par une prévision prouvée. */
    forecastDowngrades,
    /**
     * `usable` intègre l'élimination : un appelant qui ne consulterait que ce
     * drapeau ne peut pas classer une culture écartée sur un critère dur.
     * L'invariant est local plutôt que laissé à la vigilance de chaque appelant.
     */
    usable: !eliminated && score !== null && coverage >= MIN_COVERAGE && !tooFewCriteria,
  };
};

/**
 * Calcule et enregistre une recommandation pour une période demandée.
 *
 * @param {string} plotId
 * @param {{ periodStart: Date, periodEnd: Date, mode?: string }} payload
 * @param {object} req contexte de requête (tenant, user)
 */
/**
 * Charge les prévisions prouvées d'une parcelle et les résume sur la période.
 *
 * Ne retient que la prévision la plus récente par paramètre, et seulement si
 * elle bat la persistance. Les prévisions écartées sont remontées avec leur
 * motif : l'absence d'ajustement doit être traçable, pas silencieuse.
 */
const loadForecastProjections = async (plotId, organizationId, window) => {
  const predictions = await prisma.soilPrediction.findMany({
    where: { plotId, organizationId },
    orderBy: { computedAt: 'desc' },
    take: 200,
  });

  const latestByParameter = new Map();
  for (const prediction of predictions) {
    if (!latestByParameter.has(prediction.parameter)) latestByParameter.set(prediction.parameter, prediction);
  }

  return buildProjections([...latestByParameter.values()], window);
};

export const createRecommendation = async (plotId, payload, req, { pending = false } = {}) => {
  const organizationId = req.tenant.organizationId;

  /**
   * Version du moteur. Facultative : à défaut, celle de la configuration.
   *
   * Une version inconnue est refusée plutôt que remplacée — produire un score
   * sous une règle que l'appelant n'a pas demandée serait tromper sur ce qui a
   * été calculé. C'est aussi ce qui permet de faire tourner deux règles sur les
   * mêmes données pour les comparer.
   */
  const engine = resolveEngineVersion(payload?.engineVersion);

  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    include: { farm: { select: { id: true, countryCode: true, province: true } } },
  });
  // Cloisonnement : une parcelle d'une autre organisation n'existe pas.
  assertOwnership(plot, organizationId, 'Parcelle');

  const mode = assertDataModeAllowed(payload.mode, {
    isProd: env.isProd,
    simulationAllowed: env.simulationAllowed,
  });

  const periodStart = new Date(payload.periodStart);
  const periodEnd = new Date(payload.periodEnd);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    throw ApiError.badRequest('Période invalide');
  }
  if (periodEnd <= periodStart) {
    throw ApiError.badRequest('La fin de période doit être postérieure à son début');
  }
  /**
   * Borne vérifiée **ici** et pas seulement dans le schéma de route : le service
   * est aussi appelé par le job d'alertes, qui ne passe pas par la validation
   * HTTP. Au-delà d'une campagne, un classement n'a plus de sens agronomique.
   */
  if (periodEnd - periodStart > MAX_PERIOD_DAYS * 86_400_000) {
    throw ApiError.badRequest(`La période demandée ne peut pas dépasser ${MAX_PERIOD_DAYS} jours`);
  }
  const requestedDays = Math.round((periodEnd - periodStart) / 86_400_000);

  const province = plot.farm?.province ?? null;
  const calendar = resolveCalendar(province);
  if (!calendar) {
    throw ApiError.conflict(
      `Aucun calendrier cultural pour la province « ${province ?? 'inconnue'} ». `
      + `Provinces couvertes par ce déploiement : ${SUPPORTED_PROVINCES.join(', ')}.`,
      { province, supportedProvinces: SUPPORTED_PROVINCES },
    );
  }

  const { state, readingsUsed, satellite } = await buildSoilState(plot, plotId);

  /**
   * Prévisions sur la période de semis.
   *
   * Le classement porte sur un cycle de plusieurs semaines : noter les cultures
   * sur la seule photographie du jour ignorerait ce qui va se passer pendant ce
   * cycle. Sans prévision prouvée, `projections` reste vide et le classement
   * retombe sur la mesure — ce qui est dit explicitement dans l'explication.
   */
  const { projections, skipped: skippedForecasts } = await loadForecastProjections(
    plotId,
    organizationId,
    { periodStart, periodEnd, now: new Date() },
  );
  const forecastParameters = Object.keys(projections);

  const startMonth = periodStart.getUTCMonth() + 1;
  const endMonth = periodEnd.getUTCMonth() + 1;
  const candidates = cropsPlantableInMonths(calendar, startMonth, endMonth);

  /**
   * Référentiel chargé depuis la base, pour le lot actif (`AGRONOMIC_DATASET`).
   * Une culture sans plage enregistrée n'est pas pénalisée : ses critères
   * remontent comme « non évalués », jamais comme défavorables.
   */
  const reference = await rangesForCrops(
    candidates.map((entry) => entry.cropSlug),
    { organizationId: plot.organizationId ?? null },
  );
  const rangesOf = (cropSlug) => ({ cropSlug, ranges: reference.byCrop[cropSlug] ?? {} });

  const scored = candidates
    .map((cropEntry) => scoreCrop(cropEntry, rangesOf(cropEntry.cropSlug), state, projections, engine))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  const eliminated = scored.filter((entry) => entry.eliminated);
  const ranked = scored.filter((entry) => !entry.eliminated && entry.usable);
  const insufficient = scored.filter((entry) => !entry.eliminated && !entry.usable);

  /**
   * Aucune donnée exploitable → aucune recommandation. Le statut
   * INSUFFICIENT_DATA est enregistré plutôt que de produire un classement vide
   * de sens : l'historique garde la trace de la tentative et de son motif.
   */
  const insufficiencyReason = (() => {
    if (ranked.length > 0) return null;
    if (candidates.length === 0) {
      return `Aucune culture du calendrier n’est semable entre les mois ${startMonth} et ${endMonth}.`;
    }
    const allTooFew = insufficient.every((entry) => entry.tooFewCriteria);
    if (allTooFew) {
      return `Moins de ${MIN_EVALUATED_CRITERIA} critères agronomiques évaluables par culture. `
        + 'Renseignez davantage de paramètres (analyse de sol ou sonde) pour permettre un classement.';
    }
    return 'Aucune culture n’atteint le seuil de données évaluables. Renseignez une analyse de sol ou une sonde.';
  })();

  const calendarValidated = isCalendarValidated(calendar);
  const rangesProvisional = ranked.some((entry) =>
    hasProvisionalRange(rangesOf(entry.cropSlug).ranges),
  );
  const indicative = !calendarValidated || rangesProvisional;

  const sources = [
    ...new Set(Object.values(state).map((entry) => entry.origin).filter(Boolean)),
    // Une prévision ayant durci un critère fait partie des sources du résultat.
    ...(scored.some((entry) => entry.forecastDowngrades > 0) ? ['forecast'] : []),
  ];

  const referenceMeasurements = Object.fromEntries(
    Object.entries(state).map(([key, entry]) => [
      key,
      {
        value: entry.value,
        unit: entry.unit,
        source: entry.source,
        confidence: entry.confidence,
        measuredAt: entry.measuredAt,
        depthCm: entry.depthCm,
        origin: entry.origin,
        mode: entry.mode,
        /**
         * Provenance satellite conservée sur la valeur elle-même.
         *
         * Sans cela, la réserve « le satellite mesure la surface, pas le
         * sous-sol » restait confinée à l'objet `satellite` de la réponse et
         * disparaissait des mesures persistées : tout consommateur ultérieur
         * (API, SMS, export) aurait lu une humidité satellite comme une mesure
         * de sol ordinaire.
         */
        ...(entry.origin === 'sensor' || entry.origin === 'soil-assessment'
          ? {}
          : {
              satelliteSource: entry.satelliteSource ?? null,
              degraded: entry.degraded ?? false,
              caveat: entry.caveat ?? null,
            }),
      },
    ]),
  );

  /**
   * Seuils de surveillance dérivés des plages utilisées : c'est ce que le job
   * d'alertes comparera aux nouvelles mesures. Seuls les critères réellement
   * évaluables produisent un seuil — un seuil inventé déclencherait de fausses
   * alertes.
   */
  const thresholds = {};
  for (const entry of ranked) {
    for (const criterion of entry.criteria) {
      if (thresholds[criterion.key]) continue;
      const range = rangesOf(entry.cropSlug).ranges?.[criterion.key];
      if (!isRangeUsable(range)) continue;
      thresholds[criterion.key] = {
        min: range.min,
        max: range.max,
        unit: range.unit,
        rangeStatus: range.status,
        derivedFrom: entry.cropSlug,
      };
    }
  }

  /**
   * Récapitulatif de l'ajustement par la prévision.
   *
   * Chaque nombre provient de `projections`, donc des données du moteur.
   * L'absence de prévision est **énoncée** : un agriculteur qui ne verrait rien
   * pourrait croire que la période a été prise en compte alors que le classement
   * repose sur la seule photographie du jour.
   */
  const forecastSummary = {
    applied: forecastParameters.length > 0,
    periodDays: requestedDays,
    parameters: forecastParameters.map((key) => {
      const projection = projections[key];
      const affected = ranked.filter((entry) =>
        entry.criteria.some((criterion) => criterion.key === key && criterion.downgradedByForecast),
      );
      const watched = ranked.flatMap((entry) =>
        entry.criteria
          .filter((criterion) => criterion.key === key && criterion.watch)
          .map((criterion) => ({ cropSlug: entry.cropSlug, ...criterion.watch })),
      );
      return {
        parameter: key,
        label: labelOf(key),
        predictedMin: projection.predictedMin,
        predictedMinAt: projection.predictedMinAt,
        predictedMax: projection.predictedMax,
        predictedMaxAt: projection.predictedMaxAt,
        horizonDays: projection.horizonDays,
        pointsUsed: projection.pointsUsed,
        periodDays: projection.periodDays,
        coverageRatio: projection.coverageRatio,
        mae: projection.mae,
        baselineMae: projection.baselineMae,
        modelVersionId: projection.modelVersionId,
        simulated: projection.simulated,
        /** Cultures dont ce critère a été durci par la prévision. */
        downgradedCrops: affected.map((entry) => entry.cropSlug),
        /** Franchissements prévus mais dans l'erreur du modèle : à surveiller. */
        watch: watched,
      };
    }),
    /** Prévisions écartées, avec leur motif : rien n'est ignoré en silence. */
    skipped: skippedForecasts,
    notice: forecastParameters.length > 0
      ? `Le classement tient compte des prévisions sur ${forecastParameters.length} paramètre(s) `
        + `pour une période de ${requestedDays} jours.`
      : `Aucune prévision prouvée sur la période : le classement repose sur les seules mesures du jour.`,
  };

  const explanation = {
    language: 'fr',
    indicative,
    indicativeReasons: [
      ...(calendarValidated ? [] : ['Le calendrier cultural de la province n’est pas validé par un agronome.']),
      ...(rangesProvisional ? ['Les plages agronomiques utilisées sont provisoires.'] : []),
    ],
    period: { start: periodStart.toISOString(), end: periodEnd.toISOString(), days: requestedDays },
    province: calendar.province,
    /**
     * Provenance du référentiel : calendrier et lot de plages agronomiques.
     * Sans cela, il serait impossible de dire plus tard sur quelles fourchettes
     * un classement donné a été calculé.
     */
    reference: {
      datasetLabel: reference.datasetLabel,
      calendarStatus: calendar.status ?? null,
      calendarValidated,
      rangesProvisional,
    },
    satellite,
    caveat: satellite.filled ? SUBSURFACE_CAVEAT : null,
    forecast: forecastSummary,
    /** Chaque nombre cité ici provient de `referenceMeasurements`, des plages
     *  ou de `forecast.parameters` — tous issus du moteur ou de la base. */
    figures: referenceMeasurements,
  };

  const recommendation = await prisma.cropRecommendation.create({
    data: {
      id: resolveId(),
      organizationId,
      plotId,
      periodStart,
      periodEnd,
      requestedDays,
      /**
       * `pending` est réservé au job d'alertes : la proposition de remplacement
       * attend la décision de l'agriculteur, et l'ancienne recommandation reste
       * `ACTIVE` tant qu'elle n'est pas acceptée. Jamais exposé par l'API HTTP.
       */
      status: ranked.length === 0 ? 'INSUFFICIENT_DATA' : (pending ? 'PENDING' : 'ACTIVE'),
      insufficiencyReason,
      scores: ranked.map((entry) => ({
        cropSlug: entry.cropSlug,
        label: entry.label,
        score: entry.score,
        engineVersion: entry.engineVersion,
        combinationRule: entry.combinationRule,
        /**
         * Libellé de la règle, porté **avec** l'identifiant.
         *
         * `scoreCrop` étend déjà `describeEngine(engine)` sur chaque culture :
         * le libellé était donc calculé, puis abandonné ici au moment du
         * mapping. Sans lui, chaque client doit soit recopier les libellés en
         * dur — ce que faisaient les deux écrans, avec un `if` par règle connue
         * et **rien** pour toute autre valeur — soit remonter chercher le
         * libellé du calcul parent. Le libellé appartient à la règle qu'il
         * décrit.
         */
        combinationRuleLabel: entry.combinationRuleLabel,
        combinationRuleDescription: entry.combinationRuleDescription,
        scoringModel: entry.scoringModel,
        scoringModelLabel: entry.scoringModelLabel,
        coverage: entry.coverage,
        /**
         * Nombre de critères réellement évalués.
         *
         * Avec la règle du facteur le plus limitant, un paramètre non mesuré
         * est ignoré : il ne faut donc pas qu'un score élevé puisse reposer
         * sur un seul paramètre sans que l'appelant puisse le voir. Les deux
         * garde-fous — `MIN_EVALUATED_CRITERIA` (au moins 2 critères) et
         * `MIN_COVERAGE` — sont calculés dans `scoreCrop` ; ces deux champs
         * les rendent lisibles au lieu de les laisser implicites.
         */
        evaluatedCount: entry.evaluatedCount,
        /** Sous `MIN_EVALUATED_CRITERIA` : trop peu de critères pour classer. */
        tooFewCriteria: entry.tooFewCriteria,
        plantingWindow: entry.plantingWindow,
        cycleDays: entry.cycleDays,
        criteria: entry.criteria,
        notEvaluated: entry.notEvaluated,
      })),
      referenceMeasurements,
      thresholds,
      decomposition: {
        methodVersion: METHOD_VERSION,
        eliminated: eliminated.map((entry) => ({
          cropSlug: entry.cropSlug,
          label: entry.label,
          reason: entry.eliminated.reason,
        })),
        insufficientData: insufficient.map((entry) => ({
          cropSlug: entry.cropSlug,
          label: entry.label,
          coverage: entry.coverage,
          evaluatedCount: entry.evaluatedCount,
          /** Pourquoi la culture n'est pas classable : motif explicite. */
          cause: entry.tooFewCriteria ? 'TOO_FEW_CRITERIA' : 'LOW_COVERAGE',
          notEvaluated: entry.notEvaluated,
        })),
        /**
         * Ajustement par la prévision, conservé avec la recommandation : sans
         * lui, il serait impossible de dire plus tard si un classement tenait
         * compte de la période ou seulement du jour du calcul.
         */
        forecast: forecastSummary,
      },
      explanation,
      /**
       * Version du moteur ayant produit ce résultat.
       *
       * Elle est **figée à l'écriture** : si la règle par défaut change plus
       * tard, cette recommandation reste lisible sous la règle qui l'a produite.
       * Relire un score sans sa règle serait un contresens — 0,62 en moyenne de
       * verdicts binaires et 0,62 en minimum de scores gradués ne disent pas la
       * même chose.
       */
      ruleSetVersion: engine.version,
      modelVersionId: null,
      confidence: null,
      sources,
      mode,
      createdBy: req.user?.id ?? null,
    },
  });

  await audit({
    actorId: req.user?.id ?? null,
    action: 'recommendation.create',
    resource: 'CropRecommendation',
    resourceId: recommendation.id,
    req,
    // `newValue` porte le contexte de la décision : période, nombre de cultures
    // classées, caractère indicatif. C'est ce qui permettra de rejouer le calcul.
    newValue: {
      organizationId,
      plotId,
      requestedDays,
      ranked: ranked.length,
      indicative,
      insufficiencyReason,
    },
  });

  return {
    recommendation,
    indicative,
    indicativeReasons: explanation.indicativeReasons,
    /** Version du moteur et règle de combinaison : sans elles le score est muet. */
    ...describeEngine(engine),
    /**
     * Rappel porté par chaque résultat.
     *
     * Le score mesure une **adéquation** entre un état mesuré et des fourchettes
     * de référence. Ce n'est ni un rendement attendu, ni une probabilité de
     * réussite : l'afficher comme tel ferait passer une comparaison de
     * paramètres pour une promesse agronomique.
     */
    scoreNotice: SCORE_NOTICE,
    dataMode: mode,
    ...(mode === 'REAL' ? {} : { dataModeNotice: dataModeLabel(mode) }),
    counts: {
      candidates: candidates.length,
      ranked: ranked.length,
      eliminated: eliminated.length,
      insufficientData: insufficient.length,
      readingsUsed,
    },
    satellite,
  };
};

/** Liste les recommandations d'une parcelle, bornée au tenant. */
export const listRecommendations = async (plotId, req) => {
  const organizationId = req.tenant.organizationId;
  const plot = await prisma.plot.findUnique({ where: { id: plotId } });
  assertOwnership(plot, organizationId, 'Parcelle');

  const items = await prisma.cropRecommendation.findMany({
    where: { plotId, organizationId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return { items, count: items.length };
};

/** Détail d'une recommandation, avec sa décomposition complète. */
export const getRecommendation = async (id, req) => {
  const organizationId = req.tenant.organizationId;
  const recommendation = await prisma.cropRecommendation.findFirst({
    where: { id, organizationId, deletedAt: null },
  });
  if (!recommendation) throw ApiError.notFound('Recommandation introuvable');
  return recommendation;
};

/**
 * Accepte ou refuse une recommandation.
 *
 * Une recommandation de remplacement ne fait passer l'ancienne en `SUPERSEDED`
 * qu'**après** acceptation : tant que l'agriculteur n'a pas décidé, c'est
 * l'ancienne qui fait foi.
 */
export const decideRecommendation = async (id, payload, req) => {
  const organizationId = req.tenant.organizationId;
  const recommendation = await prisma.cropRecommendation.findFirst({
    where: { id, organizationId, deletedAt: null },
  });
  if (!recommendation) throw ApiError.notFound('Recommandation introuvable');
  /**
   * Deux statuts sont décidables : `ACTIVE` (recommandation en cours que
   * l'agriculteur confirme ou écarte) et `PENDING` (proposition de remplacement
   * produite par le job d'alertes). Tout autre statut est déjà tranché.
   */
  const DECIDABLE = ['ACTIVE', 'PENDING'];
  if (!DECIDABLE.includes(recommendation.status)) {
    throw ApiError.conflict(`Recommandation déjà ${recommendation.status}`, { status: recommendation.status });
  }

  const accepted = payload.decision === 'ACCEPTED';

  const updated = await prisma.$transaction(async (tx) => {
    if (accepted) {
      // Les recommandations actives antérieures sur la même parcelle passent en
      // remplacées — une seule recommandation active à la fois.
      await tx.cropRecommendation.updateMany({
        where: {
          plotId: recommendation.plotId,
          organizationId,
          status: 'ACTIVE',
          id: { not: recommendation.id },
          deletedAt: null,
        },
        data: { status: 'SUPERSEDED' },
      });
    }
    return tx.cropRecommendation.update({
      where: { id: recommendation.id },
      data: { status: accepted ? 'ACTIVE' : 'REJECTED' },
    });
  });

  await audit({
    actorId: req.user?.id ?? null,
    action: `recommendation.${accepted ? 'accept' : 'reject'}`,
    resource: 'CropRecommendation',
    resourceId: recommendation.id,
    req,
    oldValue: { status: recommendation.status },
    newValue: { status: updated.status, organizationId },
  });

  return updated;
};

/**
 * Explication en français.
 *
 * Le texte est **généré à gabarit** à partir des nombres déjà calculés : aucun
 * chiffre n'est produit ici. Chaque valeur citée figure dans
 * `referenceMeasurements` ou dans les plages agronomiques.
 */
export const explainRecommendation = async (id, req) => {
  const recommendation = await getRecommendation(id, req);
  const scored = Array.isArray(recommendation.scores) ? recommendation.scores : [];
  const figures = recommendation.referenceMeasurements ?? {};

  if (recommendation.status === 'INSUFFICIENT_DATA') {
    return {
      language: 'fr',
      text: `Aucune recommandation n'a pu être produite : ${recommendation.insufficiencyReason ?? 'données insuffisantes'}`,
      indicative: true,
      figures,
    };
  }

  const lines = [];
  if (recommendation.explanation?.indicative) {
    lines.push(
      'Recommandation indicative : '
      + (recommendation.explanation.indicativeReasons ?? []).join(' '),
    );
  }
  /**
   * `scored.length` est le nombre de cultures **classées**, pas le nombre de
   * cultures semables : le calendrier en propose davantage, mais celles dont
   * les critères ne sont pas évaluables n'arrivent pas jusqu'ici. Dire
   * « semables » laisserait croire que les autres ont été écartées à tort.
   */
  lines.push(
    `Pour la période de ${recommendation.requestedDays} jours sur la parcelle, `
    + `${scored.length} culture(s) ont pu être classées selon le calendrier de `
    + `${recommendation.explanation?.province ?? 'la province'}.`,
  );

  /**
   * Le texte nomme les grandeurs, jamais les clés techniques. `c.label` est
   * produit par `scoreCrop` à partir de `RANGE_LABELS` ; le repli sur `c.key`
   * couvre une recommandation persistée avant l'ajout des libellés.
   */
  const nameOf = (c) => c?.label ?? labelOf(c?.key);
  let airTemperatureEvaluated = false;

  for (const entry of scored.slice(0, 3)) {
    const favourable = entry.criteria.filter((c) => c.met).map(nameOf);
    const unfavourable = entry.criteria.filter((c) => !c.met).map(nameOf);
    const pending = (entry.notEvaluated ?? []).map(nameOf);
    if (entry.criteria.some((c) => c.key === RANGE_KEYS.AIR_TEMPERATURE)) {
      airTemperatureEvaluated = true;
    }
    lines.push(
      `${entry.label} — score ${Math.round((entry.score ?? 0) * 100)} % `
      + `(${Math.round((entry.coverage ?? 0) * 100)} % des critères évaluables). `
      + (favourable.length ? `Favorable : ${favourable.join(', ')}. ` : '')
      + (unfavourable.length ? `Pénalisant : ${unfavourable.join(', ')}. ` : '')
      + (pending.length ? `Non évalué : ${pending.join(', ')}.` : ''),
    );
  }

  if (airTemperatureEvaluated) {
    lines.push(AIR_VS_SOIL_CAVEAT);
  }

  if (recommendation.explanation?.satellite?.filled) {
    lines.push(
      `L'humidité provient du satellite ${recommendation.explanation.satellite.source}. ${SUBSURFACE_CAVEAT}`,
    );
  }

  /**
   * Rappel de ce qu'est un score, en fin d'explication.
   *
   * Placé ici parce que c'est le texte que lit l'agriculteur : un pourcentage
   * affiché à côté d'une culture se lit spontanément comme une chance de
   * réussite, et ce n'est pas ce que le moteur calcule.
   */
  lines.push(SCORE_NOTICE);

  // Version et règle : sans elles, un pourcentage n'est pas interprétable.
  const engineVersion = recommendation.ruleSetVersion;
  if (engineVersion) {
    const ruleLabel = COMBINATION_RULES[
      scored[0]?.combinationRule ?? ENGINE_VERSIONS[engineVersion]?.combinationRule
    ]?.label;
    lines.push(
      `Score calculé par le moteur v${engineVersion}`
      + (ruleLabel ? ` — règle de combinaison : ${ruleLabel}.` : '.'),
    );
  }

  return {
    language: 'fr',
    text: lines.join('\n'),
    indicative: Boolean(recommendation.explanation?.indicative),
    indicativeReasons: recommendation.explanation?.indicativeReasons ?? [],
    /** Version du moteur et règle ayant produit les scores cités. */
    engineVersion: engineVersion ?? null,
    combinationRule: scored[0]?.combinationRule ?? null,
    scoreNotice: SCORE_NOTICE,
    figures,
  };
};
