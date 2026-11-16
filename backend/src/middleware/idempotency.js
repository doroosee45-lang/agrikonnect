/**
 * Exigences CDC couvertes : SEC-12.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../config/prisma.js';
import { ApiError } from '../shared/errors/ApiError.js';
import { logger } from '../shared/http/logger.js';

/**
 * Idempotence des créations sensibles (CDC §13.2) :
 * commandes, mouvements de stock, synchronisation.
 *
 * Le client envoie `Idempotency-Key: <uuid>`. Si la clé a déjà produit une
 * réponse, on la rejoue telle quelle au lieu de créer un doublon.
 */
/** M-01 — fonction pure (testée) : clé stockée, cloisonnée par utilisateur. */
export const cleIdempotence = (userId, cleClient) => `${userId ?? 'anonyme'}:${String(cleClient)}`;

export const idempotency = (scope) => async (req, res, next) => {
  const key = req.headers['idempotency-key'];

  if (!key || String(key).length < 8) {
    return next(
      ApiError.badRequest('En-tête Idempotency-Key requis pour cette opération sensible'),
    );
  }

  /*
   * M-01 — la clé est rangée PAR UTILISATEUR (`<userId>:<clé>`) : l'unicité
   * `(key, scope)` devient propre à chacun. Une clé connue d'un tiers (journal,
   * proxy, client qui génère des clés prévisibles) ne rejoue jamais la réponse
   * d'un autre utilisateur. Aucune migration : seul le contenu de `key` change.
   */
  const value = cleIdempotence(req.user?.id, key);
  const where = { key_scope: { key: value, scope } };

  try {
    // Réserver la clé avant tout effet métier. L'unicité SQL arbitre les requêtes concurrentes.
    await prisma.idempotencyKey.create({
      data: {
        key: value,
        scope,
        userId: req.user?.id ?? null,
        responseStatus: null,
        responseBody: null,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
  } catch (error) {
    if (error.code !== 'P2002') return next(error);

    try {
      const existing = await prisma.idempotencyKey.findUnique({ where });
      if (existing && existing.responseStatus !== null && existing.responseStatus !== undefined) {
        res.setHeader('Idempotent-Replayed', 'true');
        return res.status(existing.responseStatus).json(existing.responseBody);
      }
      return next(ApiError.conflict('Une requête avec cette clé idempotente est déjà en cours'));
    } catch (lookupError) {
      return next(lookupError);
    }
  }

  const originalJson = res.json.bind(res);
  let responseHandled = false;
  res.json = (body) => {
    if (responseHandled) return originalJson(body);
    responseHandled = true;

    if (res.statusCode >= 500) {
      return prisma.idempotencyKey
        .delete({ where })
        .catch((error) => logger.error('IDEMPOTENCY_PENDING_DELETE_FAILED', error.message))
        .then(() => originalJson(body));
    }

    return prisma.idempotencyKey
      .update({
        where,
        data: { responseStatus: res.statusCode, responseBody: body },
      })
      .then(() => originalJson(body))
      .catch(async (error) => {
        logger.error('IDEMPOTENCY_RESPONSE_PERSIST_FAILED', error.message);
        await prisma.idempotencyKey
          .delete({ where })
          .catch((deleteError) => logger.error('IDEMPOTENCY_PENDING_DELETE_FAILED', deleteError.message));
        res.json = originalJson;
        return next(ApiError.internal('Impossible de conserver la réponse idempotente'));
      });
  };

  return next();
};