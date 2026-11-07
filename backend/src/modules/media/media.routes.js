import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './media.controller.js';
import * as schema from './media.schema.js';

const router = Router();

router.use(authenticate, resolveTenant);

router.post(
  '/upload-url',
  authorize('media.upload'),
  validate(schema.uploadUrlSchema),
  asyncHandler(controller.createUploadUrl),
);
router.post(
  '/:id/confirm',
  authorize('media.upload'),
  validate(schema.mediaIdParam, 'params'),
  asyncHandler(controller.confirm),
);
router.get('/', asyncHandler(controller.list));
router.delete(
  '/:id',
  authorize('media.delete'),
  validate(schema.mediaIdParam, 'params'),
  asyncHandler(controller.remove),
);

export default router;
