/**
 * Exigences CDC couvertes : SEC-05.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { ApiError } from '../shared/errors/ApiError.js';

/**
 * Valide une partie de la requête avec un schéma Zod (SEC-02).
 * Les schémas de validation sont la source de vérité du contrat d'API.
 *
 *   router.post('/', validate(createFarmSchema), handler)
 *   router.get('/', validate(querySchema, 'query'), handler)
 *   router.get('/:id', validate(idParamSchema, 'params'), handler)
 */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || source,
      code: issue.message,
    }));
    return next(ApiError.badRequest('Validation error', errors));
  }

  // Remplace par la version nettoyée/typée (strip des champs inconnus).
  req[source] = result.data;
  next();
};

/** Blocage des opérateurs Mongo/NoSQL dans les entrées (SEC-02, par prudence). */
export const rejectOperators = (req, _res, next) => {
  const inspect = (value) => {
    if (!value || typeof value !== 'object') return false;
    return Object.keys(value).some(
      (key) => key.startsWith('$') || key.includes('\u0000') || inspect(value[key]),
    );
  };

  for (const source of ['body', 'query', 'params']) {
    if (inspect(req[source])) {
      return next(ApiError.badRequest('Entrée invalide'));
    }
  }
  next();
};
