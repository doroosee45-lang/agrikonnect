import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './geodata.service.js';

const plotParam = z.object({ plotId: z.string().min(10).max(60) });

const satelliteSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  plotId: z.string().min(10).max(60),
  provider: z.string().trim().min(2).max(80),
  index: z.string().trim().max(20).default('NDVI'),
  value: z.coerce.number().min(-1).max(100),
  observedAt: z.coerce.date(),
  cloudCover: z.coerce.number().min(0).max(100).optional(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
});

const droneSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  plotId: z.string().min(10).max(60),
  operatorOrgId: z.string().min(10).max(60).optional(),
  type: z.string().trim().min(2).max(80),
  storageKey: z.string().max(500).optional(),
  reportKey: z.string().max(500).optional(),
  flownAt: z.coerce.date(),
});

const labSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  plotId: z.string().min(10).max(60),
  sampleId: z.string().trim().min(2).max(80),
  sampledAt: z.coerce.date(),
  parameters: z.record(z.any()),
  reportKey: z.string().max(500).optional(),
});

const router = Router();
router.use(authenticate, resolveTenant);

// Vue consolidée toutes sources confondues (provenance affichée)
router.get('/plots/:plotId/observations', authorize('geodata.read'), validate(plotParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.plotObservations(req.params.plotId, req))));

// GEO-01 — satellite
router.get('/plots/:plotId/satellite', authorize('geodata.read'), validate(plotParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.satelliteSeries(req.params.plotId, req.query, req))));

router.post('/satellite', authorize('geodata.write'), validate(satelliteSchema), asyncHandler(async (req, res) =>
  created(res, await service.recordSatellite(req.body, req), { message: 'Observation satellite enregistrée' })));

// GEO-02 — drone
router.get('/plots/:plotId/drones', authorize('geodata.read'), validate(plotParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.listDroneSurveys(req.params.plotId, req))));

router.post('/drones', authorize('geodata.write'), validate(droneSchema), asyncHandler(async (req, res) =>
  created(res, await service.recordDroneSurvey(req.body, req), { message: 'Mission drone enregistrée' })));

// GEO-03 — laboratoire
router.get('/plots/:plotId/lab-results', authorize('lab.read'), validate(plotParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.labResults(req.params.plotId, req))));

router.post('/lab-results', authorize('lab.write'), validate(labSchema), asyncHandler(async (req, res) =>
  created(res, await service.recordLabResult(req.body, req), { message: 'Résultat de laboratoire publié' })));

export default router;
