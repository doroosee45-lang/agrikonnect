import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created, paginated } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { paginationSchema } from '../../shared/pagination.js';
import * as service from './tenders.service.js';

const createSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().max(3000).optional(),
  cropId: z.string().max(60).optional(),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().min(1).max(20),
  quality: z.string().trim().max(60).optional(),
  destinationCountry: z.string().trim().length(2).toUpperCase(),
  certifications: z.array(z.string().max(80)).max(10).default([]),
  deadline: z.coerce.date().optional(),
});

const responseSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().min(1).max(20),
  price: z.coerce.number().positive(),
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
  conditions: z.string().trim().max(1000).optional(),
});

const listSchema = paginationSchema.omit({ sort: true, order: true }).extend({
  cropId: z.string().max(60).optional(),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
  status: z.enum(['OPEN', 'CLOSED', 'AWARDED', 'CANCELLED']).optional(),
});

const idParam = z.object({ id: z.string().min(10).max(60) });

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', authorize('tenders.read'), validate(listSchema, 'query'), asyncHandler(async (req, res) => {
  const { items, total, page, limit } = await service.list(req.query);
  return paginated(res, items, { page, limit, total });
}));

router.post('/', authorize('tenders.write'), validate(createSchema), asyncHandler(async (req, res) =>
  created(res, await service.create(req.body, req), { message: 'Appel d\'offres publié' })));

router.get('/:id', authorize('tenders.read'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.getOne(req.params.id, req))));

router.post('/:id/responses', authorize('tenders.respond'), validate(idParam, 'params'),
  validate(responseSchema), asyncHandler(async (req, res) =>
    created(res, await service.respond(req.params.id, req.body, req), { message: 'Réponse déposée (scellée)' })));

router.post('/:id/award', authorize('tenders.write'), validate(idParam, 'params'),
  validate(z.object({ responseId: z.string().min(10).max(60), note: z.string().trim().max(1000).optional() })),
  asyncHandler(async (req, res) => success(res, await service.award(req.params.id, req.body, req), { message: 'Appel d\'offres adjugé' })));

router.post('/:id/close', authorize('tenders.write'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.close(req.params.id, req), { message: 'Appel d\'offres clôturé' })));

export default router;
