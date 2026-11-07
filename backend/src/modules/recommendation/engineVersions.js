/**
 * Versions du moteur de recommandation.
 *
 * La façon de combiner les scores par paramètre n'est **pas une constante
 * enfouie dans la fonction de notation** : c'est un paramètre déclaré, versionné
 * et sélectionnable. Trois raisons :
 *
 *  • **Un résultat doit pouvoir être relu plus tard.** Une recommandation
 *    enregistrée sous une version donnée garde sa version ; si la règle change,
 *    l'ancien résultat reste interprétable au lieu de devenir incompréhensible.
 *  • **Changer la règle change le classement.** Passer d'une moyenne à un
 *    minimum n'est pas un détail d'implémentation : deux cultures peuvent
 *    s'inverser. Ce choix doit être visible, daté, et réversible.
 *  • **Deux règles doivent pouvoir coexister le temps d'une comparaison.** Un
 *    agronome qui veut vérifier qu'une règle est meilleure a besoin de faire
 *    tourner les deux sur les mêmes données, de façon reproductible.
 */

/**
 * Règles de combinaison disponibles.
 *
 * Chaque règle est une fonction pure : mêmes scores en entrée, même résultat en
 * sortie, quel que soit l'ordre de parcours. C'est ce qui rend deux exécutions
 * comparables.
 */
export const COMBINATION_RULES = Object.freeze({
  /**
   * **Facteur le plus limitant** — règle par défaut.
   *
   * Le score retenu est le plus bas de tous les critères. Une culture ne vaut
   * pas mieux que son pire paramètre : un pH catastrophique ne se compense pas
   * par une salinité parfaite. C'est le comportement agronomiquement défendable
   * pour un choix de culture, et c'est celui que l'agriculteur comprend —
   * « ce qui bloque, c'est ceci ».
   */
  MOST_LIMITING: Object.freeze({
    id: 'MOST_LIMITING',
    label: 'Facteur le plus limitant',
    description:
      'Le score retenu est le minimum des scores par paramètre : une culture ne vaut pas mieux '
      + 'que son pire critère.',
    combine: (scores) => {
      const values = scores.filter((value) => Number.isFinite(value));
      return values.length === 0 ? null : Math.min(...values);
    },
  }),

  /**
   * **Moyenne des critères** — règle de la version 1.0, conservée.
   *
   * Elle n'est plus la règle par défaut mais reste disponible : elle sert de
   * point de comparaison, et les recommandations déjà enregistrées sous la
   * version 1.0 ont été calculées ainsi.
   */
  MEAN_SATISFIED: Object.freeze({
    id: 'MEAN_SATISFIED',
    label: 'Moyenne des critères',
    description:
      'Le score retenu est la moyenne des scores par paramètre. Règle de la version 1.0 : un '
      + 'critère très défavorable peut être compensé par les autres.',
    combine: (scores) => {
      const values = scores.filter((value) => Number.isFinite(value));
      return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
    },
  }),
});

/**
 * Modèles de notation par paramètre.
 *
 * `GRADED_FOUR_LIMITS` ne s'applique que si les quatre limites existent. Sinon
 * le moteur retombe sur `BINARY_SATISFIED` **pour ce paramètre** : il ne
 * complète jamais une borne tolérée manquante.
 */
export const SCORING_MODELS = Object.freeze({
  /** Satisfait (1) ou non satisfait (0), sur la seule plage idéale. */
  BINARY_SATISFIED: Object.freeze({
    id: 'BINARY_SATISFIED',
    label: 'Binaire — dans la plage idéale ou non',
  }),
  /**
   * 1 dans la plage idéale, décroissance linéaire jusqu'à 0 aux limites
   * tolérées, 0 au-delà.
   */
  GRADED_FOUR_LIMITS: Object.freeze({
    id: 'GRADED_FOUR_LIMITS',
    label: 'Gradué sur quatre limites',
    description:
      '1 dans la plage idéale, décroissance linéaire jusqu’à 0 aux limites tolérées, 0 au-delà. '
      + 'Si une borne tolérée manque, le paramètre retombe sur le verdict binaire.',
  }),
});

import { ApiError } from '../../shared/errors/ApiError.js';

/**
 * Versions du moteur, de la plus ancienne à la plus récente.
 *
 * Une version est **immutable** : on n'en modifie jamais une publiée, on en
 * ajoute une. Sinon un résultat ancien cesserait de correspondre à la règle qui
 * l'a produit.
 */
export const ENGINE_VERSIONS = Object.freeze({
  '1.0': Object.freeze({
    version: '1.0',
    scoring: 'BINARY_SATISFIED',
    combinationRule: 'MEAN_SATISFIED',
    publishedAt: '2026-10-01',
    note:
      'Verdict binaire par paramètre, combiné par moyenne. Comportement antérieur à la notation '
      + 'graduée : conservé pour relire les recommandations déjà enregistrées.',
  }),
  '2.0': Object.freeze({
    version: '2.0',
    scoring: 'GRADED_FOUR_LIMITS',
    combinationRule: 'MOST_LIMITING',
    publishedAt: '2026-10-23',
    note:
      'Score d’adéquation gradué sur les quatre limites, combiné par facteur le plus limitant. '
      + 'Un paramètre dont les bornes tolérées manquent reste évalué en binaire : aucune limite '
      + 'n’est inventée.',
  }),
});

/**
 * Version par défaut.
 *
 * Lue dans l'environnement plutôt que codée en dur : basculer une instance sur
 * l'ancienne règle, ou en comparer deux, ne demande pas de modification de code.
 */
export const DEFAULT_ENGINE_VERSION = process.env.RECOMMENDATION_ENGINE_VERSION || '2.0';

/**
 * Résout une version demandée.
 *
 * Une version inconnue est **refusée**, pas remplacée par la plus récente :
 * produire un score sous une règle que l'appelant n'a pas demandée serait
 * tromper sur ce qui a été calculé.
 */
export const resolveEngineVersion = (requested) => {
  const version = requested ?? DEFAULT_ENGINE_VERSION;
  const entry = ENGINE_VERSIONS[String(version)];
  if (!entry) {
    const known = Object.keys(ENGINE_VERSIONS).join(', ');
    // `ApiError`, et non une `Error` nue dotée d'un champ `status` : le
    // middleware d'erreur ne traduit que les `ApiError`, et une `Error` nue
    // remonterait en 500 — un refus de validation présenté comme une panne.
    throw ApiError.badRequest(
      `Version de moteur inconnue : « ${version} ». Versions disponibles : ${known}.`,
      { code: 'UNKNOWN_ENGINE_VERSION', requested: String(version), available: Object.keys(ENGINE_VERSIONS) },
    );
  }
  return entry;
};

/**
 * Décrit une version pour l'API et l'explication.
 *
 * Un résultat qui n'indiquerait ni sa version ni sa règle serait
 * ininterprétable : « 62 % » ne veut rien dire sans savoir si c'est une
 * moyenne de verdicts binaires ou un minimum de scores gradués.
 */
export const describeEngine = (engine) => ({
  engineVersion: engine.version,
  scoringModel: engine.scoring,
  scoringModelLabel: SCORING_MODELS[engine.scoring]?.label ?? engine.scoring,
  combinationRule: engine.combinationRule,
  combinationRuleLabel: COMBINATION_RULES[engine.combinationRule]?.label ?? engine.combinationRule,
  combinationRuleDescription: COMBINATION_RULES[engine.combinationRule]?.description ?? null,
});

/**
 * Combine les scores par paramètre selon la règle de la version.
 *
 * Un tableau vide donne `null`, jamais `0` : « rien d'évaluable » et « tout est
 * défavorable » sont deux affirmations différentes, et la seconde est fausse
 * quand il n'y a rien à évaluer.
 */
/**
 * Nombre de décimales conservées sur un score.
 *
 * Quatre décimales, bien au-delà de toute signification agronomique : l'arrondi
 * sert à ne pas exposer `0.7999999999999998` là où le calcul veut dire 0,8. Un
 * score affiché avec seize décimales laisse croire à une précision que ni les
 * fourchettes ni les mesures ne possèdent.
 */
export const SCORE_DECIMALS = 4;

export const combineScores = (scores, engine) => {
  const rule = COMBINATION_RULES[engine.combinationRule];
  if (!rule) {
    throw ApiError.badRequest(`Règle de combinaison inconnue : « ${engine.combinationRule} ».`);
  }
  const combined = rule.combine(scores);
  return combined === null ? null : Number(combined.toFixed(SCORE_DECIMALS));
};
