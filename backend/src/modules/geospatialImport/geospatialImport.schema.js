import { z } from 'zod';

/**
 * Schémas du dépôt de fichiers géospatiaux.
 *
 * Les limites de taille **ne sont pas** vérifiées ici : elles dépendent du type
 * déclaré et s'appliquent aux octets décodés, pas au texte base64. Elles sont
 * dans le service (`geospatialImport.service.js#tailleMaximale`), là où le
 * tampon existe.
 */

/** Types de dépôt acceptés par ce module. */
export const KINDS = ['GPR', 'DRONE_IMAGE'];

export const receiveSchema = z.object({
  kind: z.enum(KINDS, {
    errorMap: () => ({ message: `Type non pris en charge. Valeurs acceptées : ${KINDS.join(', ')}` }),
  }),
  filename: z.string().min(1).max(255),
  contentBase64: z
    .string()
    .min(1, 'contentBase64 est requis')
    // Plafond grossier sur le texte : le contrôle fin porte sur les octets
    // décodés, dans le service. On borne quand même ici pour ne pas laisser
    // passer un corps absurdement grand jusqu'au décodage.
    .max(950 * 1024 * 1024, 'Corps base64 trop volumineux'),
  plotId: z.string().min(1).optional(),
  deviceId: z.string().min(1).optional(),
});

export const listSchema = z.object({
  kind: z.enum(KINDS).optional(),
  /**
   * `RECEIVED` est le seul statut que ce module produit. Les autres valeurs de
   * l'enum sont acceptées en filtre pour rester compatible avec l'étape de
   * traitement à venir, mais aucune ligne ne les porte aujourd'hui.
   */
  status: z.enum(['RECEIVED', 'PROCESSING', 'COMPLETED', 'ERROR']).optional(),
  plotId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const idParamsSchema = z.object({
  id: z.string().min(1),
});
