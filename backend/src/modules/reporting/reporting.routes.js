import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './reporting.service.js';

const projectParam = z.object({ projectId: z.string().min(10).max(60) });

const progressSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  period: z.string().trim().min(2).max(40),
  production: z.record(z.any()).optional(),
  progress: z.string().trim().max(5000).optional(),
  expenses: z.record(z.any()).optional(),
  photos: z.array(z.string().max(500)).max(20).default([]),
});

const impactSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  period: z.string().trim().min(2).max(40),
  source: z.enum(['declared', 'platform_verified', 'third_party_verified', 'measured_lab', 'measured_sensor', 'estimated', 'derived']).default('declared'),
  indicators: z
    .array(
      z.object({
        key: z.string().trim().min(2).max(80),
        label: z.string().trim().min(2).max(160),
        value: z.union([z.coerce.number(), z.string().max(120)]),
        unit: z.string().trim().max(20).optional(),
        source: z.enum(['declared', 'platform_verified', 'third_party_verified', 'measured_lab', 'measured_sensor', 'estimated', 'derived']).default('declared'),
        method: z.string().trim().max(200).optional(),
      }),
    )
    .min(1, 'Au moins un indicateur est requis'),
});

const router = Router();
// Monté sur '/' : chemins /projects/:projectId/reports, …/progress-reports, …/impact-reports.
router.use('/projects', authenticate, resolveTenant);

router.get('/projects/:projectId/reports', authorize('reporting.read'), validate(projectParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.listForProject(req.params.projectId, req))));

// REP-01 — avancement
router.post('/projects/:projectId/progress-reports', authorize('reporting.write'),
  validate(projectParam, 'params'), validate(progressSchema), asyncHandler(async (req, res) =>
    created(res, await service.createProgress(req.params.projectId, req.body, req), { message: 'Rapport d\'avancement publié' })));

// REP-02 — impact (source obligatoire par indicateur)
router.post('/projects/:projectId/impact-reports', authorize('reporting.write'),
  validate(projectParam, 'params'), validate(impactSchema), asyncHandler(async (req, res) =>
    created(res, await service.createImpact(req.params.projectId, req.body, req), {
      message: 'Rapport d\'impact publié avec sa provenance',
    })));

export default router;
