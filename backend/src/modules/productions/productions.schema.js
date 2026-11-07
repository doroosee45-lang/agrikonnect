import { z } from 'zod';
import { paginationSchema } from '../../shared/pagination.js';

/** PROD-01 */
export const createProductionSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  farmId: z.string().min(10).max(60),
  plotId: z.string().min(10).max(60).optional(),
  cropId: z.string().min(1).max(60),
  harvestedAt: z.coerce.date(),
  season: z.string().trim().min(1, 'Saison requise').max(40),
  quantity: z.coerce.number().positive('Quantité positive requise'),
  unit: z.string().trim().min(1, 'Unité requise').max(20),
  quality: z.string().trim().max(60).optional(),
  destination: z.string().trim().max(120).optional(),
});

export const updateProductionSchema = createProductionSchema.omit({ id: true }).partial().strict();

export const listProductionsSchema = paginationSchema.extend({
  farmId: z.string().min(10).max(60).optional(),
  plotId: z.string().min(10).max(60).optional(),
  cropId: z.string().trim().max(60).optional(),
  season: z.string().trim().max(40).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const statsSchema = z.object({
  groupBy: z.enum(['crop', 'plot', 'month', 'year']).default('crop'),
  farmId: z.string().min(10).max(60).optional(),
  season: z.string().trim().max(40).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const productionIdParam = z.object({ id: z.string().min(10).max(60) });
