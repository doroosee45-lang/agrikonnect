import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './weather.service.js';

const recordSchema = z.object({
  plotId: z.string().min(10).max(60).optional(),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  observedAt: z.coerce.date(),
  source: z.string().trim().min(2).max(80),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
  payload: z.record(z.any()),
});

const plotParam = z.object({ plotId: z.string().min(10).max(60) });

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/plots/:plotId', authorize('weather.read'), validate(plotParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.forPlot(req.params.plotId, req.query, req))));

router.get('/plots/:plotId/history', authorize('weather.read'), validate(plotParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.history(req.params.plotId, req.query, req))));

router.get('/plots/:plotId/alerts', authorize('weather.read'), validate(plotParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.alerts(req.params.plotId, req))));

router.post('/', authorize('weather.read'), validate(recordSchema), asyncHandler(async (req, res) =>
  created(res, await service.record(req.body, req), { message: 'Observation météo enregistrée avec sa source' })));

export default router;
