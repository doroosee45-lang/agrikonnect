import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { authorize, requireSuperAdmin } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './admin.monitoring.controller.js';
import { jobNameParam, runJobSchema } from './admin.monitoring.schema.js';

/**
 * SPEC-SUPER-ADMIN M5 (§6.2) — routes de supervision, montées par
 * `admin.routes.js` sous `/admin/jobs` et `/admin/monitoring`.
 *
 * `jobsRouter` porte la console des tâches (état, exécution manuelle) ;
 * `monitoringRouter` porte l'état des services externes et la santé technique.
 * Les routes de **gouvernance** (pause/reprise) passent par `requireSuperAdmin`
 * (palier 2, RG-G1 — second facteur exigé).
 */

/** M5 — console des tâches planifiées (`/admin/jobs…`). */
export const jobsRouter = Router();

jobsRouter.get('/', authorize('admin.jobs'), asyncHandler(controller.jobs));

jobsRouter.post(
  '/:name/run',
  authorize('admin.jobs'),
  validate(jobNameParam, 'params'),
  validate(runJobSchema),
  asyncHandler(controller.runJob),
);

/** U-M5-2 — pause/reprise : palier 2 (SUPER_ADMIN + MFA), auditées. */
jobsRouter.post(
  '/:name/pause',
  requireSuperAdmin,
  validate(jobNameParam, 'params'),
  asyncHandler(controller.pauseJob),
);

jobsRouter.post(
  '/:name/resume',
  requireSuperAdmin,
  validate(jobNameParam, 'params'),
  asyncHandler(controller.resumeJob),
);

/** M5 — services externes et santé technique (`/admin/monitoring…`). */
export const monitoringRouter = Router();

monitoringRouter.get('/services', authorize('admin.jobs'), asyncHandler(controller.services));

monitoringRouter.get('/health', authorize('admin.jobs'), asyncHandler(controller.health));
