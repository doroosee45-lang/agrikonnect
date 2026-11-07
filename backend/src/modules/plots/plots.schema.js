import { z } from 'zod';
import { paginationSchema } from '../../shared/pagination.js';

const ring = z.array(z.tuple([z.coerce.number().min(-180).max(180), z.coerce.number().min(-90).max(90)])).min(4);

export const geometrySchema = z.union([
  z.object({ type: z.literal('Point'), coordinates: z.tuple([z.coerce.number(), z.coerce.number()]) }),
  z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(ring).min(1),
  }),
]);

/** PLOT-01 / PLOT-02 */
export const createPlotSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  farmId: z.string().min(10).max(60),
  name: z.string().trim().min(2, 'Nom requis').max(120),
  areaHa: z.coerce.number().min(0).max(1_000_000).optional(),
  geometry: geometrySchema,
  currentCropId: z.string().min(1).max(60).optional(),
  plantingDate: z.coerce.date().optional(),
  status: z.enum(['FALLOW', 'PLANTED', 'GROWING', 'HARVESTED', 'RESTING']).default('FALLOW'),
});

export const updatePlotSchema = createPlotSchema
  .omit({ id: true, farmId: true })
  .partial()
  .strict()
  .extend({
    farmId: z.string().min(10).max(60).optional(),
    // PLOT-03 — jeton de concurrence optimiste : la version lue par le client.
    version: z.coerce.number().int().min(0).optional(),
  });

export const listPlotsSchema = paginationSchema.extend({
  farmId: z.string().min(10).max(60).optional(),
  status: z.enum(['FALLOW', 'PLANTED', 'GROWING', 'HARVESTED', 'RESTING']).optional(),
  cropId: z.string().trim().max(60).optional(),
  search: z.string().trim().max(80).optional(),
});

/** PLOT-03 — historique cultural */
export const cropHistorySchema = z.object({
  id: z.string().min(20).max(40).optional(),
  season: z.string().trim().min(1, 'Saison requise').max(40),
  year: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1),
  cropId: z.string().min(1).max(60),
  plantedAt: z.coerce.date().optional(),
  harvestedAt: z.coerce.date().optional(),
  declaredYield: z.coerce.number().min(0).optional(),
  unit: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const plotIdParam = z.object({ id: z.string().min(10).max(60) });
export const historyIdParam = z.object({ id: z.string().min(10).max(60), historyId: z.string().min(10).max(60) });
