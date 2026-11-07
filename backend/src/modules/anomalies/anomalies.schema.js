/**
 * Validations du module anomalies.
 *
 * Les statuts et motifs sont énumérés explicitement plutôt qu'importés de
 * Prisma : une valeur nouvelle côté schéma ne doit pas modifier silencieusement
 * ce que l'API accepte.
 */
import { z } from 'zod';

export const listQuerySchema = z.object({
  status: z.enum(['NEW', 'CONFIRMED', 'DISMISSED']).optional(),
  reason: z
    .enum(['OUT_OF_RANGE', 'IMPOSSIBLE_JUMP', 'FROZEN_VALUE', 'STATISTICAL_OUTLIER', 'SILENT'])
    .optional(),
  deviceId: z.string().min(10).max(60).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const devicePathSchema = z.object({ deviceId: z.string().min(10).max(60) });
export const plotPathSchema = z.object({ plotId: z.string().min(10).max(60) });
export const anomalyPathSchema = z.object({ anomalyId: z.string().min(10).max(60) });

export const reviewSchema = z.object({
  /**
   * `CONFIRMED` maintient la mesure écartée du calcul ; `DISMISSED` la
   * réhabilite. Il n'y a pas d'état intermédiaire : un seuil provisoire peut se
   * tromper, et c'est l'agronome qui tranche.
   */
  decision: z.enum(['CONFIRMED', 'DISMISSED']),
  note: z.string().max(1000).optional(),
});
