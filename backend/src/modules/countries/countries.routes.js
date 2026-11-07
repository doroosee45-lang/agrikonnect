import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success } from '../../shared/http/response.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { z } from 'zod';
import * as fx from './fx.service.js';

/**
 * GLB-02 — profil de conformité par pays (`complianceProfile`) : liste de
 * contraintes légales locales, lu par les services métier avant d'exposer
 * une donnée transfrontalière.
 * Référentiel pays (GLB-01).
 * La configuration publique (devises, langues, découpage, unités) est ouverte :
 * le front en a besoin dès l'inscription (AUTH-06) et pour l'i18n.
 */
const router = Router();

const PUBLIC_FIELDS = {
  code: true,
  name: true,
  currencies: true,
  defaultCurrency: true,
  locales: true,
  timezone: true,
  adminLevels: true,
  units: true,
  status: true,
};

router.get(
  '/',
  authorize('countries.read'),
  asyncHandler(async (_req, res) => {
    const countries = await prisma.country.findMany({
      where: { status: { in: ['PILOT', 'ACTIVE'] } },
      select: PUBLIC_FIELDS,
      orderBy: { name: 'asc' },
    });
    return success(res, countries);
  }),
);

router.get(
  '/:code',
  authorize('countries.read'),
  asyncHandler(async (req, res) => {
    const code = String(req.params.code).toUpperCase().slice(0, 2);
    const country = await prisma.country.findUnique({ where: { code }, select: PUBLIC_FIELDS });
    if (!country) throw ApiError.notFound('Pays non configuré');
    return success(res, country);
  }),
);

/**
 * Configuration complète (complianceProfile, hosting) réservée au SUPER_ADMIN.
 * `hosting` porte la résidence des données exigée par le pays (GLB-03).
 */
router.patch(
  '/:code',
  authenticate,
  resolveTenant,
  authorize('countries.write'),
  asyncHandler(async (req, res) => {
    const code = String(req.params.code).toUpperCase().slice(0, 2);
    const exists = await prisma.country.findUnique({ where: { code } });
    if (!exists) throw ApiError.notFound('Pays non configuré');

    const allowed = [
      'name', 'currencies', 'defaultCurrency', 'locales', 'timezone',
      'adminLevels', 'units', 'complianceProfile', 'hosting', 'status',
    ];
    const data = Object.fromEntries(
      Object.entries(req.body ?? {}).filter(([key]) => allowed.includes(key)),
    );
    if (!Object.keys(data).length) throw ApiError.badRequest('Aucun champ valide à mettre à jour');

    const updated = await prisma.country.update({ where: { code }, data });
    return success(res, updated, { message: 'Configuration pays mise à jour' });
  }),
);

/**
 * GLB-03 — taux de change.
 * Lecture ouverte (les clients en ont besoin pour afficher un prix converti),
 * écriture réservée à l'administration et auditée.
 */
const pairQuery = z.object({
  base: z.string().length(3),
  quote: z.string().length(3),
  at: z.string().datetime().optional(),
});

router.get(
  '/fx-rates',
  authorize('fx.read'),
  validate(pairQuery, 'query'),
  asyncHandler(async (req, res) => success(res, await fx.resolve(req.query))),
);

router.get(
  '/fx-rates/pairs',
  authorize('fx.read'),
  validate(z.object({ base: z.string().length(3).optional() }), 'query'),
  asyncHandler(async (req, res) => success(res, await fx.listPairs(req.query))),
);

router.put(
  '/fx-rates',
  authorize('fx.write'),
  validate(
    z.object({
      base: z.string().length(3),
      quote: z.string().length(3),
      rate: z.coerce.number().positive(),
      asOf: z.string().datetime(),
      source: z.string().trim().min(2).max(80),
      sourceLabel: z.string().trim().max(120).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const result = await fx.record(req.body, req);
    return success(res, result, { message: 'Cotation enregistrée' });
  }),
);

export default router;
