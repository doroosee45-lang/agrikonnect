import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as hub from './hub.service.js';

/**
 * V4 §8 — hub investisseur (INV-02, INV-03, PRJ-04).
 * Monté sous /investment.
 */
const router = Router();
router.use(authenticate, resolveTenant);

const projectParam = z.object({ id: z.string().min(10).max(80) });
const contactParam = z.object({ id: z.string().min(10).max(80), requestId: z.string().min(10).max(80) });

const browseSchema = z.object({
  sector: z.string().trim().max(80).optional(),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

router.get(
  '/projects',
  authorize('investors.read'),
  validate(browseSchema, 'query'),
  asyncHandler(async (req, res) => success(res, await hub.browseProjects(req.query, req))),
);

router.get(
  '/followed',
  authorize('investors.read'),
  asyncHandler(async (req, res) => success(res, await hub.listFollowed(req))),
);

router.post(
  '/projects/:id/follow',
  authorize('investors.write'),
  validate(projectParam, 'params'),
  asyncHandler(async (req, res) =>
    success(res, await hub.follow(req.params.id, req), { message: 'Projet suivi' })),
);

router.delete(
  '/projects/:id/follow',
  authorize('investors.write'),
  validate(projectParam, 'params'),
  asyncHandler(async (req, res) =>
    success(res, await hub.unfollow(req.params.id, req), { message: 'Suivi retiré' })),
);

router.get(
  '/matches',
  authorize('investors.read'),
  validate(browseSchema, 'query'),
  asyncHandler(async (req, res) => success(res, await hub.matches(req.query, req))),
);

router.post(
  '/projects/:id/contact',
  authorize('investors.write'),
  validate(projectParam, 'params'),
  validate(z.object({ message: z.string().trim().min(10).max(2000) })),
  asyncHandler(async (req, res) =>
    created(res, await hub.requestContact(req.params.id, req.body, req), {
      message: 'Demande de mise en relation transmise',
    })),
);

router.post(
  '/projects/:id/contacts/:requestId/decide',
  authorize('projects.write'),
  validate(contactParam, 'params'),
  validate(z.object({ decision: z.enum(['ACCEPTED', 'DECLINED']) })),
  asyncHandler(async (req, res) =>
    success(res, await hub.decideContact(req.params.id, req.params.requestId, req.body, req), {
      message: 'Décision enregistrée',
    })),
);

router.get(
  '/contact-requests',
  authorize('investors.read'),
  validate(
    z.object({
      status: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED']).optional(),
      asRequester: z.enum(['true', 'false']).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }),
    'query',
  ),
  asyncHandler(async (req, res) => success(res, await hub.listContactRequests(req.query, req))),
);

export default router;
