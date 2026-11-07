import { prisma } from '../config/prisma.js';
import { ApiError } from '../shared/errors/ApiError.js';
import { sha256 } from '../shared/crypto.js';
import { logger } from '../shared/http/logger.js';

/**
 * Authentification par clé d'API pour l'API publique V5 (API-01).
 *
 * - La clé est stockée hachée (SHA-256) avec un préfixe indexable.
 * - Le client doit disposer d'un contrat de finalité (API-03) : la valeur
 *   de la donnée n'est pas vendue, elle est fournie pour un usage défini.
 * - Quotas journaliers + journal d'usage (api_usage).
 */
const DAILY_QUOTA = Number(process.env.API_DAILY_QUOTA ?? 1000);

export const apiKeyAuth = (requiredScope = 'data:read') => async (req, _res, next) => {
  try {
    const raw = req.headers['x-api-key'];
    if (!raw || typeof raw !== 'string') {
      throw ApiError.unauthorized('Clé d\'API manquante (en-tête X-API-Key)');
    }

    const prefix = raw.slice(0, 12);
    const key = await prisma.apiKey.findUnique({
      where: { prefix },
      include: { client: true },
    });

    if (!key || key.keyHash !== sha256(raw)) throw ApiError.unauthorized('Clé d\'API invalide');
    if (key.status !== 'ACTIVE' || key.revokedAt) throw ApiError.unauthorized('Clé d\'API révoquée');
    if (key.expiresAt && key.expiresAt < new Date()) throw ApiError.unauthorized('Clé d\'API expirée');
    if (key.client.status !== 'ACTIVE') throw ApiError.forbidden('Client API désactivé');

    if (!key.client.scopes.includes(requiredScope) && !key.client.scopes.includes('*')) {
      throw ApiError.forbidden(`Portée requise : ${requiredScope}`);
    }

    if (!key.client.purposeApprovedAt) {
      throw ApiError.forbidden('Contrat de finalité non approuvé pour ce client API');
    }

    // Quota journalier
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const used = await prisma.apiUsage.count({ where: { clientId: key.clientId, at: { gte: since } } });
    if (used >= DAILY_QUOTA) {
      throw ApiError.tooManyRequests(`Quota journalier atteint (${DAILY_QUOTA} appels)`);
    }

    req.apiClient = key.client;
    req.apiKey = key;

    // Journalisation de l'usage sans bloquer la requête
    const logUsage = () => {
      prisma.apiUsage
        .create({
          data: {
            /*
             * `ApiUsage.id` est un `String @id` **sans** `@default` : Prisma
             * refuse la création sans identifiant (« Argument `id` is missing »).
             * L'identifiant est donc généré ici, avec la même convention de
             * préfixe que les autres modules (`thr_`, `prd_`, `prc_`, …).
             *
             * Le `.catch()` ne loggue plus seulement : il retrace l'échec au
             * niveau `error` avec un marqueur stable, parce qu'un journal
             * d'usage qui échoue en silence fausse le compteur de quota —
             * `apiUsage.count()` reste à 0 et le plafond journalier ne
             * s'applique jamais.
             */
            id: `usg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
            clientId: key.clientId,
            keyId: key.id,
            route: req.originalUrl,
            status: _res.statusCode,
          },
        })
        .catch((error) => {
          logger.error('API_USAGE_WRITE_FAILED', {
            clientId: key.clientId,
            route: req.originalUrl,
            erreur: error.message,
          });
        });

      prisma.apiKey
        .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
        .catch(() => {});
    };
    _res.on('finish', logUsage);

    next();
  } catch (error) {
    next(error);
  }
};
