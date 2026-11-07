import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './prices.service.js';

const listSchema = z.object({
  cropId: z.string().max(60).optional(),
  market: z.string().max(120).optional(),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
  since: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const seriesSchema = z.object({
  cropId: z.string().min(1).max(60),
  market: z.string().max(120).optional(),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
  days: z.coerce.number().int().min(1).max(365).default(90),
});

const recordSchema = z.object({
  cropId: z.string().min(1).max(60),
  market: z.string().trim().min(2).max(120),
  city: z.string().trim().max(120).optional(),
  countryCode: z.string().trim().length(2).toUpperCase(),
  price: z.coerce.number().positive(),
  currency: z.string().trim().length(3).toUpperCase(),
  unit: z.string().trim().min(1).max(20),
  observedAt: z.coerce.date(),
  source: z.enum(['AGENT', 'PARTNER', 'DECLARED_AGGREGATE']),
  sourceLabel: z.string().trim().max(120).optional(),
});

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', authorize('prices.read'), validate(listSchema, 'query'), asyncHandler(async (req, res) =>
  success(res, await service.list(req.query, req))));

router.get('/series', authorize('prices.read'), validate(seriesSchema, 'query'), asyncHandler(async (req, res) =>
  success(res, await service.series(req.query, req))));

// PRI-03 — relevé de terrain (agent ou partenaire)
router.post('/', authorize('prices.write'), validate(recordSchema), asyncHandler(async (req, res) =>
  created(res, await service.record(req.body, req), { message: 'Relevé de prix enregistré' })));

router.get('/stale-markets', authorize('prices.write'), asyncHandler(async (_req, res) =>
  success(res, await service.staleMarkets())));

export default router;
