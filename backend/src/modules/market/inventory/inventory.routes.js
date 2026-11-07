import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { success, created } from '../../../shared/http/response.js';
import { authenticate } from '../../../middleware/auth.js';
import { resolveTenant } from '../../../middleware/tenant.js';
import { authorize } from '../../../middleware/authorize.js';
import { validate } from '../../../middleware/validate.js';
import { idempotency } from '../../../middleware/idempotency.js';
import * as service from './inventory.service.js';

const createItemSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  label: z.string().trim().min(2).max(160),
  cropId: z.string().max(60).optional(),
  unit: z.string().trim().min(1).max(20),
  lowStockThreshold: z.coerce.number().min(0).optional(),
  expiresAt: z.coerce.date().optional(),
});

const movementSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  itemId: z.string().min(10).max(60),
  type: z.enum(['IN', 'OUT', 'LOSS', 'TRANSFER', 'INVENTORY', 'RESERVATION', 'RELEASE']),
  quantity: z.coerce.number().positive('Quantité positive requise'),
  unit: z.string().trim().max(20).optional(),
  refType: z.string().max(40).optional(),
  refId: z.string().max(60).optional(),
  reason: z.string().trim().max(500).optional(),
});

const itemParam = z.object({ id: z.string().min(10).max(60) });

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', authorize('inventory.read'), asyncHandler(async (req, res) =>
  success(res, await service.listItems(req.query, req))));

router.post('/', authorize('inventory.write'), validate(createItemSchema), asyncHandler(async (req, res) =>
  created(res, await service.createItem(req.body, req), { message: 'Article de stock créé' })));

router.get('/:id/movements', authorize('inventory.read'), validate(itemParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.itemHistory(req.params.id, req.query, req))));

// STK-01 — mouvement idempotent
router.post('/movements', authorize('inventory.write'), idempotency('inventory.movement'),
  validate(movementSchema), asyncHandler(async (req, res) =>
    created(res, await service.addMovement(req.body, req), { message: 'Mouvement enregistré' })));

export default router;
