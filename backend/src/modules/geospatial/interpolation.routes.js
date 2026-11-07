/**
 * Routes des cartes interpolées.
 *
 * Montées sous `/geospatial/interpolations`, avant le montage général de
 * `/geospatial` : Express résout les préfixes dans l'ordre de déclaration.
 *
 * Une réponse `sufficient: false` est un **200** : « moins de trois sondes »
 * est une réponse légitime et informative, pas un échec du service.
 */
import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './interpolation.service.js';
import {
  interpolationPathSchema,
  interpolateSchema,
  listMapsQuery,
  mapIdParam,
  plotPathSchema,
} from './interpolation.schema.js';

const router = Router();
router.use(authenticate, resolveTenant);

/**
 * POST /geospatial/interpolations/:plotId/:parameter — calcule et enregistre.
 *
 * Ne persiste rien si les sondes sont insuffisantes : la réponse porte alors le
 * motif, et aucune grille de substitution n'est proposée.
 */
router.post(
  '/:plotId/:parameter',
  authorize('geospatial.write'),
  validate(interpolationPathSchema, 'params'),
  validate(interpolateSchema),
  asyncHandler(async (req, res) => {
    const result = await service.interpolateForPlot(
      req.params.plotId,
      req.params.parameter,
      req.body,
      req,
    );
    if (!result.sufficient) {
      return success(res, result, {
        message: 'Sondes insuffisantes : aucune carte produite',
      });
    }
    return created(res, result, { message: 'Carte interpolée calculée' });
  }),
);

/**
 * POST /geospatial/interpolations/:plotId/:parameter/evaluate — qualifie sans
 * produire de carte.
 *
 * Rend l'erreur « laisser une sonde dehors » et les valeurs aberrantes. Sert à
 * décider si une carte mérite d'être produite et montrée.
 */
router.post(
  '/:plotId/:parameter/evaluate',
  authorize('geospatial.read'),
  validate(interpolationPathSchema, 'params'),
  validate(interpolateSchema),
  asyncHandler(async (req, res) =>
    success(res, await service.evaluateForPlot(req.params.plotId, req.params.parameter, req.body, req)),
  ),
);

// GET /geospatial/interpolations/:plotId — cartes enregistrées, sans la grille.
router.get(
  '/:plotId',
  authorize('geospatial.read'),
  validate(plotPathSchema, 'params'),
  validate(listMapsQuery, 'query'),
  asyncHandler(async (req, res) =>
    success(res, await service.listMaps(req.params.plotId, req.query, req)),
  ),
);

// GET /geospatial/interpolations/map/:id — carte complète, grille incluse.
router.get(
  '/map/:id',
  authorize('geospatial.read'),
  validate(mapIdParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.getMap(req.params.id, req))),
);

export default router;
