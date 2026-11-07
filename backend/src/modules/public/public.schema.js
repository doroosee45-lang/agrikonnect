import { z } from 'zod';

export const slugParam = z.object({ slug: z.string().trim().min(1).max(120) });

export const mapSchema = z.object({
  bbox: z.string().trim().max(80).optional(),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
  province: z.string().trim().max(120).optional(),
  cropId: z.string().trim().max(60).optional(),
  /// CROP-03 / I18N-01 — langue demandée pour les libellés (fr par défaut)
  locale: z.string().trim().min(2).max(5).default('fr'),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export const listPublicSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
  province: z.string().trim().max(120).optional(),
  cropId: z.string().trim().max(60).optional(),
  /// CROP-03 / I18N-01 — langue demandée pour les libellés (fr par défaut)
  locale: z.string().trim().min(2).max(5).default('fr'),
  search: z.string().trim().max(80).optional(),
});

/** PUB-06 — formulaire de contact sans révéler les coordonnées */
export const contactSchema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().toLowerCase().email('Email invalide').optional(),
  phone: z.string().trim().max(30).optional(),
  message: z.string().trim().min(10, 'Message trop court').max(2000),
  /** Anti-spam minimal : pot de miel invisible côté client */
  website: z.string().max(0).optional(),
});
