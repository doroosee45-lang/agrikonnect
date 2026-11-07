/**
 * Validations du module cartes interpolées.
 *
 * Les seuils de suffisance des données vivent dans le moteur Python et sont
 * publiés par `GET /v1/meta`. Ce schéma ne borne que ce qui relève de la charge
 * utile HTTP : une borne côté Node évite d'envoyer au moteur une résolution qui
 * produirait des millions de cellules.
 */
import { z } from 'zod';
import { INTERPOLABLE_PARAMETERS } from './interpolation.service.js';

/**
 * Paramètres d'URL de calcul.
 *
 * `plotId` **et** `parameter` dans le même schéma : `validate` remplace
 * `req.params` par le résultat du parse et zod supprime les clés inconnues.
 * Deux validations successives de `params` feraient disparaître `parameter`.
 */
export const interpolationPathSchema = z.object({
  plotId: z.string().min(10).max(60),
  parameter: z.enum(INTERPOLABLE_PARAMETERS),
});

export const plotPathSchema = z.object({ plotId: z.string().min(10).max(60) });

export const mapIdParam = z.object({ id: z.string().min(10).max(60) });

export const interpolateSchema = z.object({
  /**
   * Pas de la grille en mètres.
   *
   * Borné à 5 000 m côté Node comme côté moteur : au-delà, la « carte » aurait
   * moins de cellules que de sondes et ne montrerait rien.
   */
  resolutionM: z.coerce.number().positive().max(5000).optional(),
  /** Profondeur ciblée : un horizon par carte. */
  depthCm: z.coerce.number().min(0).max(5000).nullable().optional(),
  /** Emprise [ouest, sud, est, nord] ; par défaut, celle des sondes. */
  bbox: z.array(z.number()).length(4).optional(),
});

export const listMapsQuery = z.object({
  parameter: z.enum(INTERPOLABLE_PARAMETERS).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
