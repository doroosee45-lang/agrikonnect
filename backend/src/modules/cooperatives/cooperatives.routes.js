import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './cooperatives.controller.js';
import * as schema from './cooperatives.schema.js';

const router = Router();

router.use(authenticate, resolveTenant);

// COOP-01 — coopérative de l'organisation active
router.get('/current', authorize('cooperatives.read'), asyncHandler(controller.getCurrent));
router.patch('/current', authorize('cooperatives.write'), asyncHandler(controller.updateCurrent));

// COOP-02 / COOP-03 / COOP-04
router.get(
  '/:id/members',
  authorize('cooperatives.members'),
  validate(schema.cooperativeIdParam, 'params'),
  validate(schema.listMembersSchema, 'query'),
  asyncHandler(controller.listMembers),
);
router.post(
  '/:id/members',
  authorize('cooperatives.members'),
  validate(schema.cooperativeIdParam, 'params'),
  validate(schema.addMemberSchema),
  asyncHandler(controller.addMember),
);
router.post(
  '/:id/members/import',
  authorize('cooperatives.members'),
  validate(schema.cooperativeIdParam, 'params'),
  validate(schema.importMembersSchema),
  asyncHandler(controller.importMembers),
);
router.patch(
  '/:id/members/:memberId',
  authorize('cooperatives.members'),
  validate(schema.memberParam, 'params'),
  validate(schema.updateMemberSchema),
  asyncHandler(controller.updateMember),
);
router.get(
  '/:id/overview',
  authorize('cooperatives.read'),
  validate(schema.cooperativeIdParam, 'params'),
  asyncHandler(controller.overview),
);

// COOP-10 — offre groupée à partir de la disponibilité déclarée des membres
router.post(
  '/:id/group-offers/preview',
  authorize('cooperatives.write'),
  validate(schema.cooperativeIdParam, 'params'),
  validate(schema.groupOfferPreviewSchema),
  asyncHandler(controller.previewGroupOffer),
);
router.get(
  '/:id/group-offers',
  authorize('cooperatives.read'),
  validate(schema.cooperativeIdParam, 'params'),
  validate(schema.groupOfferQuery, 'query'),
  asyncHandler(controller.listGroupOffers),
);
router.post(
  '/:id/group-offers',
  authorize('cooperatives.write'),
  validate(schema.cooperativeIdParam, 'params'),
  validate(schema.groupOfferSchema),
  asyncHandler(controller.createGroupOffer),
);
router.post(
  '/:id/group-offers/:offerId/confirm',
  authorize('cooperatives.write'),
  validate(schema.groupOfferParam, 'params'),
  asyncHandler(controller.confirmGroupOffer),
);
router.post(
  '/:id/group-offers/:offerId/cancel',
  authorize('cooperatives.write'),
  validate(schema.groupOfferParam, 'params'),
  validate(schema.groupOfferCancelSchema),
  asyncHandler(controller.cancelGroupOffer),
);

export default router;
