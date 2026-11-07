/**
 * Validations du module prévision.
 *
 * Les bornes vivent ici **et** dans le moteur Python : un appel interne passe
 * par les mêmes contrôles qu'un appel HTTP, et le moteur reste capable de
 * refuser un payload venu d'ailleurs.
 */
import { z } from 'zod';
import { FORECASTABLE_PARAMETERS } from './forecast.service.js';

/**
 * Paramètres d'URL de calcul.
 *
 * `plotId` **et** `parameter` sont dans le même schéma : `validate` remplace
 * `req.params` par le résultat du parse, et zod supprime les clés inconnues.
 * Deux validations successives de `params` feraient donc disparaître `parameter`
 * avant la seconde — un piège qui se manifeste en 422 sur un appel correct.
 */
export const forecastPathSchema = z.object({
  plotId: z.string().min(10).max(60),
  parameter: z.enum(FORECASTABLE_PARAMETERS),
});

/**
 * Horizon borné à 365 jours.
 *
 * Au-delà d'une campagne, la prévision ne correspond plus à aucune décision de
 * semis réelle, et l'extrapolation n'a plus de valeur agronomique.
 */
export const forecastSchema = z.object({
  horizonDays: z.coerce.number().positive().max(365).default(14),
  stepDays: z.coerce.number().positive().max(30).default(1),
  /** Profondeur ciblée : une série mêlant plusieurs profondeurs n'a pas de sens. */
  depthCm: z.coerce.number().min(0).max(5000).nullable().optional(),
  /** Instant de référence ; par défaut, maintenant. Sert aux tests reproductibles. */
  now: z.coerce.date().optional(),
});

export const listPredictionsQuery = z.object({
  parameter: z.enum(FORECASTABLE_PARAMETERS).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
