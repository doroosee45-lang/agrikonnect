import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './organizations.controller.js';
import * as schema from './organizations.schema.js';

const router = Router();

router.use(authenticate, resolveTenant);

router.get('/', asyncHandler(controller.list));
router.post('/', validate(schema.createOrganizationSchema), asyncHandler(controller.create));
router.get('/:id', validate(schema.organizationIdParam, 'params'), asyncHandler(controller.getOne));
router.patch(
  '/:id',
  validate(schema.organizationIdParam, 'params'),
  validate(schema.updateOrganizationSchema),
  asyncHandler(controller.update),
);

export default router;
