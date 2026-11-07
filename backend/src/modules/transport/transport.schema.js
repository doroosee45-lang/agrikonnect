import { z } from 'zod';

/** Point de chargement / déchargement — JSON structuré sur `TransportRequest`. */
export const transportPlaceSchema = z.object({
  label: z.string().trim().min(2, 'Libellé du lieu requis').max(160),
  province: z.string().trim().max(120).optional(),
  countryCode: z.string().trim().length(2).toUpperCase(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  contactName: z.string().trim().max(160).optional(),
  contactPhone: z.string().trim().max(30).optional(),
  instructions: z.string().trim().max(500).optional(),
  windowFrom: z.coerce.date().optional(),
  windowTo: z.coerce.date().optional(),
});
