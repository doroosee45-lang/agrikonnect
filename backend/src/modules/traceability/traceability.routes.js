import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created, paginated } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { paginationSchema } from '../../shared/pagination.js';
import * as service from './traceability.service.js';

const createLotSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  code: z.string().trim().min(4).max(60).optional(),
  cropId: z.string().min(1).max(60),
  plotId: z.string().min(10).max(60).optional(),
  productionId: z.string().min(10).max(60).optional(),
  quantityKg: z.coerce.number().positive().optional(),
  location: z.record(z.any()).optional(),
  publicFields: z.record(z.any()).optional(),
});

const eventSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  type: z.enum(['HARVEST', 'STORAGE', 'PROCESSING', 'TRANSPORT', 'DELIVERY', 'OTHER']),
  location: z.record(z.any()).optional(),
  details: z.string().trim().max(1000).optional(),
  source: z.enum(['declared', 'platform_verified', 'third_party_verified', 'measured_sensor']).optional(),
  closeLot: z.boolean().optional(),
});

const listSchema = paginationSchema.omit({ sort: true, order: true }).extend({
  cropId: z.string().max(60).optional(),
  status: z.enum(['OPEN', 'CLOSED', 'RECALLED']).optional(),
});

const idParam = z.object({ id: z.string().min(10).max(60) });

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', authorize('lots.read'), validate(listSchema, 'query'), asyncHandler(async (req, res) => {
  const { items, total, page, limit } = await service.list(req.query, req);
  return paginated(res, items, { page, limit, total });
}));

router.post('/', authorize('lots.write'), validate(createLotSchema), asyncHandler(async (req, res) =>
  created(res, await service.create(req.body, req), { message: 'Lot créé — journal append-only initialisé' })));

router.get('/:id', authorize('lots.read'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.getOne(req.params.id, req))));

// Journal append-only : uniquement des ajouts
router.post('/:id/events', authorize('lots.write'), validate(idParam, 'params'), validate(eventSchema),
  asyncHandler(async (req, res) =>
    created(res, await service.addEvent(req.params.id, req.body, req), {
      message: 'Événement ajouté. Aucune modification ni suppression n\'est possible.',
    })));

router.put('/:id/public-fields', authorize('lots.write'), validate(idParam, 'params'),
  validate(z.object({ publicFields: z.record(z.any()) })), asyncHandler(async (req, res) =>
    success(res, await service.updatePublicFields(req.params.id, req.body.publicFields, req), { message: 'Projection publique mise à jour' })));

router.post('/:id/recall', authorize('lots.write'), validate(idParam, 'params'),
  validate(z.object({ reason: z.string().trim().min(5).max(500) })), asyncHandler(async (req, res) =>
    success(res, await service.recall(req.params.id, req.body, req), { message: 'Lot rappelé' })));

export default router;
