/**
 * Routes d'acquisition satellite.
 *
 * Une acquisition refusée (scène trop nuageuse, fournisseur indisponible) est un
 * **200** : « pas de scène exploitable » est une réponse informative, pas un
 * échec du service. Aucune valeur de substitution n'est produite.
 */
import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './acquisition.service.js';
import { acquireSchema, listObservationsQuery, plotPathSchema } from './acquisition.schema.js';

const router = Router();
router.use(authenticate, resolveTenant);

/**
 * GET /satellite/settings — réglages d'acquisition, sans les secrets.
 *
 * Rend explicites le fournisseur actif, l'activation, les sources et leur rôle :
 * le choix d'une source doit être explicable, pas implicite.
 */
router.get(
  '/settings',
  authorize('satellite.read'),
  asyncHandler(async (req, res) => success(res, await service.getSettings())),
);

// POST /satellite/plots/:plotId/acquire — acquisition immédiate.
router.post(
  '/plots/:plotId/acquire',
  authorize('satellite.write'),
  validate(plotPathSchema, 'params'),
  validate(acquireSchema),
  asyncHandler(async (req, res) => {
    const result = await service.acquireForPlot(req.params.plotId, req.body, req);
    if (!result.acquired) {
      return success(res, result, { message: 'Aucune scène exploitable acquise' });
    }
    return created(res, result, { message: 'Scène satellite acquise' });
  }),
);

// GET /satellite/plots/:plotId/observations — scènes enregistrées.
router.get(
  '/plots/:plotId/observations',
  authorize('satellite.read'),
  validate(plotPathSchema, 'params'),
  validate(listObservationsQuery, 'query'),
  asyncHandler(async (req, res) =>
    success(res, await service.listObservations(req.params.plotId, req.query, req)),
  ),
);

export default router;
