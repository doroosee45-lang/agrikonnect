import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { success, created } from '../../../shared/http/response.js';
import { authenticate } from '../../../middleware/auth.js';
import { resolveTenant } from '../../../middleware/tenant.js';
import { authorize } from '../../../middleware/authorize.js';
import { validate } from '../../../middleware/validate.js';
import * as service from './offers.service.js';

const createOfferSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  price: z.coerce.number().positive('Prix positif requis'),
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().min(1).max(20),
  conditions: z.string().trim().max(1000).optional(),
  validUntil: z.coerce.date().optional(),
});

const decideSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED', 'WITHDRAWN']),
  counter: z
    .object({
      price: z.coerce.number().positive(),
      currency: z.string().trim().length(3).toUpperCase().optional(),
      quantity: z.coerce.number().positive().optional(),
      unit: z.string().trim().max(20).optional(),
      conditions: z.string().trim().max(1000).optional(),
      validUntil: z.coerce.date().optional(),
    })
    .optional(),
});

const requestIdParam = z.object({ id: z.string().min(10).max(60) });
const offerIdParam = z.object({ offerId: z.string().min(10).max(60) });

const router = Router();
router.use(authenticate, resolveTenant);

// REQ-04 — réponse chiffrée à une demande
router.post(
  '/purchase-requests/:id/offers',
  authorize('offers.write'),
  validate(requestIdParam, 'params'),
  validate(createOfferSchema),
  asyncHandler(async (req, res) =>
    created(res, await service.createForRequest(req.params.id, req.body, req), {
      message: 'Offre envoyée. Les coordonnées restent masquées jusqu\'à accord.',
    })),
);

router.get(
  '/purchase-requests/:id/offers',
  authorize('offers.read'),
  validate(requestIdParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.listForRequest(req.params.id, req))),
);

router.patch(
  '/offers/:offerId',
  authorize('offers.write'),
  validate(offerIdParam, 'params'),
  validate(decideSchema),
  asyncHandler(async (req, res) =>
    success(res, await service.decide(req.params.offerId, req.body, req), {
      message: 'Offre traitée',
    })),
);

export default router;
