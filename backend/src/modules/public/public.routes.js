import { Router } from 'express';
import { z } from 'zod';
import { success } from '../../shared/http/response.js';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './public.controller.js';
import * as schema from './public.schema.js';
import * as service from './public.service.js';

/**
 * Routes publiques — aucune authentification requise.
 * Elles n'utilisent QUE des projections publiques (public.service.js).
 */
const router = Router();

router.get(
  '/map',
  validate(schema.mapSchema, 'query'),
  asyncHandler(controller.map),
);

router.get(
  '/farms',
  validate(schema.listPublicSchema, 'query'),
  asyncHandler(controller.listFarms),
);

router.get(
  '/farms/:slug',
  validate(schema.slugParam, 'params'),
  asyncHandler(controller.getFarm),
);

router.post(
  '/farms/:slug/contact',
  validate(schema.slugParam, 'params'),
  validate(schema.contactSchema),
  asyncHandler(controller.contact),
);

/* ───────────── PUB-03 : QR du profil public (PNG / SVG) ───────────── */

router.get(
  '/farms/:slug/qr.:format',
  validate(
    z.object({
      slug: z.string().min(1).max(120),
      format: z.enum(['png', 'svg']),
    }),
    'params',
  ),
  validate(
    z.object({ size: z.coerce.number().int().min(128).max(1024).default(512) }),
    'query',
  ),
  asyncHandler(async (req, res) => {
    const { buffer, contentType, filename } = await service.farmQr(req.params.slug, {
      format: req.params.format,
      size: req.query.size,
    });
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.end(buffer);
  }),
);

/* ───────────── SOIL-16 : statistiques de sol agrégées (k ≥ 10) ───────────── */

router.get(
  '/soil-stats',
  validate(
    z.object({
      countryCode: z.string().trim().length(2).toUpperCase().optional(),
      parameter: z.string().trim().max(40).optional(),
    }),
    'query',
  ),
  asyncHandler(async (req, res) => success(res, await service.soilStats(req.query))),
);

export default router;
