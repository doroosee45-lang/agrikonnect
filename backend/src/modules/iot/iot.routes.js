import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './iot.service.js';

const registerSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  label: z.string().trim().min(2).max(160),
  plotId: z.string().min(10).max(60).optional(),
  serialNumber: z.string().trim().max(120).optional(),
  thresholds: z
    .record(z.object({ min: z.coerce.number().optional(), max: z.coerce.number().optional() }))
    .optional(),
});

const ingestSchema = z.object({
  deviceKey: z.string().min(10).max(200),
  readings: z
    .array(
      z.object({
        metric: z.string().trim().min(1).max(60),
        value: z.coerce.number(),
        unit: z.string().trim().max(20).optional(),
        quality: z.string().trim().max(40).optional(),
        at: z.coerce.date().optional(),
        /** Profondeur de la mesure en cm (CDC §5) : sans elle, une mesure de
         *  sonde à 60 cm et une mesure de surface sont indiscernables. */
        depthCm: z.coerce.number().min(0).max(5000).optional(),
        /** GeoJSON Point, quand la sonde est géolocalisée. */
        position: z
          .object({ type: z.literal('Point'), coordinates: z.array(z.number()).length(2) })
          .optional(),
        confidence: z.enum(['low', 'medium', 'high']).optional(),
        source: z
          .enum(['measured_sensor', 'measured_lab', 'measured_gpr', 'satellite', 'declared'])
          .optional(),
        /** Origine de la valeur : `REAL` par défaut. `SIMULATED` est refusé en
         *  production (src/shared/dataMode.js). */
        mode: z.enum(['REAL', 'CONFIGURATION', 'SIMULATED']).optional(),
      }),
    )
    .min(1)
    .max(500),
});

const idParam = z.object({ id: z.string().min(10).max(60) });

const router = Router();

// IOT-02 — ingestion authentifiée par la clé d'appareil (pas de JWT utilisateur)
router.post('/ingest', validate(ingestSchema), asyncHandler(async (req, res) =>
  created(res, await service.ingest(req.body, req), { message: 'Mesures acceptées' })));

router.use(authenticate, resolveTenant);

router.get('/devices', authorize('iot.read'), asyncHandler(async (req, res) =>
  success(res, await service.list(req))));

router.post('/devices', authorize('iot.write'), validate(registerSchema), asyncHandler(async (req, res) =>
  created(res, await service.register(req.body, req), { message: 'Appareil enregistré — clé affichée une seule fois' })));

router.post('/devices/:id/rotate-key', authorize('iot.write'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.rotateKey(req.params.id, req), { message: 'Clé tournée' })));

router.post('/devices/:id/revoke', authorize('iot.write'), validate(idParam, 'params'),
  validate(z.object({ reason: z.string().trim().min(5).max(500) })), asyncHandler(async (req, res) =>
    success(res, await service.revoke(req.params.id, req.body, req), { message: 'Appareil révoqué' })));

router.get('/devices/:id/readings', authorize('iot.read'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.readings(req.params.id, req.query, req))));

export default router;
