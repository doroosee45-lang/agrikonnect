import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success } from '../../shared/http/response.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as service from './insights.service.js';

/**
 * INS-01 → INS-03 — Observatoire pays.
 *
 * Réservé aux Administrateurs Pays et aux administrateurs plateforme
 * (`insights.read`) : ce ne sont pas des données de marché ouvertes, mais des
 * agrégats de politique publique.
 */
const router = Router();

router.use(authenticate, resolveTenant);

const countryQuery = z.object({
  countryCode: z.string().length(2).regex(/^[A-Z]{2}$/, 'Code ISO 3166-1 alpha-2 en majuscules'),
});

router.get(
  '/overview',
  authorize('insights.read'),
  validate(countryQuery, 'query'),
  asyncHandler(async (req, res) => success(res, await service.overview(req.query, req))),
);

router.get(
  '/crops',
  authorize('insights.read'),
  validate(countryQuery, 'query'),
  asyncHandler(async (req, res) => success(res, await service.byCrop(req.query, req))),
);

router.get(
  '/activity',
  authorize('insights.read'),
  validate(countryQuery.extend({ months: z.coerce.number().int().min(1).max(24).optional() }), 'query'),
  asyncHandler(async (req, res) => success(res, await service.activity(req.query, req))),
);

/** Politique de divulgation : publique dès lors qu'on est authentifié. */
router.get('/disclosure-policy', asyncHandler(async (_req, res) => success(res, service.disclosurePolicy())));

export default router;
