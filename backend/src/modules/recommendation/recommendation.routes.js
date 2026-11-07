/**
 * Routes de la recommandation culturale.
 *
 * Deux routeurs, comme le module géospatial :
 *  - `plotsRouter` monté sur `/plots` : création et liste par parcelle ;
 *  - `default` monté sur `/recommendations` : détail, explication, décision.
 *
 * Toute route passe par `authenticate` + `resolveTenant` : l'`organizationId`
 * vient du jeton, jamais du corps de requête. Un client ne peut pas désigner
 * l'organisation d'un autre.
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
  COMBINATION_RULES,
  ENGINE_VERSIONS,
  SCORING_MODELS,
  describeEngine,
  resolveEngineVersion,
} from './engineVersions.js';
import * as service from './recommendation.service.js';

const plotParam = z.object({ plotId: z.string().min(10).max(60) });
const idParam = z.object({ id: z.string().min(10).max(60) });

/**
 * Période demandée.
 *
 * Borne haute de 365 jours : une « période de semis » au-delà d'une campagne
 * n'a pas de sens agronomique et produirait un classement sans rapport avec la
 * fenêtre réelle.
 */
const createSchema = z
  .object({
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    /** Origine des valeurs : `REAL` par défaut. `SIMULATED` refusé en production. */
    mode: z.enum(['REAL', 'CONFIGURATION', 'SIMULATED']).optional(),
    /**
     * Version du moteur. Facultative : à défaut, celle de la configuration.
     *
     * Une version inconnue est refusée (422) plutôt que remplacée par la plus
     * récente — produire un score sous une règle non demandée serait tromper sur
     * ce qui a été calculé. C'est aussi ce qui permet de comparer deux règles
     * sur les mêmes données.
     */
    engineVersion: z.string().trim().min(1).max(16).optional(),
  })
  .refine((payload) => payload.periodEnd > payload.periodStart, {
    message: 'La fin de période doit être postérieure à son début',
    path: ['periodEnd'],
  })
  .refine(
    (payload) => payload.periodEnd - payload.periodStart <= service.MAX_PERIOD_DAYS * 86_400_000,
    {
      message: `La période demandée ne peut pas dépasser ${service.MAX_PERIOD_DAYS} jours`,
      path: ['periodEnd'],
    },
  );

const decisionSchema = z.object({
  decision: z.enum(['ACCEPTED', 'REJECTED']),
  /** Motif libre de l'agriculteur ; conservé pour l'historique, jamais interprété. */
  comment: z.string().trim().max(2000).optional(),
});

export const plotsRouter = Router();
plotsRouter.use(authenticate, resolveTenant);

// POST /plots/:plotId/recommendations — calcule quoi semer sur la période.
plotsRouter.post(
  '/:plotId/recommendations',
  authorize('recommendation.write'),
  validate(plotParam, 'params'),
  validate(createSchema),
  asyncHandler(async (req, res) =>
    created(res, await service.createRecommendation(req.params.plotId, req.body, req), {
      message: 'Recommandation calculée',
    }),
  ),
);

// GET /plots/:plotId/recommendations — historique de la parcelle.
plotsRouter.get(
  '/:plotId/recommendations',
  authorize('recommendation.read'),
  validate(plotParam, 'params'),
  asyncHandler(async (req, res) =>
    success(res, await service.listRecommendations(req.params.plotId, req)),
  ),
);

const router = Router();
router.use(authenticate, resolveTenant);

/**
 * GET /recommendations/engine — versions du moteur et règles de combinaison.
 *
 * **Déclaré avant `/:id`** : sans cet ordre, « engine » serait interprété comme
 * un identifiant de recommandation et la route renverrait un 422 de validation
 * au lieu des métadonnées.
 *
 * Exposé en lecture parce qu'un score sans sa règle est ininterprétable : un
 * écran qui affiche « 62 % » doit pouvoir dire selon quelle règle.
 */
router.get(
  '/engine',
  authorize('recommendation.read'),
  asyncHandler(async (_req, res) =>
    success(res, {
      default: describeEngine(resolveEngineVersion()),
      versions: Object.values(ENGINE_VERSIONS).map((engine) => ({
        ...describeEngine(engine),
        publishedAt: engine.publishedAt,
        note: engine.note,
      })),
      combinationRules: Object.values(COMBINATION_RULES).map((rule) => ({
        id: rule.id,
        label: rule.label,
        description: rule.description,
      })),
      scoringModels: Object.values(SCORING_MODELS).map((model) => ({
        id: model.id,
        label: model.label,
        ...(model.description ? { description: model.description } : {}),
      })),
      scoreNotice: service.SCORE_NOTICE,
    }),
  ),
);

// GET /recommendations/:id — détail avec décomposition critère par critère.
router.get(
  '/:id',
  authorize('recommendation.read'),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.getRecommendation(req.params.id, req))),
);

/**
 * GET /recommendations/:id/explanation — texte en français.
 *
 * Généré à gabarit : chaque nombre cité provient des données du moteur. Aucun
 * modèle de langage n'intervient, donc aucun chiffre ne peut être inventé.
 */
router.get(
  '/:id/explanation',
  authorize('recommendation.read'),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) =>
    success(res, await service.explainRecommendation(req.params.id, req)),
  ),
);

/**
 * POST /recommendations/:id/decision — l'agriculteur accepte ou refuse.
 *
 * C'est la seule façon de passer une recommandation précédente en `SUPERSEDED` :
 * sans acceptation explicite, l'ancienne reste active.
 */
router.post(
  '/:id/decision',
  authorize('recommendation.write'),
  validate(idParam, 'params'),
  validate(decisionSchema),
  asyncHandler(async (req, res) =>
    success(res, await service.decideRecommendation(req.params.id, req.body, req), {
      message: req.body.decision === 'ACCEPTED' ? 'Recommandation acceptée' : 'Recommandation refusée',
    }),
  ),
);

export default router;
