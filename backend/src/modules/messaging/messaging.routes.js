import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created, paginated } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { paginationSchema } from '../../shared/pagination.js';
import * as service from './messaging.service.js';

const startSchema = z.object({
  subjectType: z.enum(['LISTING', 'ORDER', 'TRANSPORT', 'DISPUTE', 'PROJECT']),
  subjectId: z.string().min(10).max(60),
  participantOrgIds: z.array(z.string().min(10).max(60)).min(1).max(5),
  firstMessage: z.string().trim().max(3000).optional(),
});

const messageSchema = z.object({
  body: z.string().trim().min(1, 'Message vide').max(3000),
  attachments: z.array(z.string().max(500)).max(5).default([]),
});

const listSchema = paginationSchema.omit({ sort: true, order: true });

/** Fil de discussion : curseur `before` plutôt que page/limit. */
const threadSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z.string().datetime({ offset: true }).optional(),
});

const idParam = z.object({ id: z.string().min(10).max(60) });

const router = Router();
router.use(authenticate, resolveTenant);

// MSG-01 — une conversation est toujours rattachée à un objet métier
router.post('/conversations', authorize('messages.write'), validate(startSchema), asyncHandler(async (req, res) => {
  const { conversation, replayed } = await service.startConversation(req.body, req);
  return replayed
    ? success(res, conversation, { message: 'Conversation existante réutilisée' })
    : created(res, conversation, { message: 'Conversation ouverte' });
}));

router.get('/conversations', authorize('messages.read'), validate(listSchema, 'query'), asyncHandler(async (req, res) => {
  const { items, total, page, limit, totalUnread } = await service.listConversations(req.query, req);
  return success(res, { items, totalUnread }, {
    meta: { page: Number(page), limit: Number(limit), total: Number(total), totalPages: Math.ceil(total / limit) },
  });
}));

router.get('/conversations/:id/messages', authorize('messages.read'), validate(idParam, 'params'),
  validate(threadSchema, 'query'), asyncHandler(async (req, res) => {
    const { conversation, items, hasMore, nextCursor } = await service.listMessages(req.params.id, req.query, req);
    return success(res, { conversation, messages: items }, {
      meta: { hasMore, nextCursor, count: items.length },
    });
  }));

router.post('/conversations/:id/messages', authorize('messages.write'), validate(idParam, 'params'),
  validate(messageSchema), asyncHandler(async (req, res) =>
    created(res, await service.postMessage(req.params.id, req.body, req), { message: 'Message envoyé' })));

router.post('/conversations/:id/archive', authorize('messages.write'), validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.archiveConversation(req.params.id, req), { message: 'Conversation archivée' })));

// Modération : blocage d'un fil (plus aucun message possible)
router.post('/conversations/:id/block', authorize('messages.moderate'), validate(idParam, 'params'),
  validate(z.object({ reason: z.string().trim().min(5, 'Motif requis').max(500) })), asyncHandler(async (req, res) =>
    success(res, await service.blockConversation(req.params.id, req.body, req), { message: 'Conversation bloquée' })));

// MSG-03 — signalement
router.post('/messages/:id/report', authorize('messages.write'), validate(idParam, 'params'),
  validate(z.object({ reason: z.string().trim().min(5, 'Motif requis').max(500) })), asyncHandler(async (req, res) =>
    created(res, await service.reportMessage(req.params.id, req.body, req), { message: 'Signalement transmis à la modération' })));

export default router;
