import { z } from 'zod';

export const createOrganizationSchema = z.object({
  type: z.enum(['COOPERATIVE', 'COMPANY']),
  name: z.string().trim().min(2, 'Nom requis').max(120),
  description: z.string().trim().max(2000).optional(),
  countryCode: z.string().trim().length(2).toUpperCase(),
  /** COOP-01 : informations légales de la coopérative */
  legalStatus: z.string().trim().max(120).optional(),
  foundedYear: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional(),
  province: z.string().trim().max(120).optional(),
  territory: z.string().trim().max(120).optional(),
});

export const updateOrganizationSchema = createOrganizationSchema
  .omit({ type: true })
  .partial()
  .strict();

export const organizationIdParam = z.object({
  id: z.string().min(10, 'Identifiant invalide'),
});
