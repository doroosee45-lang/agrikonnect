import { z } from 'zod';
import { paginationSchema } from '../../shared/pagination.js';

const lat = z.coerce.number().min(-90).max(90);
const lng = z.coerce.number().min(-180).max(180);

/** PROF-02 : visibilité par champ */
export const visibilitySchema = z
  .object({
    phone: z.enum(['public', 'onRequest', 'private']).optional(),
    email: z.enum(['public', 'onRequest', 'private']).optional(),
    whatsapp: z.enum(['public', 'onRequest', 'private']).optional(),
    location: z.enum(['exact', 'approximate', 'private']).optional(),
    production: z.enum(['public', 'onRequest', 'private']).optional(),
  })
  .partial();

/** FARM-01 */
export const createFarmSchema = z.object({
  /** Identifiant généré côté client (offline-ready, CDC P7) */
  id: z.string().min(20).max(40).optional(),
  name: z.string().trim().min(2, 'Nom requis').max(120),
  description: z.string().trim().max(3000).optional(),
  countryCode: z.string().trim().length(2).toUpperCase(),
  province: z.string().trim().max(120).optional(),
  territory: z.string().trim().max(120).optional(),
  sector: z.string().trim().max(120).optional(),
  village: z.string().trim().max(120).optional(),
  latitude: lat.optional(),
  longitude: lng.optional(),
  totalAreaHa: z.coerce.number().min(0).max(1_000_000).optional(),
  workers: z.coerce.number().int().min(0).max(100_000).optional(),
  capacity: z.string().trim().max(200).optional(),
  foundedYear: z.coerce.number().int().min(1800).max(new Date().getFullYear()).optional(),
  cropIds: z.array(z.string().min(1).max(60)).max(50).optional(),
  visibility: visibilitySchema.optional(),
});

export const updateFarmSchema = createFarmSchema.omit({ id: true }).partial().strict();

export const publishFarmSchema = z.object({
  isPublic: z.boolean(),
});

export const listFarmsSchema = paginationSchema.extend({
  search: z.string().trim().max(80).optional(),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
  province: z.string().trim().max(120).optional(),
  cropId: z.string().trim().max(60).optional(),
  archived: z.enum(['true', 'false']).optional(),
});

export const farmIdParam = z.object({ id: z.string().min(10).max(60) });
