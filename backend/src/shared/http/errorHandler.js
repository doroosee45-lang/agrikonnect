import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiError } from '../errors/ApiError.js';
import { logger } from './logger.js';
import { env } from '../../config/env.js';

/** Traduit les erreurs connues (Prisma, Zod, JSON…) en ApiError lisibles. */
const normalize = (err) => {
  if (err instanceof ApiError) return err;

  if (err instanceof ZodError) {
    return ApiError.badRequest(
      'Validation error',
      err.issues.map((i) => ({ field: i.path.join('.') || 'body', code: i.message })),
    );
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'valeur unique';
        return ApiError.conflict(`Cette valeur existe déjà (${target})`);
      }
      case 'P2025':
        return ApiError.notFound('Ressource introuvable');
      case 'P2003':
        return ApiError.badRequest('Référence invalide vers une ressource liée');
      case 'P2014':
        return ApiError.badRequest('Relation requise manquante');
      default:
        return ApiError.badRequest(`Erreur base de données (${err.code})`);
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return ApiError.badRequest('Requête base de données invalide');
  }

  if (err?.type === 'entity.parse.failed') {
    return ApiError.badRequest('Corps de requête JSON invalide');
  }

  /**
   * SEC-06 — les erreurs du middleware de corps (payload trop volumineux,
   * encodage non supporté…) portent déjà un statut HTTP : on le respecte au
   * lieu de renvoyer un 500 trompeur.
   */
  if (err?.type === 'entity.too.large') {
    return new ApiError(413, 'Corps de requête trop volumineux', { code: 'PAYLOAD_TOO_LARGE' });
  }

  if (err?.code === 'LIMIT_FILE_SIZE') {
    return ApiError.badRequest('Fichier trop volumineux');
  }

  return ApiError.internal();
};

/** Middleware d'erreur final — doit être déclaré en dernier. */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  const apiError = normalize(err);
  const requestId = req.id ?? null;

  if (apiError.status >= 500) {
    logger.error(`[${requestId}] ${req.method} ${req.originalUrl} —`, err);
  } else {
    logger.warn(`[${requestId}] ${req.method} ${req.originalUrl} — ${apiError.status} ${apiError.message}`);
  }

  const body = {
    success: false,
    /*
     * Code machine de l'erreur. **Ajout** au contrat, rien n'est retiré : les
     * clients existants lisent `success`, `message` et `requestId`, qui restent
     * inchangés.
     *
     * `ApiError` portait déjà ce code (`VALIDATION_ERROR`, `NOT_FOUND`,
     * `CONFLICT`…) sans jamais l'exposer : un client ne pouvait donc pas
     * distinguer deux erreurs de même statut autrement qu'en comparant des
     * messages destinés à être lus par des humains, et voués à changer. Le
     * statut HTTP seul ne suffit pas — 422 couvre aussi bien un champ manquant
     * qu'un type de fichier refusé.
     *
     * `null` quand l'erreur ne porte pas de code, plutôt que d'omettre la clé :
     * une clé toujours présente est plus simple à consommer.
     */
    code: apiError.code ?? null,
    message: apiError.message,
    requestId,
  };

  if (apiError.errors) body.errors = apiError.errors;
  if (apiError.details) body.details = apiError.details;
  if (env.isDev && apiError.status >= 500) body.stack = err?.stack;

  return res.status(apiError.status).json(body);
};
