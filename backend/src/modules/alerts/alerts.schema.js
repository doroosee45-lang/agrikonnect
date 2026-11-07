/**
 * Validations du module alertes.
 *
 * Les règles vivent ici plutôt que dans les routes : un appel interne (job,
 * autre service) passe par les mêmes contrôles qu'un appel HTTP.
 */
import { z } from 'zod';
import { ALERT_SOURCE_TYPES } from './alerts.service.js';

export const alertIdParam = z.object({ id: z.string().min(10).max(60) });

export const listAlertsQuery = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    plotId: z.string().min(1).max(60).optional(),
    recommendationId: z.string().min(1).max(60).optional(),
    sourceType: z.enum(ALERT_SOURCE_TYPES).optional(),
    status: z.enum(['NEW', 'READ', 'HANDLED']).optional(),
    /** `true` = alertes non traitées, quel que soit leur statut de lecture. */
    open: z.enum(['true', 'false']).optional(),
  })
  /**
   * `open` et `status` sont deux filtres incompatibles : le premier sélectionne
   * « tout sauf HANDLED », le second un statut précis. Les accepter ensemble
   * laisserait croire que les deux s'appliquent.
   */
  .refine((query) => !(query.open === 'true' && query.status !== undefined), {
    message: 'Les filtres « open » et « status » sont exclusifs : choisissez l’un des deux.',
    path: ['open'],
  });
