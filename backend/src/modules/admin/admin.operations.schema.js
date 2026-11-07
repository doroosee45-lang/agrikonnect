import { z } from 'zod';
import { paginationSchema } from '../../shared/pagination.js';

/**
 * SPEC-SUPER-ADMIN M4 (§3/§6.2) — schémas de la modération unifiée.
 *
 * `decision` reprend le vocabulaire de la spec : approuver / refuser /
 * suspendre, **toujours motivé** (MKT-05 : aucune décision de modération sans
 * motif écrit). Le routage métier (`listing|review|verification`) est validé
 * ici, la mise en œuvre délègue aux services existants (RG-M4-1).
 */

export const ENTITES_MODERABLES = ['listing', 'review', 'verification'];

export const entityParam = z.object({
  entity: z.enum(ENTITES_MODERABLES),
});

export const entityIdParam = z.object({
  entity: z.enum(ENTITES_MODERABLES),
  id: z.string().trim().min(5).max(60),
});

export const idParam = z.object({
  id: z.string().trim().min(5).max(60),
});

export const listQuerySchema = paginationSchema.extend({
  status: z.string().trim().max(40).optional(),
});

export const moderateSchema = z.object({
  decision: z.enum(['approve', 'reject', 'suspend']),
  reason: z
    .string()
    .trim()
    .min(3, 'Motif requis (3 caractères minimum)')
    .max(200),
});

export const exportQuerySchema = z.object({
  status: z.string().trim().max(40).optional(),
  format: z.enum(['csv', 'json']).default('csv'),
});
