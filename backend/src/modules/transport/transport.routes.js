import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './transport.service.js';
import { transportPlaceSchema } from './transport.schema.js';

const createRequestSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  orderId: z.string().min(10).max(60),
  pickup: transportPlaceSchema,
  dropoff: transportPlaceSchema,
});

const offerSchema = z.object({
  price: z.coerce.number().positive(),
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
  etaDays: z.coerce.number().int().min(0).max(90).optional(),
});

const podSchema = z.object({
  photos: z.array(z.string().max(500)).min(1, 'Au moins une photo est requise'),
  receiverName: z.string().trim().min(2).max(160),
  signatureUrl: z.string().max(500).optional(),
  note: z.string().trim().max(1000).optional(),
});

const statusSchema = z.object({
  status: z.enum(['PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED']),
  note: z.string().trim().max(500).optional(),
});

const idParam = z.object({ id: z.string().min(10).max(60) });

const router = Router();
router.use(authenticate, resolveTenant);

// TRA-01 — demandes ouvertes (libellés approximatifs uniquement)
router.get('/requests', authorize('transport.read'), asyncHandler(async (req, res) =>
  success(res, await service.openRequests(req.query, req))));

router.post('/requests', authorize('transport.write'), validate(createRequestSchema), asyncHandler(async (req, res) =>
  created(res, await service.createRequest(req.body, req), { message: 'Demande de transport créée' })));

router.post('/requests/:id/offers', authorize('transport.write'), validate(idParam, 'params'),
  validate(offerSchema), asyncHandler(async (req, res) =>
    created(res, await service.createOffer(req.params.id, req.body, req), { message: 'Offre de transport envoyée' })));

router.post('/offers/:id/accept', authorize('transport.write'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.acceptOffer(req.params.id, req), { message: 'Transporteur assigné' })));

// TRA-03 — preuve de livraison obligatoire avant l'état DELIVERED
router.post('/requests/:id/proof-of-delivery', authorize('transport.write'), validate(idParam, 'params'),
  validate(podSchema), asyncHandler(async (req, res) =>
    success(res, await service.proofOfDelivery(req.params.id, req.body, req), { message: 'Preuve de livraison enregistrée' })));

router.patch('/requests/:id/status', authorize('transport.write'), validate(idParam, 'params'),
  validate(statusSchema), asyncHandler(async (req, res) =>
    success(res, await service.updateStatus(req.params.id, req.body, req), { message: 'Statut transport mis à jour' })));

export default router;
