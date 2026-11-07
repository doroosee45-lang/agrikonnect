import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success } from '../../shared/http/response.js';
import { publicRateLimit } from '../../middleware/rateLimit.js';
import * as service from './traceability.service.js';

/**
 * Vue publique d'un lot (QR code produit).
 * Aucune authentification — mais strictement limitée aux `publicFields`.
 */
const router = Router();

router.get('/lots/:code', publicRateLimit, asyncHandler(async (req, res) =>
  success(res, await service.publicView(req.params.code), {
    message: 'Fiche publique du lot (champs publiés uniquement)',
  })));

export default router;
