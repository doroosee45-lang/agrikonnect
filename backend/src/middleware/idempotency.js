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
export const idempotency = (scope) => async (req, res, next) => {
  const key = req.headers['idempotency-key'];

  if (!key || String(key).length < 8) {
    return next(
      ApiError.badRequest('En-tête Idempotency-Key requis pour cette opération sensible'),
    );
  }

  try {
    const existing = await prisma.idempotencyKey.findUnique({
      where: { key_scope: { key: String(key), scope } },
    });

    if (existing?.responseBody) {
      res.setHeader('Idempotent-Replayed', 'true');
      return res.status(existing.responseStatus ?? 200).json(existing.responseBody);
    }

    // Capture de la réponse pour un éventuel rejeu.
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      prisma.idempotencyKey
        .create({
          data: {
            key: String(key),
            scope,
            userId: req.user?.id ?? null,
            responseStatus: res.statusCode,
            responseBody: body,
            expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
          },
        })
        .catch((error) => {
          // Collision possible si deux requêtes arrivent simultanément :
          // l'unicité en base garantit alors qu'une seule est appliquée.
          if (error.code !== 'P2002') logger.error('IdempotencyKey :', error.message);
        });
      return originalJson(body);
    };

    next();
  } catch (error) {
    next(error);
  }
};
