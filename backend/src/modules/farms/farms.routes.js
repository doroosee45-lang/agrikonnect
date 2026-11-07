import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './farms.controller.js';
import * as schema from './farms.schema.js';

const router = Router();

router.use(authenticate, resolveTenant);

router.get('/', authorize('farms.read'), validate(schema.listFarmsSchema, 'query'), asyncHandler(controller.list));
router.post('/', authorize('farms.write'), validate(schema.createFarmSchema), asyncHandler(controller.create));
router.get('/:id', authorize('farms.read'), validate(schema.farmIdParam, 'params'), asyncHandler(controller.getOne));
router.patch(
  '/:id',
  authorize('farms.write'),
  validate(schema.farmIdParam, 'params'),
  validate(schema.updateFarmSchema),
  asyncHandler(controller.update),
);
router.patch(
  '/:id/publish',
  authorize('farms.write'),
  validate(schema.farmIdParam, 'params'),
  validate(schema.publishFarmSchema),
  asyncHandler(controller.publish),
);
router.delete(
  '/:id',
  authorize('farms.delete'),
  validate(schema.farmIdParam, 'params'),
  asyncHandler(controller.archive),
);

export default router;
