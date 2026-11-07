import { z } from 'zod';

/** Paramètres du module Soil & Crop Intelligence (CDC §11.8) */
export const SOIL_PARAMETER_KEYS = [
  'ph',
  'organicMatter',
  'texture',
  'n',
  'p',
  'k',
  'ec',
  'moisture',
  'erosionRisk',
  // Granulométrie et profondeur : indispensables au moteur géospatial (texture
  // USDA, horizons de sous-sol). Optionnelles, mais si elles sont fournies elles
  // sont utilisées telles quelles au lieu d'une classe de texture déclarée.
  'sand',
  'silt',
  'clay',
  'depthCm',
];

export const soilParameterSchema = z.object({
  key: z.enum(SOIL_PARAMETER_KEYS),
  /** Valeur brute conservée telle quelle (ex. "limono-argileux", "bonne") */
  value: z.string().trim().min(1, 'Valeur requise').max(120),
  /** Valeur numérique quand elle existe (pH, % MO, mg/kg…) */
  numericValue: z.coerce.number().optional(),
  unit: z.string().trim().max(20).optional(),
  /** P2 : provenance obligatoire */
  source: z
    .enum([
      'declared',
      'estimated',
      'derived',
      'measured_lab',
      'measured_sensor',
      'satellite',
      'photo_interpreted',
      'third_party_verified',
    ])
    .default('declared'),
  method: z.string().trim().max(120).optional(),
  confidence: z.enum(['low', 'medium', 'high']).default('low'),
  measuredAt: z.coerce.date().optional(),
  labReportId: z.string().max(120).optional(),
});

/** SOIL-01 / SOIL-02 */
export const createAssessmentSchema = z.object({
  id: z.string().min(20).max(40).optional(),
  assessedAt: z.coerce.date(),
  notes: z.string().trim().max(2000).optional(),
  /** Pièce jointe du rapport de laboratoire (SOIL-02) */
  labReportDocumentId: z.string().max(60).optional(),
  parameters: z.array(soilParameterSchema).min(1, 'Au moins un paramètre requis').max(30),
});

export const updateAssessmentSchema = z
  .object({
    assessedAt: z.coerce.date().optional(),
    notes: z.string().trim().max(2000).optional(),
    parameters: z.array(soilParameterSchema).min(1).max(30).optional(),
  })
  .strict();

export const plotParam = z.object({ id: z.string().min(10).max(60) });
export const assessmentParam = z.object({
  id: z.string().min(10).max(60),
  assessmentId: z.string().min(10).max(60),
});
