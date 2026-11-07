import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './verification.controller.js';
import * as schema from './verification.schema.js';

/** Routes utilisateur — montées sous /verifications. */
const router = Router();

router.use(authenticate, resolveTenant);

router.post(
  '/',
  authorize('verifications.create'),
  validate(schema.createVerificationSchema),
  asyncHandler(controller.submit),
);

router.get('/me', authorize('verifications.read'), asyncHandler(controller.listMine));

export default router;

/** Routes d'administration — montées sous /admin/verifications (VER-03). */
export const adminRouter = Router();

adminRouter.use(authenticate, resolveTenant);

adminRouter.get(
  '/',
  authorize('verifications.review'),
  validate(schema.listVerificationsSchema, 'query'),
  asyncHandler(controller.listForReview),
);

adminRouter.patch(
  '/:id',
  authorize('verifications.review'),
  validate(schema.verificationIdParam, 'params'),
  validate(schema.reviewVerificationSchema),
  asyncHandler(controller.review),
);
