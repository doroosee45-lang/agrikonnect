import { z } from 'zod';

/**
 * SPEC-SUPER-ADMIN M5 (§3/§6.2/§10) — schémas de la supervision.
 *
 * `runJobSchema` reprend le contrat §10 (`reason` 3..200) ; le motif reste
 * **facultatif** pour ne pas casser les déclenchements antérieurs sans corps,
 * mais il est validé quand il est présent et journalisé dans l'audit.
 */

export const jobNameParam = z.object({
  name: z.string().trim().min(3).max(60),
});

export const runJobSchema = z
  .object({
    reason: z.string().trim().min(3, 'Motif requis (3 caractères minimum)').max(200).optional(),
  })
  .optional();
