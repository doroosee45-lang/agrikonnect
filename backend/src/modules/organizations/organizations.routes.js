import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { authenticate, requireVerified } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './organizations.controller.js';
import * as schema from './organizations.schema.js';

const router = Router();

router.use(authenticate, resolveTenant);

router.get('/', asyncHandler(controller.list));
// H-02 / H-07 : création réservée aux producteurs vérifiés (le créateur reçoit un rôle producteur).
router.post(
  '/',
  requireVerified,
  authorize('organizations.create'),
  validate(schema.createOrganizationSchema),
  asyncHandler(controller.create),
);
router.get('/:id', validate(schema.organizationIdParam, 'params'), asyncHandler(controller.getOne));
// H-02 : modification réservée aux responsables de l'organisation active.
router.patch(
  '/:id',
  requireVerified,
  authorize('organizations.write'),
  validate(schema.organizationIdParam, 'params'),
  validate(schema.updateOrganizationSchema),
  asyncHandler(controller.update),
);

export default router;
