import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './productions.controller.js';
import * as schema from './productions.schema.js';

const router = Router();

router.use(authenticate, resolveTenant);

router.get('/stats', authorize('productions.read'), validate(schema.statsSchema, 'query'), asyncHandler(controller.stats));
router.get(
  '/',
  authorize('productions.read'),
  validate(schema.listProductionsSchema, 'query'),
  asyncHandler(controller.list),
);
router.post(
  '/',
  authorize('productions.write'),
  validate(schema.createProductionSchema),
  asyncHandler(controller.create),
);
router.get(
  '/:id',
  authorize('productions.read'),
  validate(schema.productionIdParam, 'params'),
  asyncHandler(controller.getOne),
);
router.patch(
  '/:id',
  authorize('productions.write'),
  validate(schema.productionIdParam, 'params'),
  validate(schema.updateProductionSchema),
  asyncHandler(controller.update),
);
router.delete(
  '/:id',
  authorize('productions.write'),
  validate(schema.productionIdParam, 'params'),
  asyncHandler(controller.archive),
);

export default router;
