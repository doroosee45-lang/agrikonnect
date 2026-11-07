import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created, paginated, noContent } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { paginationSchema } from '../../shared/pagination.js';
import * as service from './certifications.service.js';

const createSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  type: z.string().trim().min(2).max(80),
  issuer: z.string().trim().min(2).max(160),
  reference: z.string().trim().max(120).optional(),
  issuedAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  documentId: z.string().max(60).optional(),
});

const listSchema = paginationSchema.extend({
  status: z.enum(['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED']).optional(),
  type: z.string().max(80).optional(),
});

const verifySchema = z.object({
  decision: z.enum(['VERIFIED', 'REJECTED']),
  comment: z.string().trim().max(500).optional(),
});

const idParam = z.object({ id: z.string().min(10).max(60) });
const orgParam = z.object({ organizationId: z.string().min(10).max(60) });

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', authorize('certifications.read'), validate(listSchema, 'query'), asyncHandler(async (req, res) => {
  const { items, total, page, limit } = await service.list(req.query, req);
  return paginated(res, items, { page, limit, total });
}));

router.post('/', authorize('certifications.write'), validate(createSchema), asyncHandler(async (req, res) =>
  created(res, await service.create(req.body, req), {
    message: 'Certification déclarée — en attente de vérification',
  })));

router.get('/organization/:organizationId', authorize('certifications.read'), validate(orgParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.trusted(req.params.organizationId))));

router.get('/:id', authorize('certifications.read'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.getOne(req.params.id, req))));

// CERT-02 — décision administrative
router.patch('/:id/verify', authorize('certifications.verify'), validate(idParam, 'params'),
  validate(verifySchema), asyncHandler(async (req, res) =>
    success(res, await service.verify(req.params.id, req.body, req), { message: 'Décision enregistrée' })));

router.delete('/:id', authorize('certifications.write'), validate(idParam, 'params'), asyncHandler(async (req, res) => {
  await service.remove(req.params.id, req);
  return noContent(res);
}));

export default router;
