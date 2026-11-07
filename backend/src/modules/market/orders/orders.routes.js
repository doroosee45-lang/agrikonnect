import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { success, created, paginated } from '../../../shared/http/response.js';
import { authenticate } from '../../../middleware/auth.js';
import { resolveTenant } from '../../../middleware/tenant.js';
import { authorize } from '../../../middleware/authorize.js';
import { validate } from '../../../middleware/validate.js';
import { idempotency } from '../../../middleware/idempotency.js';
import { paginationSchema } from '../../../shared/pagination.js';
import * as service from './orders.service.js';

const createOrderSchema = z
  .object({
    id: z.string().min(20).max(40).optional(),
    listingId: z.string().min(10).max(60).optional(),
    offerId: z.string().min(10).max(60).optional(),
    requestId: z.string().min(10).max(60).optional(),
    quantity: z.coerce.number().positive().optional(),
    unit: z.string().trim().max(20).optional(),
    unitPrice: z.coerce.number().positive().optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    title: z.string().trim().max(160).optional(),
    terms: z.string().trim().max(2000).optional(),
    delivery: z
      .object({
        address: z.string().max(500).optional(),
        expectedAt: z.coerce.date().optional(),
      })
      .optional(),
  })
  .refine((d) => d.listingId || d.offerId, {
    message: 'Une annonce ou une offre est requise',
    path: ['listingId'],
  });

const transitionSchema = z.object({
  status: z.enum([
    'ACCEPTED', 'REJECTED', 'PROCESSING', 'READY', 'IN_TRANSIT',
    'DELIVERED', 'COMPLETED', 'CANCELLED', 'DISPUTED',
  ]),
  reason: z.string().trim().max(500).optional(),
});

const paymentSchema = z.object({
  paymentStatus: z.enum(['DECLARED_UNPAID', 'DECLARED_PAID']),
});

const disputeSchema = z.object({
  reason: z.string().trim().min(10, 'Motif détaillé requis').max(1000),
  evidence: z.array(z.string().max(300)).max(10).default([]),
});

const resolveDisputeSchema = z.object({
  status: z.enum(['UNDER_REVIEW', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'WITHDRAWN']),
  decision: z.string().trim().max(1000).optional(),
});

const listSchema = paginationSchema.extend({
  status: z
    .enum(['PENDING', 'ACCEPTED', 'PROCESSING', 'READY', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'DISPUTED'])
    .optional(),
  role: z.enum(['buyer', 'seller']).optional(),
});

const idParam = z.object({ id: z.string().min(10).max(60) });

const router = Router();
router.use(authenticate, resolveTenant);

// ORD-01 — création idempotente (évite la double commande en cas de retry réseau)
router.post(
  '/',
  authorize('orders.write'),
  idempotency('orders.create'),
  validate(createOrderSchema),
  asyncHandler(async (req, res) =>
    created(res, await service.create(req.body, req), {
      message: 'Commande créée. Conditions figées au moment de la commande.',
    })),
);

router.get('/', authorize('orders.read'), validate(listSchema, 'query'), asyncHandler(async (req, res) => {
  const { items, total, page, limit } = await service.list(req.query, req);
  return paginated(res, items, { page, limit, total });
}));

router.get('/:id', authorize('orders.read'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.getOne(req.params.id, req))));

// Journal des transitions — lecture seule (append-only)
router.get('/:id/events', authorize('orders.read'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.events(req.params.id, req))));

// ORD-03 — machine à états
router.patch('/:id/status', authorize('orders.write'), validate(idParam, 'params'),
  validate(transitionSchema), asyncHandler(async (req, res) =>
    success(res, await service.transition(req.params.id, req.body, req), { message: 'Statut mis à jour' })));

// ORD-04 — paiement déclaratif
router.patch('/:id/payment', authorize('orders.write'), validate(idParam, 'params'),
  validate(paymentSchema), asyncHandler(async (req, res) =>
    success(res, await service.declarePayment(req.params.id, req.body, req))));

// ORD-05 — litige
router.post('/:id/disputes', authorize('orders.write'), validate(idParam, 'params'),
  validate(disputeSchema), asyncHandler(async (req, res) =>
    created(res, await service.openDispute(req.params.id, req.body, req), { message: 'Litige ouvert' })));

// MOD-01 — file des litiges (modérateurs) : lecture seule, pas de coordonnées
router.get('/admin/disputes', authorize('orders.review', 'disputes.read'), validate(listSchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await service.listDisputes(req.query, req);
    return success(res, { items: result.items }, {
      meta: { page: result.page, limit: result.limit, total: result.total },
    });
  }));

router.patch('/admin/disputes/:id', authorize('disputes.review'), validate(idParam, 'params'),
  validate(resolveDisputeSchema), asyncHandler(async (req, res) =>
    success(res, await service.resolveDispute(req.params.id, req.body, req), { message: 'Litige traité' })));

export default router;
