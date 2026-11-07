import { z } from 'zod';

/**
 * SEC-06 : contrôle du type MIME réel, taille max, renommage.
 * Les types autorisés sont volontairement restreints.
 */
export const ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'application/pdf': 'pdf',
};

export const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo (NFR-04)

export const uploadUrlSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  mimeType: z.string().refine((m) => Boolean(ALLOWED_MIME[m]), 'Type de fichier non autorisé'),
  sizeBytes: z.coerce.number().int().positive().max(MAX_SIZE_BYTES, 'Fichier trop volumineux (5 Mo max)'),
  kind: z.enum(['PHOTO', 'VIDEO', 'DOCUMENT']).default('PHOTO'),
  farmId: z.string().min(10).max(60).optional(),
  plotId: z.string().min(10).max(60).optional(),
  /** V2 — photo rattachée à une annonce marketplace */
  listingId: z.string().min(10).max(60).optional(),
  caption: z.string().trim().max(300).optional(),
});

export const attachMediaSchema = z.object({
  farmId: z.string().min(10).max(60).optional(),
  plotId: z.string().min(10).max(60).optional(),
  caption: z.string().trim().max(300).optional(),
  position: z.coerce.number().int().min(0).max(99).optional(),
});

export const mediaIdParam = z.object({ id: z.string().min(10).max(60) });
