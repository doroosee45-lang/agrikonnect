/**
 * Routes du module anomalies.
 *
 * Une détection sans assez de mesures est un **200** portant `detected: false`
 * et son motif : « pas assez de données » est une réponse informative, pas un
 * échec du service.
 */
import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created, paginated } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './anomalies.service.js';
import {
  anomalyPathSchema,
  devicePathSchema,
  listQuerySchema,
  plotPathSchema,
  reviewSchema,
} from './anomalies.schema.js';

const router = Router();
router.use(authenticate, resolveTenant);

/**
 * GET /anomalies/settings — seuils appliqués et leur statut.
 *
 * Rend visible que les seuils sont provisoires : un verdict statistique doit
 * pouvoir être contesté, et on ne peut pas le contester sans connaître le seuil.
 */
router.get(
  '/settings',
  authorize('anomaly.read'),
  asyncHandler(async (req, res) => success(res, await service.getSettings())),
);

// GET /anomalies — liste filtrable et paginée.
router.get(
  '/',
  authorize('anomaly.read'),
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await service.listAnomalies(req.query, req);
    return paginated(res, result.items, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      message: result.thresholdsProvisional
        ? 'Anomalies détectées avec des seuils provisoires, à recaler sur les données du pilote'
        : undefined,
    });
  }),
);

// GET /anomalies/:anomalyId — détail, mesure et sonde comprises.
router.get(
  '/:anomalyId',
  authorize('anomaly.read'),
  validate(anomalyPathSchema, 'params'),
  asyncHandler(async (req, res) => success(res, await service.getAnomaly(req.params.anomalyId, req))),
);

// POST /anomalies/devices/:deviceId/detect — détection sur une sonde.
router.post(
  '/devices/:deviceId/detect',
  authorize('anomaly.write'),
  validate(devicePathSchema, 'params'),
  asyncHandler(async (req, res) => {
    const result = await service.detectForDevice(req.params.deviceId, req);
    if (!result.detected) {
      return success(res, result, { message: 'Détection refusée : pas assez de mesures' });
    }
    return created(res, result, { message: 'Détection d’anomalies effectuée' });
  }),
);

// POST /anomalies/plots/:plotId/detect — détection sur toutes les sondes d'une parcelle.
router.post(
  '/plots/:plotId/detect',
  authorize('anomaly.write'),
  validate(plotPathSchema, 'params'),
  asyncHandler(async (req, res) => created(res, await service.detectForPlot(req.params.plotId, req), {
    message: 'Détection d’anomalies effectuée sur la parcelle',
  })),
);

/**
 * POST /anomalies/:anomalyId/review — confirmation ou rejet par un agronome.
 *
 * La réponse indique explicitement si la mesure reste écartée : l'effet d'un
 * rejet ne doit pas rester implicite.
 */
router.post(
  '/:anomalyId/review',
  authorize('anomaly.review'),
  validate(anomalyPathSchema, 'params'),
  validate(reviewSchema),
  asyncHandler(async (req, res) =>
    success(res, await service.reviewAnomaly(req.params.anomalyId, req.body, req), {
      message: req.body.decision === 'DISMISSED'
        ? 'Anomalie rejetée : la mesure est réhabilitée et réintègre le calcul'
        : 'Anomalie confirmée : la mesure reste écartée du calcul',
    })),
);

export default router;
