import { z } from 'zod';
import { paginationSchema } from '../../shared/pagination.js';

/**
 * Retours de saison — le rendement **réellement obtenu**.
 *
 * ## Pourquoi ce module existe
 *
 * Le moteur de recommandation dit quoi semer sur une durée donnée à partir de
 * l'état du sol et du sous-sol. Sans le rendement réellement obtenu, il n'y a
 * **aucune** donnée de résultat : impossible de savoir si les plages
 * agronomiques décrivent bien le réel, et impossible d'entraîner quoi que ce
 * soit. Ce module est la seule entrée de vérité « ce qui s'est passé ».
 *
 * ## Ce qu'il ne fait pas
 *
 * Le score d'une recommandation mesure une **adéquation** entre un sol et une
 * culture, pas un rendement attendu. Un rendement faible sur une culture bien
 * classée n'invalide donc pas la recommandation : la sécheresse, les ravageurs,
 * le retard de semis ou la perte post-récolte ne sont pas mesurés ici. Le
 * rapprochement est enregistré **sans verdict** — voir
 * `src/modules/seasons/seasons.service.js`, `compareWithRecommendation`.
 */

/**
 * Sources admissibles pour un rendement déclaré.
 *
 * `satellite`, `derived` et `estimated` sont **exclus volontairement** : un
 * retour de saison est une observation de ce qui a été récolté, pas un calcul.
 * Les accepter reviendrait à laisser entrer dans la table de vérité des valeurs
 * que personne n'a mesurées — exactement ce que le cahier des charges interdit.
 */
const DECLARABLE_SOURCES = ['declared', 'third_party_verified', 'measured_lab'];

/**
 * Borne physique haute, en kg par hectare.
 *
 * Aucune culture du calendrier (maïs, manioc, arachide, riz, banane-plantain)
 * n'atteint 100 t/ha. Au-delà, c'est presque toujours une erreur de saisie —
 * des grammes entrés comme kilogrammes, ou une surface en ares. On refuse
 * plutôt que d'enregistrer une valeur qui fausserait toutes les statistiques.
 */
const MAX_YIELD_KG_PER_HA = 100000;

/** Année bornée : on ne déclare ni une récolte future, ni une archive ancienne. */
const MIN_YEAR = 1990;
const maxYear = () => new Date().getFullYear() + 1;

/**
 * Champs du retour de saison, **sans** les règles inter-champs.
 *
 * Nommée à part parce que `.refine()` renvoie un `ZodEffects`, qui n'a ni
 * `.omit()` ni `.partial()` : le schéma de mise à jour doit donc dériver de
 * l'objet brut, pas du schéma raffiné.
 */
const seasonFeedbackShape = z.object({
    id: z.string().min(20).max(40).optional(),
    plotId: z.string().min(10).max(60),
    cropId: z.string().trim().min(1, 'Culture requise').max(60),
    /**
     * Recommandation que ce retour vient clore. Facultative : l'agriculteur
     * peut déclarer un rendement sans qu'aucune recommandation ait été
     * demandée, et cette donnée reste utile.
     */
    recommendationId: z.string().min(10).max(60).optional(),
    season: z.string().trim().min(1, 'Saison requise').max(40),
    year: z.coerce
      .number()
      .int('Année entière requise')
      .min(MIN_YEAR, `Année antérieure à ${MIN_YEAR}`)
      .max(maxYear(), 'Année future non admise'),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    /**
     * Rendement total récolté, en kilogrammes. C'est un **total**, pas un
     * rendement à l'hectare : la surface est un champ séparé, et l'exiger en
     * kg/ha forcerait l'agriculteur à faire lui-même une division qu'il peut
     * mal faire.
     */
    actualYieldKg: z.coerce
      .number()
      .positive('Rendement positif requis')
      .max(1e12, 'Valeur invraisemblable'),
    areaHa: z.coerce.number().positive('Surface positive requise').max(1e6).optional(),
    unit: z.string().trim().max(20).optional(),
    observations: z.string().trim().max(2000).optional(),
    source: z.enum(DECLARABLE_SOURCES).default('declared'),
  });

export const createSeasonFeedbackSchema = seasonFeedbackShape
  .strict()
  .refine((value) => value.periodEnd > value.periodStart, {
    message: 'La fin de période doit suivre son début',
    path: ['periodEnd'],
  })
  .refine((value) => {
    if (!value.areaHa) return true;
    const perHa = value.actualYieldKg / value.areaHa;
    return perHa <= MAX_YIELD_KG_PER_HA;
  }, {
    message: `Rendement par hectare au-dessus de ${MAX_YIELD_KG_PER_HA} kg/ha : vérifiez la surface ou l'unité`,
    path: ['actualYieldKg'],
  });

/**
 * Mise à jour partielle.
 *
 * Dérivée de l'objet brut, donc **sans** les règles inter-champs : celles-ci
 * sont revérifiées dans le service sur l'état résultant, ce qui est plus juste —
 * un `PATCH` qui ne change que `periodStart` doit être jugé avec le `periodEnd`
 * déjà enregistré, pas avec un champ absent.
 */
export const updateSeasonFeedbackSchema = seasonFeedbackShape
  .omit({ id: true })
  .partial()
  .strict();

export const listSeasonFeedbackSchema = paginationSchema.extend({
  plotId: z.string().min(10).max(60).optional(),
  cropId: z.string().trim().max(60).optional(),
  season: z.string().trim().max(40).optional(),
  year: z.coerce.number().int().min(MIN_YEAR).max(maxYear()).optional(),
  /** Ne garder que les retours rattachés à une recommandation. */
  withRecommendation: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const statsSeasonFeedbackSchema = z.object({
  groupBy: z.enum(['crop', 'plot', 'season', 'year']).default('crop'),
  plotId: z.string().min(10).max(60).optional(),
  cropId: z.string().trim().max(60).optional(),
  season: z.string().trim().max(40).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const seasonFeedbackIdParam = z.object({ id: z.string().min(10).max(60) });

/**
 * Cohérence entre les trois grandeurs.
 *
 * Exportée pour être testée directement : c'est la seule règle de ce module qui
 * puisse produire une valeur fausse **silencieusement**, parce qu'elle dépend de
 * deux champs saisis séparément.
 */
/**
 * Valeur numérique exploitable, ou null.
 *
 * Séparée de `Number()` parce que `Number(null)` vaut **0** : traiter un
 * rendement absent comme un rendement nul produirait « 0 kg/ha », un chiffre
 * faux mais parfaitement plausible, qui entrerait dans les moyennes. Un champ
 * absent doit rester absent.
 */
const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const yieldPerHectare = (actualYieldKg, areaHa) => {
  const yieldKg = toFiniteNumber(actualYieldKg);
  const area = toFiniteNumber(areaHa);
  if (yieldKg === null || area === null || area <= 0) return null;
  return Math.round((yieldKg / area) * 100) / 100;
};

export { MAX_YIELD_KG_PER_HA, MIN_YEAR };
