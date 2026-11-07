import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './plots.controller.js';
import * as schema from './plots.schema.js';

const router = Router();

router.use(authenticate, resolveTenant);

router.get('/', authorize('plots.read'), validate(schema.listPlotsSchema, 'query'), asyncHandler(controller.list));
router.post('/', authorize('plots.write'), validate(schema.createPlotSchema), asyncHandler(controller.create));

router.get('/:id', authorize('plots.read'), validate(schema.plotIdParam, 'params'), asyncHandler(controller.getOne));
router.patch(
  '/:id',
  authorize('plots.write'),
  validate(schema.plotIdParam, 'params'),
  validate(schema.updatePlotSchema),
  asyncHandler(controller.update),
);
router.delete(
  '/:id',
  authorize('plots.delete'),
  validate(schema.plotIdParam, 'params'),
  asyncHandler(controller.archive),
);

// PLOT-03 — historique cultural
router.get(
  '/:id/crop-history',
  authorize('history.read'),
  validate(schema.plotIdParam, 'params'),
  asyncHandler(controller.listHistory),
);
router.post(
  '/:id/crop-history',
  authorize('history.write'),
  validate(schema.plotIdParam, 'params'),
  validate(schema.cropHistorySchema),
  asyncHandler(controller.addHistory),
);
router.patch(
  '/:id/crop-history/:historyId',
  authorize('history.write'),
  validate(schema.historyIdParam, 'params'),
  validate(schema.cropHistorySchema.partial()),
  asyncHandler(controller.updateHistory),
);

export default router;
