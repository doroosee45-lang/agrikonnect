import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './seasons.controller.js';
import * as schema from './seasons.schema.js';

const router = Router();

router.use(authenticate, resolveTenant);

/**
 * Les routes fixes sont déclarées **avant** `/:id` : sinon `/seasons/stats`
 * serait avalé par le paramètre et renverrait 404 sur un identifiant invalide.
 */
router.get(
  '/stats',
  authorize('seasons.read'),
  validate(schema.statsSeasonFeedbackSchema, 'query'),
  asyncHandler(controller.stats),
);

router.get(
  '/',
  authorize('seasons.read'),
  validate(schema.listSeasonFeedbackSchema, 'query'),
  asyncHandler(controller.list),
);

router.post(
  '/',
  authorize('seasons.write'),
  validate(schema.createSeasonFeedbackSchema),
  asyncHandler(controller.create),
);

router.get(
  '/:id',
  authorize('seasons.read'),
  validate(schema.seasonFeedbackIdParam, 'params'),
  asyncHandler(controller.getOne),
);

/** Rapprochement avec la recommandation — sans verdict, voir le service. */
router.get(
  '/:id/compare',
  authorize('seasons.read'),
  validate(schema.seasonFeedbackIdParam, 'params'),
  asyncHandler(controller.compare),
);

router.patch(
  '/:id',
  authorize('seasons.write'),
  validate(schema.seasonFeedbackIdParam, 'params'),
  validate(schema.updateSeasonFeedbackSchema),
  asyncHandler(controller.update),
);

router.delete(
  '/:id',
  authorize('seasons.write'),
  validate(schema.seasonFeedbackIdParam, 'params'),
  asyncHandler(controller.archive),
);

export default router;
