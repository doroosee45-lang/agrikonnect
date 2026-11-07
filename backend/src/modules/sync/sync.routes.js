import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './sync.service.js';

const operationSchema = z.object({
  opId: z.string().min(10).max(64),
  collection: z.string().trim().min(2).max(40),
  operation: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  entityId: z.string().min(10).max(60),
  baseVersion: z.coerce.number().int().min(0).optional(),
  payload: z.record(z.any()).optional(),
});

const pushSchema = z.object({ operations: z.array(operationSchema).min(1).max(200) });

const pullSchema = z.object({
  since: z.string().datetime({ offset: true }).optional(),
  collections: z.string().trim().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

const reportSchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  onlyConflicts: z.enum(['true', 'false']).optional(),
});

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/collections', authorize('sync.write'), asyncHandler(async (_req, res) =>
  success(res, service.collections())));

router.post('/push', authorize('sync.write'), validate(pushSchema), asyncHandler(async (req, res) =>
  success(res, await service.push(req.body, req), { message: 'Lot de synchronisation traité' })));

router.get('/pull', authorize('sync.write'), validate(pullSchema, 'query'), asyncHandler(async (req, res) =>
  success(res, await service.pull(req.query, req))));

router.get('/conflicts', authorize('sync.write'), validate(reportSchema, 'query'), asyncHandler(async (req, res) =>
  success(res, await service.conflictReport(req.query, req))));

export default router;
