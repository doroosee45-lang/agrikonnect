/**
 * Exigences CDC couvertes : SEC-06, SEC-07, SEC-08.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { env } from './config/env.js';
import routes from './routes/index.js';
import { settingsEffects } from './middleware/settingsEffects.js';

/**
 * Contrat OpenAPI généré (scripts/generate-openapi.mjs).
 * Lu une seule fois au démarrage : aucune I/O par requête.
 */
const openapiSpec = JSON.parse(
  readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'docs/openapi.json'), 'utf8'),
);
import { requestId } from './shared/http/requestId.js';
import { globalLimiter, writeLimiter } from './middleware/rateLimit.js';
import { authenticate } from './middleware/auth.js';
import { rejectOperators } from './middleware/validate.js';
import { notFound } from './shared/http/notFound.js';
import { errorHandler } from './shared/http/errorHandler.js';

export const createApp = () => {
  const app = express();

  // Derrière un proxy (Render, Railway, Fly…) pour un rate-limit fiable.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // ─── Sécurité & parsing (SEC-01) ────────────────────────────
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Requêtes sans Origin (Postman, server-to-server) : autorisées.
        if (!origin || env.corsOrigins.includes('*') || env.corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origine non autorisée par CORS : ${origin}`));
      },
      credentials: true,
      exposedHeaders: ['X-Request-Id'],
    }),
  );
  /*
   * Identifiant de corrélation posé **avant** les parseurs : sans cela, un corps
   * refusé par la limite de taille repart sans `X-Request-Id`, et l'utilisateur
   * ne peut rien communiquer au support.
   */
  app.use(requestId);

  // WA-01 — le corps brut est requis pour vérifier la signature des webhooks.
  const jsonGlobal = express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      if (buf?.length) req.rawBody = buf;
    },
  });

  /*
   * Le dépôt de fichiers géospatiaux passe par un corps base64 : 1 Mo de
   * plafond global le rendrait inutilisable. On fait donc bifurquer le
   * parseur sur ce chemin précis, **sans** relever la limite des autres
   * routes — les relever toutes exposerait l'ensemble de l'API.
   *
   * ## L'authentification précède la lecture du corps
   *
   * Un parseur à 100 Mo qui tourne avant toute authentification est un vecteur
   * d'épuisement : n'importe qui peut faire allouer 100 Mo par requête, sans
   * identité, en boucle. Sur ce chemin, on applique donc **d'abord** une limite
   * de débit stricte, **puis** l'authentification, et seulement ensuite le
   * parseur. Une requête sans jeton est refusée en 401 sans que son corps soit
   * lu.
   *
   * `rawBody` n'est pas conservé ici : il n'y a pas de signature à vérifier, et
   * doubler en mémoire un corps de plusieurs dizaines de Mo n'aurait aucun
   * intérêt.
   *
   * Le plafond du corps borne ce que le dépôt base64 peut transporter. Un
   * fichier de 64 Mo devient ~85 Mo une fois encodé ; le défaut de 100 Mo
   * laisse la marge, et il est réglable par `GEOSPATIAL_JSON_MAX_BYTES`.
   *
   * Ce chemin base64 reste pour la compatibilité. Le téléversement de fichiers
   * volumineux passe par `POST /geospatial/imports/upload` en
   * `multipart/form-data`, qui n'encode rien et n'a donc pas ce surcoût de 33 %.
   */
  const jsonDepotGeospatial = express.json({ limit: env.GEOSPATIAL_JSON_MAX_BYTES });
  const CHEMIN_DEPOT = `${env.apiPrefix}/geospatial/imports`;
  const CHEMIN_DEPOT_MULTIPART = `${CHEMIN_DEPOT}/upload`;

  /** Enchaîne des middlewares sans imbriquer les callbacks. */
  const chainer =
    (...etapes) =>
    (req, res, next) => {
      let i = 0;
      const suivant = (erreur) => {
        if (erreur) return next(erreur);
        const etape = etapes[i++];
        return etape ? etape(req, res, suivant) : next();
      };
      suivant();
    };

  const gardeDepot = chainer(writeLimiter, authenticate, jsonDepotGeospatial);

  /*
   * Téléversement multipart : **aucun parseur de corps** ne doit tourner ici.
   *
   * `express.json` lirait le flux jusqu'au bout pour conclure que ce n'est pas
   * du JSON, et la route ne trouverait plus rien à lire. Le flux est donc laissé
   * intact, et c'est la route qui le lit avec son propre plafond
   * (`GEOSPATIAL_MULTIPART_MAX_BYTES`), octet par octet.
   *
   * L'ordre reste le même que pour le dépôt base64 : limite de débit puis
   * authentification **avant** toute lecture de corps. Sans cela, une requête
   * anonyme pourrait faire allouer 64 Mo en boucle.
   */
  const gardeDepotMultipart = chainer(writeLimiter, authenticate);

  app.use((req, res, next) => {
    if (req.method !== 'POST') return jsonGlobal(req, res, next);
    if (req.path === CHEMIN_DEPOT_MULTIPART) return gardeDepotMultipart(req, res, next);
    if (req.path === CHEMIN_DEPOT) return gardeDepot(req, res, next);
    return jsonGlobal(req, res, next);
  });
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(rejectOperators);
  app.use(morgan(env.isProd ? 'combined' : 'dev'));

  // ─── Limitation de débit ────────────────────────────────────
  app.use(env.apiPrefix, globalLimiter);

  // ─── Documentation de l'API ─────────────────────────────────
  // Contrat OpenAPI 3.0.3 généré depuis le code (scripts/generate-openapi.mjs).
  app.get(`${env.apiPrefix}/docs`, (_req, res) => {
    res.json({
      success: true,
      data: {
        openapi: '3.0.3',
        version: '5.0.0',
        specUrl: `${env.apiPrefix}/docs/openapi.json`,
        scope: 'V1 FARM · V2 MARKET · V3 INTELLIGENCE · V4 INVEST · V5 GLOBAL',
        publicRoutes: ['/public/map', '/public/farms', '/public/lots/:code', '/crops', '/countries'],
        apiKeyRoutes: ['/public-api/v1/products', '/public-api/v1/products/:id/aggregates', '/public-api/v1/prices'],
        authHeader: 'Authorization: Bearer <token Supabase>',
        apiKeyHeader: 'X-API-Key (API publique de données)',
        tenantHeader: 'X-Organization-Id (optionnel : organisation active)',
        idempotencyHeader: 'Idempotency-Key (commandes, stock, analyses IA)',
      },
    });
  });

  app.get(`${env.apiPrefix}/docs/openapi.json`, (_req, res) => {
    res.json(openapiSpec);
  });

  // ─── Racine ─────────────────────────────────────────────────
  app.get('/', (_req, res) => {
    res.json({
      success: true,
      data: {
        name: 'AGRIKONNECT AFRICA API',
        version: '5.0.0',
        scope: 'V1 FARM · V2 MARKET · V3 INTELLIGENCE · V4 INVEST · V5 GLOBAL',
        docs: `${env.apiPrefix}/docs`,
        health: `${env.apiPrefix}/health`,
      },
    });
  });

  app.use(env.apiPrefix, settingsEffects);
  app.use(env.apiPrefix, routes);

  // ─── 404 & erreurs ──────────────────────────────────────────
  app.use(notFound);
  app.use(errorHandler);

  return app;
};
