import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { paginationSchema } from '../../shared/pagination.js';
import * as service from './notifications.service.js';

const listSchema = paginationSchema.omit({ sort: true, order: true }).extend({
  unread: z.enum(['true', 'false']).optional(),
});

const preferencesSchema = z.object({
  preferences: z
    .array(
      z.object({
        type: z.string().trim().min(2).max(80),
        channel: z.enum(['IN_APP', 'EMAIL', 'PUSH', 'SMS']),
        enabled: z.boolean(),
      }),
    )
    .min(1)
    .max(100),
});

const idParam = z.object({ id: z.string().min(5).max(60) });

const router = Router();
router.use(authenticate);

// NOTIF-01 — boîte de réception de l'utilisateur courant
router.get('/', authorize('notifications.read'), validate(listSchema, 'query'), asyncHandler(async (req, res) => {
  const { items, total, page, limit, unreadCount } = await service.list(req.query, req);
  return success(res, { items, unreadCount }, {
    meta: { page: Number(page), limit: Number(limit), total: Number(total) },
  });
}));

router.post('/read-all', authorize('notifications.write'), asyncHandler(async (req, res) =>
  success(res, await service.markAllRead(req), { message: 'Notifications marquées comme lues' })));

router.post('/:id/read', authorize('notifications.write'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.markRead(req.params.id, req))));

// NOTIF-03 — préférences par type × canal
router.get('/preferences', authorize('notifications.read'), asyncHandler(async (req, res) =>
  success(res, await service.getPreferences(req))));

router.put('/preferences', authorize('notifications.write'), validate(preferencesSchema), asyncHandler(async (req, res) =>
  success(res, await service.setPreferences(req.body.preferences, req), { message: 'Préférences enregistrées' })));

export default router;
