/**
 * Routes de surveillance des recommandations (CDC §8).
 *
 * Lecture et suivi des alertes uniquement : **aucune route ne crée d'alerte**.
 * Les alertes naissent du job `recommendations.monitor`, qui compare les
 * mesures et les prévisions aux seuils. Exposer une création manuelle
 * permettrait de fabriquer une alerte sans mesure derrière — exactement ce que
 * le cahier des charges interdit.
 *
 * Comme partout, `authenticate` + `resolveTenant` précèdent tout : l'
 * `organizationId` vient du jeton, jamais de la requête.
 */
import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './alerts.service.js';
import { alertIdParam, listAlertsQuery } from './alerts.schema.js';
import { describeAlertFilters } from './alertLabels.js';

const router = Router();
router.use(authenticate, resolveTenant);

// GET /alerts — boîte d'alertes de l'organisation.
router.get(
  '/',
  authorize('alerts.read'),
  validate(listAlertsQuery, 'query'),
  asyncHandler(async (req, res) => {
    const result = await service.list(req.query, req);
    // `success` et non `paginated` : le compte d'alertes ouvertes doit
    // accompagner la page, et `paginated` ne transporte pas de meta supplémentaire.
    return success(res, result.items, {
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        openCount: result.openCount,
      },
    });
  }),
);

/*
 * GET /alerts/meta — valeurs de filtre et leurs libellés.
 *
 * Déclarée **avant** `/:id` : Express teste les routes dans l'ordre, et
 * `/alerts/meta` placé après serait avalé par `/alerts/:id` avec `id = 'meta'`.
 *
 * Aucune permission spécifique : ce sont des métadonnées d'affichage, pas des
 * données de parcelle. `alerts.read` suffit à ouvrir la boîte d'alertes.
 */
router.get(
  '/meta',
  authorize('alerts.read'),
  asyncHandler(async (req, res) => success(res, describeAlertFilters())),
);

// GET /alerts/:id — détail, avec la proposition de remplacement éventuelle.
router.get(
  '/:id',
  authorize('alerts.read'),
  validate(alertIdParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.get(req.params.id, req))),
);

// POST /alerts/:id/read — l'agriculteur a vu l'alerte.
router.post(
  '/:id/read',
  authorize('alerts.read'),
  validate(alertIdParam, 'params'),
  asyncHandler(async (req, res) =>
    success(res, await service.markRead(req.params.id, req), { message: 'Alerte marquée comme lue' }),
  ),
);

/**
 * POST /alerts/:id/handled — l'agriculteur a agi.
 *
 * Effet important : une alerte traitée ne re-notifie plus. C'est le seul moyen
 * de clore un épisode sans être relancé à chaque passage du job.
 */
router.post(
  '/:id/handled',
  authorize('alerts.write'),
  validate(alertIdParam, 'params'),
  asyncHandler(async (req, res) =>
    success(res, await service.markHandled(req.params.id, req), { message: 'Alerte marquée comme traitée' }),
  ),
);

export default router;
