/**
 * Validations du module acquisition satellite.
 *
 * Le choix de la source et l'index par défaut sont résolus par le service à
 * partir de `src/config/satellite.js` et `src/config/hardware.js` : ils ne sont
 * pas laissés au corps de requête, sauf surcharge explicite et contrôlée.
 */
import { z } from 'zod';
import { hardware } from '../../config/hardware.js';
import { MOISTURE_INDEXES } from '../../config/satellite.js';

export const plotPathSchema = z.object({ plotId: z.string().min(10).max(60) });

export const acquireSchema = z.object({
  /**
   * Surcharge de la source. Par défaut, la source principale est retenue
   * (Sentinel-1, radar) — c'est un choix de déploiement documenté, pas un
   * paramètre laissé à l'appelant.
   */
  sourceId: z.enum(hardware.satellite.sources.map((source) => source.id)).optional(),
  /** Index mesuré. Un NDVI n'est pas une humidité : la liste est explicite. */
  index: z
    .string()
    .min(1)
    .max(40)
    .refine((value) => MOISTURE_INDEXES.includes(value) || value === 'NDVI', {
      message: `Index non reconnu. Index d'humidité admis : ${MOISTURE_INDEXES.join(', ')} ; sinon NDVI.`,
    })
    .optional(),
  /** Fin de la fenêtre de recherche ; par défaut, maintenant. */
  to: z.coerce.date().optional(),
  /** Emprise [ouest, sud, est, nord] ; par défaut, celle de la parcelle. */
  bbox: z.array(z.number()).length(4).optional(),
  id: z.string().min(20).max(40).optional(),
});

export const listObservationsQuery = z.object({
  index: z.string().min(1).max(40).optional(),
  provider: z.enum([...hardware.satellite.providers]).optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
