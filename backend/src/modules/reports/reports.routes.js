import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './reports.controller.js';
import * as schema from './reports.schema.js';

/** Signalement par un utilisateur — monté sous /reports. */
const router = Router();

router.post(
  '/',
  authenticate,
  resolveTenant,
  authorize('reports.create'),
  validate(schema.createReportSchema),
  asyncHandler(controller.create),
);

export default router;

/** Modération — montée sous /admin/reports. */
export const adminRouter = Router();

adminRouter.use(authenticate, resolveTenant);

adminRouter.get(
  '/',
  authorize('reports.review'),
  validate(schema.listReportsSchema, 'query'),
  asyncHandler(controller.listForModeration),
);

adminRouter.patch(
  '/:id',
  authorize('reports.review'),
  validate(schema.reportIdParam, 'params'),
  validate(schema.reviewReportSchema),
  asyncHandler(controller.review),
);
