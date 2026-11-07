import { z } from 'zod';
import { paginationSchema } from '../../../shared/pagination.js';

const LISTING_TYPES = ['PRODUCE', 'ANIMAL', 'PROCESSED', 'EQUIPMENT', 'INPUT', 'SERVICE'];

/** MKT-01 / MKT-02 */
export const createListingSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  type: z.enum(LISTING_TYPES),
  cropId: z.string().max(60).optional(),
  title: z.string().trim().min(3, 'Titre requis').max(160),
  description: z.string().trim().max(3000).optional(),
  quantity: z.coerce.number().positive('Quantité positive requise'),
  unit: z.string().trim().min(1).max(20),
  quality: z.string().trim().max(60).optional(),
  indicativePrice: z.coerce.number().min(0).optional(),
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
  countryCode: z.string().trim().length(2).toUpperCase(),
  province: z.string().trim().max(120).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  availableFrom: z.coerce.date().optional(),
  availableTo: z.coerce.date().optional(),
  certifications: z.array(z.string().max(80)).max(10).default([]),
  conditions: z.string().trim().max(1000).optional(),
  expiresAt: z.coerce.date().optional(),
});

export const updateListingSchema = createListingSchema.omit({ id: true }).partial().strict();

export const publishListingSchema = z.object({
  status: z.enum(['PUBLISHED', 'ARCHIVED', 'DRAFT']),
});

export const moderateListingSchema = z.object({
  status: z.enum(['HIDDEN', 'PUBLISHED']),
  reason: z.string().trim().min(5, 'Motif requis').max(500),
});

/** MKT-03 — recherche avancée */
export const searchListingsSchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  cropId: z.string().max(60).optional(),
  type: z.enum(LISTING_TYPES).optional(),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
  province: z.string().trim().max(120).optional(),
  minQuantity: z.coerce.number().min(0).optional(),
  maxQuantity: z.coerce.number().min(0).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  certification: z.string().max(80).optional(),
  sellerType: z.enum(['INDIVIDUAL', 'COOPERATIVE', 'COMPANY']).optional(),
  mine: z.enum(['true', 'false']).optional(),
});

export const listingIdParam = z.object({ id: z.string().min(10).max(60) });
