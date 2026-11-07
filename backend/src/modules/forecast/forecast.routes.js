/**
 * Routes de prévision des paramètres du sol.
 *
 * Montées sur `/plots` : la prévision est toujours rattachée à une parcelle, et
 * l'`organizationId` vient du jeton — jamais du corps de requête.
 *
 * Une réponse `sufficient: false` est un **200**, pas une erreur : « nous
 * n'avons pas assez de données réelles pour prévoir » est une réponse légitime
 * et informative, pas un échec du service.
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './forecast.service.js';
import { forecastPathSchema, forecastSchema, listPredictionsQuery } from './forecast.schema.js';

const plotPathSchema = z.object({ plotId: z.string().min(10).max(60) });

const router = Router();
router.use(authenticate, resolveTenant);

/**
 * POST /plots/:plotId/forecasts/:parameter — calcule et enregistre une prévision.
 *
 * Ne persiste rien si les données réelles sont insuffisantes : la réponse porte
 * alors le motif, et aucune valeur de substitution n'est proposée.
 */
router.post(
  '/:plotId/forecasts/:parameter',
  authorize('forecast.write'),
  validate(forecastPathSchema, 'params'),
  validate(forecastSchema),
  asyncHandler(async (req, res) => {
    const result = await service.forecastForPlot(
      req.params.plotId,
      req.params.parameter,
      req.body,
      req,
    );
    if (!result.sufficient) {
      return success(
        res,
        result,
        { message: 'Données réelles insuffisantes : aucune prévision produite' },
      );
    }
    return created(res, result, { message: 'Prévision calculée' });
  }),
);

/**
 * POST /plots/:plotId/forecasts/:parameter/backtest — évalue sans enregistrer.
 *
 * Sert à décider de la promotion d'un modèle : renvoie les métriques sur
 * découpage chronologique et le verdict `promotable`.
 */
router.post(
  '/:plotId/forecasts/:parameter/backtest',
  authorize('forecast.read'),
  validate(forecastPathSchema, 'params'),
  validate(forecastSchema),
  asyncHandler(async (req, res) =>
    success(
      res,
      await service.backtestForPlot(req.params.plotId, req.params.parameter, req.body, req),
    ),
  ),
);

// GET /plots/:plotId/forecasts — prévisions enregistrées, les plus récentes d'abord.
router.get(
  '/:plotId/forecasts',
  authorize('forecast.read'),
  validate(plotPathSchema, 'params'),
  validate(listPredictionsQuery, 'query'),
  asyncHandler(async (req, res) =>
    success(res, await service.listPredictions(req.params.plotId, req.query, req)),
  ),
);

export default router;
