import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success } from '../../shared/http/response.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './admin.notifications.service.js';
import { broadcastSchema, historyQuerySchema } from './admin.notifications.schema.js';

/**
 * SPEC-SUPER-ADMIN M7 (§6.2) — notifications système, montée par
 * `admin.routes.js` sous `/admin/notifications`.
 *
 * `POST /broadcast` diffuse une annonce interne ciblée (rôle/pays) ;
 * `GET /history` donne l'historique d'envois et le taux de délivrance SMS.
 */
export const adminNotificationsRouter = Router();

/** U-M7-1 — annonce interne ciblée (par rôle et/ou par pays). */
adminNotificationsRouter.post(
  '/broadcast',
  authorize('admin.users'),
  validate(broadcastSchema),
  asyncHandler(async (req, res) =>
    success(res, await service.broadcast(req.body, req), { message: 'Annonce diffusée' })),
);

/** U-M7-1 — historique d'envois + taux de délivrance (sms_batch_logs, sms_messages). */
adminNotificationsRouter.get(
  '/history',
  authorize('admin.users'),
  validate(historyQuerySchema, 'query'),
  asyncHandler(async (req, res) => success(res, await service.history(req.query))),
);
