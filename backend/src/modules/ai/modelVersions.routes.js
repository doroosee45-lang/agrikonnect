/**
 * Routes de versionnage des modèles.
 *
 * Deux points de conception visibles dans le contrat :
 *
 *  - `beatsBaseline` n'est **pas** un champ du corps de requête. Il est calculé
 *    par le service à partir de `metrics` et `baselineMetrics` : un appelant ne
 *    peut pas déclarer son modèle meilleur qu'il ne l'est.
 *  - la promotion est un acte distinct de l'enregistrement, et elle échoue (409)
 *    tant que la comparaison au moteur à règles n'est pas favorable.
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './modelVersions.service.js';

const idParam = z.object({ id: z.string().min(10).max(60) });

/**
 * Métriques libres en clé/valeur numérique.
 *
 * Libre, parce que la métrique pertinente dépend de la famille (MAE, F1,
 * précision@k…). Ce qui est contraint, c'est la **comparaison** : le service
 * sait quelle clé lire pour chaque famille, et refuse de promouvoir sans elle.
 */
const metricsSchema = z.record(z.union([z.number(), z.string(), z.boolean(), z.null()])).refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Au moins une métrique est requise' },
);

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  version: z.string().trim().min(1).max(40),
  kind: z.enum(service.MODEL_KINDS),
  /**
   * Provenance du jeu d'entraînement. Obligatoire : sans elle, une métrique
   * flatteuse est invérifiable — et c'est exactement ce que la traçabilité du
   * cahier des charges vise à empêcher.
   */
  datasetDescription: z.string().trim().min(5).max(2000),
  metrics: metricsSchema,
  /**
   * Métriques du moteur à règles **sur le même découpage**. Sans référence, la
   * comparaison est impossible et la promotion reste bloquée.
   */
  baselineMetrics: metricsSchema.nullable().optional(),
  artifactKey: z.string().trim().max(500).nullable().optional(),
  trainedAt: z.coerce.date().nullable().optional(),
  /** Modèle commun à toutes les organisations (référentiel), sinon propre au tenant. */
  shared: z.boolean().default(false),
});

const listQuery = z.object({
  kind: z.enum(service.MODEL_KINDS).optional(),
  status: z.enum(['TESTING', 'PRODUCTION', 'RETIRED']).optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

const router = Router();
router.use(authenticate, resolveTenant);

// GET /ai/models — versions accessibles au tenant, y compris les partagées.
router.get(
  '/',
  authorize('models.read'),
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => success(res, await service.list(req.query, req))),
);

// POST /ai/models — enregistrement, toujours en TESTING.
router.post(
  '/',
  authorize('models.write'),
  validate(registerSchema),
  asyncHandler(async (req, res) =>
    created(res, await service.register(req.body, req), { message: 'Version enregistrée en test' }),
  ),
);

// GET /ai/models/:id — détail avec métriques et comparaison.
router.get(
  '/:id',
  authorize('models.read'),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.getOne(req.params.id, req))),
);

/**
 * POST /ai/models/:id/promote — entrée en production.
 *
 * 409 si le modèle ne bat pas le moteur à règles, **ou si la comparaison est
 * impossible** : l'absence de preuve n'est pas une preuve.
 */
router.post(
  '/:id/promote',
  authorize('models.promote'),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) =>
    success(res, await service.promote(req.params.id, req), { message: 'Version promue en production' }),
  ),
);

// POST /ai/models/:id/retire — sortie du service, historique conservé.
router.post(
  '/:id/retire',
  authorize('models.write'),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) =>
    success(res, await service.retire(req.params.id, req), { message: 'Version retirée du service' }),
  ),
);

export default router;
