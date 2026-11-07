import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import * as service from './channels.service.js';

/**
 * USSD-01 / WA-01 — canaux complémentaires (CDC V3 §5.5).
 * Les webhooks sont publics par nature : ils sont protégés par signature / jeton,
 * jamais par une session utilisateur. L'administration est authentifiée.
 */
const router = Router();

const ussdSchema = z.object({
  sessionId: z.string().trim().max(120).optional(),
  phoneNumber: z.string().trim().min(6).max(24),
  text: z.string().max(200).default(''),
  serviceCode: z.string().trim().max(20).optional(),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
});

router.post(
  '/ussd',
  validate(ussdSchema),
  asyncHandler(async (req, res) => success(res, await service.ussd(req.body))),
);

router.get(
  '/whatsapp/webhook',
  asyncHandler(async (req, res) => {
    const { challenge } = service.whatsappVerify(req.query);
    return res.type('text/plain').send(challenge);
  }),
);

router.post(
  '/whatsapp/webhook',
  asyncHandler(async (req, res) => {
    // WA-01 — vérification de signature Meta quand le secret est configuré.
    const secret = process.env.WHATSAPP_APP_SECRET;
    if (secret) {
      const { verifySignature } = await import('./whatsapp.signature.js');
      if (!verifySignature(req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {})), req.headers['x-hub-signature-256'], secret)) {
        throw ApiError.forbidden('Signature WhatsApp invalide');
      }
    }
    return success(res, await service.whatsappWebhook(req.body ?? {}));
  }),
);

export const adminRouter = Router();
adminRouter.use(authenticate, resolveTenant);

adminRouter.get(
  '/messages',
  authorize('channels.read'),
  validate(
    z.object({
      channel: z.enum(['USSD', 'WHATSAPP']).optional(),
      phone: z.string().trim().max(24).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }),
    'query',
  ),
  asyncHandler(async (req, res) => success(res, await service.listMessages(req.query))),
);

export default router;
