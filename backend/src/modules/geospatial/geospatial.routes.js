/**
 * Exigences CDC couvertes : SOIL-10 → SOIL-14, GEO-01 → GEO-03.
 *
 * Deux routeurs :
 *  - `plotsRouter` monté sur `/plots` : diagnostic de sol rattaché à la parcelle ;
 *  - `default` monté sur `/geospatial` : briques de calcul unitaires (texture,
 *    indices spectraux, imagerie) et supervision du moteur Python.
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './geospatial.service.js';
import {
  analyzeImagery,
  classifyTexture,
  engineMeta,
  fuseObservations,
  phenology,
  spectralIndices,
  subsurfaceProfile,
  sensorQuality,
} from '../../integrations/geospatial.js';

const plotParam = z.object({ plotId: z.string().min(10).max(60) });
const idParam = z.object({ id: z.string().min(10).max(60) });

const bandMatrix = z.array(z.array(z.number())).min(1);

const diagnoseSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  slopePct: z.coerce.number().min(0).max(100).optional(),
  rainfallMm: z.coerce.number().min(0).max(12000).optional(),
  sensorDepthCm: z.coerce.number().min(5).max(300).optional(),
  allowRecommendations: z.boolean().optional(),
  scenes: z
    .array(
      z.object({
        scene: z
          .object({
            id: z.string().max(120).optional(),
            capturedAt: z.string().max(40).optional(),
            resolutionM: z.coerce.number().min(0.1).max(1000).optional(),
            grid: z.object({ bbox: z.array(z.number()).length(4), width: z.number().int().positive(), height: z.number().int().positive() }).optional(),
          })
          .optional(),
        bands: z.record(bandMatrix),
      }),
    )
    .max(12)
    .optional(),
  series: z.array(z.object({ date: z.string().max(40), ndvi: z.number().min(-1).max(1) })).max(400).optional(),
  imagery: z
    .object({
      camera: z.object({ base64: z.string().max(8_000_000).optional(), path: z.string().max(500).optional(), pixels: z.any().optional() }).optional(),
      drone: z
        .object({
          base64: z.string().max(8_000_000).optional(),
          path: z.string().max(500).optional(),
          pixels: z.any().optional(),
          chm: z.any().optional(),
          flight: z.object({ gsdCm: z.number().optional(), capturedAt: z.string().optional(), sensor: z.string().optional() }).optional(),
        })
        .optional(),
    })
    .optional(),
  declared: z.record(z.number()).optional(),
});

const textureSchema = z.object({
  sand: z.coerce.number().min(0).max(100),
  silt: z.coerce.number().min(0).max(100),
  clay: z.coerce.number().min(0).max(100),
});

const spectralSchema = z.object({
  scene: z
    .object({
      id: z.string().max(120).optional(),
      capturedAt: z.string().max(40).optional(),
      resolutionM: z.coerce.number().positive().optional(),
      grid: z.object({ bbox: z.array(z.number()).length(4), width: z.number().int().positive(), height: z.number().int().positive() }).optional(),
    })
    .optional(),
  bands: z.record(bandMatrix),
  geometry: z.any().optional(),
});

const imagerySchema = z.object({
  kind: z.enum(['camera', 'drone']).default('camera'),
  base64: z.string().max(8_000_000).optional(),
  path: z.string().max(500).optional(),
  pixels: z.any().optional(),
  chm: z.any().optional(),
  flight: z.object({ gsdCm: z.number().optional(), capturedAt: z.string().optional(), sensor: z.string().optional() }).optional(),
});

const sensorSchema = z.object({
  readings: z.array(z.object({ at: z.string().max(40), value: z.union([z.number(), z.string()]) })).min(1).max(5000),
  unit: z.string().max(20).optional(),
  depthCm: z.coerce.number().min(0).max(300).optional(),
});

const fusionSchema = z.object({
  observations: z
    .array(
      z.object({
        parameter: z.string().min(1).max(40),
        value: z.union([z.number(), z.string()]),
        source: z.enum(['lab', 'sensor', 'satellite', 'drone', 'camera', 'declared']),
        unit: z.string().max(20).optional(),
        quality: z.number().min(0).max(1).optional(),
        measuredAt: z.string().max(40).optional(),
      }),
    )
    .min(1)
    .max(500),
});

// Un prélèvement sans profondeur ne décrit aucun horizon : `depthCm` ou `topCm`
// est requis (le moteur Python accepte les deux noms).
const subsurfaceSchema = z.object({
  samples: z
    .array(
      z
        .object({
          depthCm: z.coerce.number().min(0).max(5000).optional(),
          topCm: z.coerce.number().min(0).max(5000).optional(),
          thicknessCm: z.coerce.number().min(0).max(1000).optional(),
          sand: z.coerce.number().min(0).max(100).optional(),
          silt: z.coerce.number().min(0).max(100).optional(),
          clay: z.coerce.number().min(0).max(100).optional(),
          organicMatter: z.coerce.number().min(0).max(100).optional(),
          ph: z.coerce.number().min(0).max(14).optional(),
          lithology: z.string().max(60).optional(),
          bedrock: z.boolean().optional(),
        })
        .refine((sample) => sample.depthCm !== undefined || sample.topCm !== undefined, {
          message: 'depthCm ou topCm est requis',
        }),
    )
    .min(1)
    .max(200),
});

const phenologySchema = z.object({
  series: z
    .array(z.object({ date: z.string().max(40), ndvi: z.number().min(-1).max(1) }))
    .min(1)
    .max(400),
});

/* ─────────────────────────── routes liées à la parcelle ─────────────────────────── */
export const plotsRouter = Router();
plotsRouter.use(authenticate, resolveTenant);

// SOIL-14 — le diagnostic expose le profil de sol complet (sol + sous-sol).
plotsRouter.post(
  '/:plotId/soil-diagnosis',
  authorize('geospatial.write'),
  validate(plotParam, 'params'),
  validate(diagnoseSchema),
  asyncHandler(async (req, res) =>
    created(res, await service.diagnose(req.params.plotId, req.body, req), {
      message: 'Diagnostic de sol calculé par le moteur géospatial',
    }),
  ),
);

plotsRouter.get(
  '/:plotId/soil-diagnosis',
  authorize('geospatial.read'),
  validate(plotParam, 'params'),
  validate(z.object({ limit: z.coerce.number().int().min(1).max(100).optional() }), 'query'),
  asyncHandler(async (req, res) => success(res, await service.listDiagnoses(req.params.plotId, req.query, req))),
);

plotsRouter.get(
  '/:plotId/soil-diagnosis/latest',
  authorize('geospatial.read'),
  validate(plotParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.latestDiagnosis(req.params.plotId, req))),
);

/* ─────────────────────────── routes moteur ─────────────────────────── */
const router = Router();
router.use(authenticate, resolveTenant);

router.get(
  '/health',
  authorize('geospatial.read'),
  asyncHandler(async (req, res) => success(res, await service.health())),
);

router.get(
  '/methods',
  authorize('geospatial.read'),
  asyncHandler(async (req, res) => {
    const meta = await engineMeta();
    if (!meta) {
      return success(res, {
        available: false,
        methodVersion: service.METHOD_VERSION,
        note: 'Moteur indisponible : les seuils et méthodes ne peuvent pas être interrogés.',
      });
    }
    return success(res, meta);
  }),
);

router.get(
  '/soil-diagnostics/:id',
  authorize('geospatial.read'),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.getDiagnosis(req.params.id, req))),
);

// SOIL-10 / SOIL-11 — briques de calcul exposées telles quelles, avec provenance.
router.post(
  '/texture',
  authorize('geospatial.read'),
  validate(textureSchema),
  asyncHandler(async (req, res) => success(res, await classifyTexture(req.body))),
);

router.post(
  '/spectral',
  authorize('geospatial.write'),
  validate(spectralSchema),
  asyncHandler(async (req, res) => success(res, await spectralIndices(req.body))),
);

router.post(
  '/imagery',
  authorize('geospatial.write'),
  validate(imagerySchema),
  asyncHandler(async (req, res) => success(res, await analyzeImagery(req.body))),
);

router.post(
  '/sensors/quality',
  authorize('geospatial.write'),
  validate(sensorSchema),
  asyncHandler(async (req, res) => success(res, await sensorQuality(req.body))),
);

router.post(
  '/fusion',
  authorize('geospatial.write'),
  validate(fusionSchema),
  asyncHandler(async (req, res) => success(res, await fuseObservations(req.body))),
);

// SOIL-13 — sous-sol : horizons segmentés sur des ruptures mesurées, jamais devinées.
router.post(
  '/subsurface',
  authorize('geospatial.write'),
  validate(subsurfaceSchema),
  asyncHandler(async (req, res) => success(res, await subsurfaceProfile(req.body))),
);

// GEO-02 — phénologie d'une série NDVI : « non déterminable » sous 4 observations.
router.post(
  '/spectral/phenology',
  authorize('geospatial.write'),
  validate(phenologySchema),
  asyncHandler(async (req, res) => success(res, await phenology(req.body))),
);

export default router;
