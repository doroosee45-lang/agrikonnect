import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import * as controller from './auth.controller.js';
import * as mfa from './mfa.service.js';
import * as schema from './auth.schema.js';
import { success } from '../../shared/http/response.js';

const router = Router();

// ─── Public (rate limit renforcé : SEC-01) ─────────────────────
router.post('/register', authLimiter, validate(schema.registerSchema), asyncHandler(controller.register));
// V4 NFR-01 — double authentification TOTP
router.get('/mfa/status', authenticate, asyncHandler(async (req, res) =>
  success(res, await mfa.status(req))));

router.post('/mfa/setup', authenticate, asyncHandler(async (req, res) =>
  success(res, await mfa.setup(req), { message: 'Secret TOTP généré — confirmation requise' })));

router.post(
  '/mfa/confirm',
  authenticate,
  validate(z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Code à 6 chiffres requis') })),
  asyncHandler(async (req, res) =>
    success(res, await mfa.confirm(req.body, req), { message: 'Double authentification activée' })),
);

router.post('/mfa/verify', authenticate, validate(z.object({ code: z.string().trim().min(6).max(14) })), asyncHandler(async (req, res) =>
  success(res, await mfa.verify(req.body, req), { message: 'Code vérifié' })));

router.post('/mfa/disable', authenticate, validate(z.object({ code: z.string().trim().min(6).max(14) })), asyncHandler(async (req, res) =>
  success(res, await mfa.disable(req.body, req), { message: 'Double authentification désactivée' })));

router.post('/login', authLimiter, validate(schema.loginSchema), asyncHandler(controller.login));
router.post('/refresh', authLimiter, validate(schema.refreshSchema), asyncHandler(controller.refresh));
router.post('/verify-email', authLimiter, validate(schema.verifyEmailSchema), asyncHandler(controller.verifyEmail));
router.post('/resend-verification', authLimiter, validate(schema.resendVerificationSchema), asyncHandler(controller.resendEmail));
router.post('/forgot-password', authLimiter, validate(schema.forgotPasswordSchema), asyncHandler(controller.forgotPassword));
router.post('/reset-password', authLimiter, validate(schema.resetPasswordSchema), asyncHandler(controller.resetPassword));

// ─── Authentifié ───────────────────────────────────────────────
router.post('/logout', authenticate, asyncHandler(controller.logout));
router.post('/verify-phone', authenticate, validate(schema.verifyPhoneSchema), asyncHandler(controller.verifyPhone));
router.post('/send-otp', authenticate, validate(schema.sendOtpSchema), asyncHandler(controller.sendPhoneOtp));
router.post('/sync-profile', authenticate, asyncHandler(controller.syncProfile));

export default router;
