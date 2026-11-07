import { Router } from 'express';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { success, created, paginated } from '../../../shared/http/response.js';
import { authenticate } from '../../../middleware/auth.js';
import { resolveTenant } from '../../../middleware/tenant.js';
import { authorize } from '../../../middleware/authorize.js';
import { validate } from '../../../middleware/validate.js';
import * as service from './requests.service.js';
import * as schema from './requests.schema.js';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', authorize('requests.read'), validate(schema.listRequestsSchema, 'query'), asyncHandler(async (req, res) => {
  const { items, total, page, limit } = await service.list(req.query, req);
  return paginated(res, items, { page, limit, total });
}));

router.post('/', authorize('requests.write'), validate(schema.createRequestSchema), asyncHandler(async (req, res) =>
  created(res, await service.create(req.body, req), { message: 'Demande d\'achat publiée' })));

router.get('/:id', authorize('requests.read'), validate(schema.requestIdParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.getOne(req.params.id, req))));

router.patch('/:id', authorize('requests.write'), validate(schema.requestIdParam, 'params'),
  validate(schema.updateRequestSchema), asyncHandler(async (req, res) =>
    success(res, await service.update(req.params.id, req.body, req), { message: 'Demande mise à jour' })));

// REQ-02 — matching explicable
router.get('/:id/matches', authorize('requests.read'), validate(schema.requestIdParam, 'params'),
  validate(schema.matchesQuerySchema, 'query'), asyncHandler(async (req, res) =>
    success(res, await service.matches(req.params.id, req.query, req))));

export default router;
