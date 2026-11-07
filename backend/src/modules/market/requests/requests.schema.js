import { z } from 'zod';
import { paginationSchema } from '../../../shared/pagination.js';

/** REQ-01 */
export const createRequestSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  cropId: z.string().min(1, 'Culture requise').max(60),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000).optional(),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().min(1).max(20),
  quality: z.string().trim().max(60).optional(),
  budgetPrice: z.coerce.number().min(0).optional(),
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
  deliveryCountry: z.string().trim().length(2).toUpperCase(),
  deliveryProvince: z.string().trim().max(120).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  neededBy: z.coerce.date().optional(),
  conditions: z.string().trim().max(1000).optional(),
});

export const updateRequestSchema = createRequestSchema.omit({ id: true }).partial().strict();

export const listRequestsSchema = paginationSchema.extend({
  status: z.enum(['OPEN', 'MATCHED', 'CLOSED', 'CANCELLED']).optional(),
  cropId: z.string().max(60).optional(),
});

export const matchesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  minVolumeRatio: z.coerce.number().min(0).max(1).default(0.25),
  maxDistanceKm: z.coerce.number().min(1).max(5000).default(300),
});

export const requestIdParam = z.object({ id: z.string().min(10).max(60) });
