import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { success, created } from '../../../shared/http/response.js';
import { authenticate } from '../../../middleware/auth.js';
import { resolveTenant } from '../../../middleware/tenant.js';
import { authorize } from '../../../middleware/authorize.js';
import { validate } from '../../../middleware/validate.js';
import * as service from './reviews.service.js';

const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1500).optional(),
});

const orderParam = z.object({ orderId: z.string().min(10).max(60) });
const reviewParam = z.object({ id: z.string().min(10).max(60) });
const orgParam = z.object({ organizationId: z.string().min(10).max(60) });

const router = Router();
// Chemins absolus depuis la racine de l'API (/api/v1) : /orders/:id/reviews,
// /reviews/:id/…, /organizations/:id/reputation. Le routeur est donc monté sur '/'
// et l'authentification est appliquée par préfixe (un `router.use` global
// intercepterait les routes publiques enregistrées après ce point).
router.use(['/orders', '/reviews', '/organizations'], authenticate, resolveTenant);

router.post('/orders/:orderId/reviews', authorize('reviews.write'), validate(orderParam, 'params'),
  validate(createReviewSchema), asyncHandler(async (req, res) =>
    created(res, await service.createForOrder(req.params.orderId, req.body, req), { message: 'Avis publié' })));

router.post('/reviews/:id/response', authorize('reviews.write'), validate(reviewParam, 'params'),
  validate(z.object({ response: z.string().trim().min(5).max(1500) })), asyncHandler(async (req, res) =>
    success(res, await service.respond(req.params.id, req.body, req), { message: 'Réponse publiée' })));

router.post('/reviews/:id/report', authorize('reviews.write'), validate(reviewParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.report(req.params.id, req), { message: 'Avis signalé à la modération' })));

// MOD-02 — décision de modération (masquer / remettre en ligne)
router.post('/reviews/:id/moderate', authorize('reviews.moderate'), validate(reviewParam, 'params'),
  validate(z.object({
    decision: z.enum(['KEEP', 'REMOVE']),
    reason: z.string().trim().min(5).max(1000),
  })), asyncHandler(async (req, res) =>
    success(res, await service.moderate(req.params.id, req.body, req), { message: 'Décision de modération enregistrée' })));

router.get('/organizations/:organizationId/reputation', authorize('reviews.read'), validate(orgParam, 'params'),
  asyncHandler(async (req, res) => success(res, await service.reputation(req.params.organizationId))));

export default router;
