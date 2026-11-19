import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import * as controller from './auth.controller.js';
import * as mfa from './mfa.service.js';
import { preuvePourRequete } from './mfaProof.js';
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

/*
 * Audit M-02 — les points d'entrée qui vérifient un code (TOTP, OTP) portent
 * le limiteur strict : sans lui, seul le limiteur global (300 req / 15 min)
 * freinait la recherche d'un code à 6 chiffres.
 * Audit C-03 — un code vérifié ici délivre une preuve liée à la session
 * (`mfaProof`), à renvoyer en `X-MFA-Proof` sur les routes protégées.
 */
router.post(
  '/mfa/confirm',
  authLimiter,
  authenticate,
  validate(z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Code à 6 chiffres requis') })),
  asyncHandler(async (req, res) =>
    success(
      res,
      { ...(await mfa.confirm(req.body, req)), mfaProof: preuvePourRequete(req) },
      { message: 'Double authentification activée' },
    )),
);

router.post('/mfa/verify', authLimiter, authenticate, validate(z.object({ code: z.string().trim().min(6).max(14) })), asyncHandler(async (req, res) =>
  success(res, { ...(await mfa.verify(req.body, req)), mfaProof: preuvePourRequete(req) }, { message: 'Code vérifié' })));

router.post('/mfa/disable', authLimiter, authenticate, validate(z.object({ code: z.string().trim().min(6).max(14) })), asyncHandler(async (req, res) =>
  success(res, await mfa.disable(req.body, req), { message: 'Double authentification désactivée' })));

router.post('/login', authLimiter, validate(schema.loginSchema), asyncHandler(controller.login));
router.post('/refresh', authLimiter, validate(schema.refreshSchema), asyncHandler(controller.refresh));
router.post('/verify-email', authLimiter, validate(schema.verifyEmailSchema), asyncHandler(controller.verifyEmail));
router.post('/resend-verification', authLimiter, validate(schema.resendVerificationSchema), asyncHandler(controller.resendEmail));
router.post('/forgot-password', authLimiter, validate(schema.forgotPasswordSchema), asyncHandler(controller.forgotPassword));
router.post('/reset-password', authLimiter, validate(schema.resetPasswordSchema), asyncHandler(controller.resetPassword));

// ─── Authentifié ───────────────────────────────────────────────
router.post('/logout', authenticate, asyncHandler(controller.logout));
router.post('/verify-phone', authLimiter, authenticate, validate(schema.verifyPhoneSchema), asyncHandler(controller.verifyPhone));
router.post('/send-otp', authLimiter, authenticate, validate(schema.sendOtpSchema), asyncHandler(controller.sendPhoneOtp));
router.post('/sync-profile', authenticate, asyncHandler(controller.syncProfile));

export default router;
