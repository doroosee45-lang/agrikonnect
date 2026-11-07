import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './investors.service.js';

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(160),
  sectors: z.array(z.string().max(80)).max(20).default([]),
  countries: z.array(z.string().trim().length(2).toUpperCase()).max(30).default([]),
  ticketMin: z.coerce.number().min(0).optional(),
  ticketMax: z.coerce.number().min(0).optional(),
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
  preferences: z.record(z.any()).optional(),
  mfaEnabled: z.boolean().optional(),
});

const verifySchema = z.object({
  decision: z.enum(['VERIFIED', 'REJECTED']),
  comment: z.string().trim().max(1000).optional(),
});

const userParam = z.object({ userId: z.string().min(5).max(60) });

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/me', authorize('investors.read'), asyncHandler(async (req, res) =>
  success(res, await service.getMine(req))));

router.put('/me', authorize('investors.write'), validate(profileSchema), asyncHandler(async (req, res) =>
  success(res, await service.upsertProfile(req.body, req), {
    message: 'Profil investisseur enregistré (vérification administrative requise)',
  })));

// Vérification administrative
router.patch('/:userId/verify', authorize('investors.verify'), validate(userParam, 'params'),
  validate(verifySchema), asyncHandler(async (req, res) =>
    success(res, await service.verify(req.params.userId, req.body, req), { message: 'Décision enregistrée' })));

export default router;
