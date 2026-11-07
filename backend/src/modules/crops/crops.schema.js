import { z } from 'zod';
import { paginationSchema } from '../../shared/pagination.js';

/** CROP-03 / I18N-01 — langue du libellé (fr par défaut, repli documenté). */
export const localeQuery = z.object({
  locale: z.string().trim().min(2).max(5).default('fr'),
});

export const listCropsSchema = paginationSchema.extend({
  category: z.string().trim().max(60).optional(),
  search: z.string().trim().max(80).optional(),
  status: z.enum(['DRAFT', 'VALIDATED', 'ARCHIVED']).optional(),
  /// CROP-03 / I18N-01 — langue demandée pour les libellés (fr par défaut)
  locale: z.string().trim().min(2).max(5).default('fr'),
});

const namesSchema = z.record(z.string().min(2).max(5), z.string().trim().min(1).max(80));

/** CROP-01 : catalogue administré (création réservée ADMIN). */
export const createCropSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]{2,60}$/, 'Slug invalide').optional(),
  category: z.string().trim().min(2).max(60),
  names: namesSchema,
  cycleDays: z.coerce.number().int().min(1).max(3650).optional(),
  seasons: z.any().optional(),
  units: z.any().optional(),
  agronomy: z.any().optional(),
  status: z.enum(['DRAFT', 'VALIDATED', 'ARCHIVED']).default('VALIDATED'),
});

export const updateCropSchema = createCropSchema.partial().strict();

export const cropIdParam = z.object({ id: z.string().min(1).max(60) });
