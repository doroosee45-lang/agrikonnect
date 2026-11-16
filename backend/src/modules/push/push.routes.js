/**
 * `/api/v1/me/push-devices` — appareils push de l'utilisateur connecté.
 * Authentification Supabase uniquement : chacun ne gère QUE ses appareils.
 */
import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success, created } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { writeLimiter } from '../../middleware/rateLimit.js';
import * as service from './push.service.js';

export const registerDeviceSchema = z
  .object({
    provider: z.enum(['FCM', 'APNS', 'APNS_VOIP']),
    token: z.string().trim().min(32, 'Jeton push invalide').max(4096),
    installationId: z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/, 'Identifiant d’installation invalide'),
    appVersion: z.string().trim().max(40).optional(),
    locale: z.enum(['fr', 'en']).optional(),
  })
  .strict();

const idParam = z.object({ id: z.string().min(10).max(60) });

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => success(res, await service.lister(req))));

router.post('/', writeLimiter, validate(registerDeviceSchema), asyncHandler(async (req, res) =>
  created(res, await service.enregistrer(req.body, req), { message: 'Appareil enregistré' })));

router.delete('/:id', validate(idParam, 'params'), asyncHandler(async (req, res) =>
  success(res, await service.retirer(req.params.id, req), { message: 'Appareil retiré' })));

export default router;
