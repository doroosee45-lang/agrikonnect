import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created, paginated } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { paginationSchema } from '../../shared/pagination.js';
import * as service from './projects.service.js';

const moneySchema = z.object({
  amount: z.coerce.number().min(0),
  currency: z.string().trim().length(3).toUpperCase(),
});

const fieldStatusSchema = z.record(
  z.object({
    source: z.enum(['declared', 'platform_verified', 'third_party_verified', 'measured_lab', 'measured_sensor', 'estimated', 'derived']),
  }),
);

const createSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  title: z.string().trim().min(5).max(200),
  sector: z.string().trim().min(2).max(80),
  countryCode: z.string().trim().length(2).toUpperCase(),
  province: z.string().trim().max(120).optional(),
  description: z.string().trim().max(5000).optional(),
  existingAreaHa: z.coerce.number().min(0).optional(),
  targetAreaHa: z.coerce.number().min(0).optional(),
  currentProduction: z.record(z.any()).optional(),
  projectedProduction: z.record(z.any()).optional(),
  fundingNeed: moneySchema.optional(),
  ownContribution: moneySchema.optional(),
  durationMonths: z.coerce.number().int().min(1).max(240).optional(),
  milestones: z.array(z.record(z.any())).max(30).optional(),
  team: z.array(z.record(z.any())).max(20).optional(),
  market: z.string().trim().max(2000).optional(),
  risks: z.array(z.record(z.any())).max(30).optional(),
  impact: z.record(z.any()).optional(),
  linkedData: z.record(z.any()).optional(),
  fieldStatus: fieldStatusSchema.optional(),
});

const updateSchema = createSchema.omit({ id: true }).partial().extend({ force: z.boolean().optional() }).strict();

const listSchema = paginationSchema.omit({ sort: true, order: true }).extend({
  sector: z.string().max(80).optional(),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
  minFunding: z.coerce.number().min(0).optional(),
  maxFunding: z.coerce.number().min(0).optional(),
});

const reviewSchema = z.object({
  decision: z.enum(['PUBLISHED', 'REJECTED']),
  comment: z.string().trim().max(1000).optional(),
});

const idParam = z.object({ id: z.string().min(3).max(120) });

const router = Router();
router.use(authenticate, resolveTenant);

// Catalogue public des projets publiés (provenance affichée)
router.get('/', authorize('projects.read'), validate(listSchema, 'query'), asyncHandler(async (req, res) => {
  const { items, total, page, limit, disclaimer } = await service.listPublic(req.query);
  return success(res, { items, disclaimer }, {
    meta: { page: Number(page), limit: Number(limit), total: Number(total) },
  });
}));

router.post('/', authorize('projects.write'), validate(createSchema), asyncHandler(async (req, res) =>
  created(res, await service.create(req.body, req), {
    message: 'Projet créé en brouillon — provenance renseignée champ par champ',
  })));

router.get('/:id', authorize('projects.read'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.getOne(req.params.id, req))));

router.patch('/:id', authorize('projects.write'), validate(idParam, 'params'), validate(updateSchema),
  asyncHandler(async (req, res) =>
    success(res, await service.update(req.params.id, req.body, req), { message: 'Projet mis à jour' })));

router.post('/:id/submit', authorize('projects.write'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.submit(req.params.id, req), { message: 'Projet soumis à revue' })));

router.patch('/:id/review', authorize('projects.review'), validate(idParam, 'params'), validate(reviewSchema),
  asyncHandler(async (req, res) =>
    success(res, await service.review(req.params.id, req.body, req), { message: 'Décision de revue enregistrée' })));

export default router;
