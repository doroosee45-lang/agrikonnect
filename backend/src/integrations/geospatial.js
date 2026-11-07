/**
 * Exigences CDC couvertes : SOIL-10, SOIL-11, SOIL-12, SOIL-13, SOIL-14, GEO-01,
 * GEO-02, NFR-10 (disponibilité 99,5 % : dégradation explicite sans fournisseur).
 *
 * Client du moteur géospatial Python (`geoai/`).
 *
 * Pourquoi un service séparé : le calcul spectral, les horizons de sous-sol et
 * la fusion multi-sources demandent numpy/scipy et des matrices de pixels. Node
 * reste le seul propriétaire des données et des autorisations ; Python ne reçoit
 * que ce qu'on lui envoie et ne lit jamais la base.
 *
 * Le client est **honnête** : si le moteur est indisponible, l'API renvoie 503
 * avec un code explicite. On ne fabrique jamais un diagnostic de substitution.
 */
import { env } from '../config/env.js';
import { logger } from '../shared/http/logger.js';

const ENGINE_NAME = 'agrikonnect-geoai';

// Les valeurs sont lues à l'appel (et non figées à l'import) : cela permet de
// surcharger l'URL du moteur en test ou de basculer de moteur sans redéployer.
const baseUrl = () => String(process.env.GEOAI_URL || env.GEOAI_URL || '').replace(/\/$/, '');
const token = () => process.env.GEOAI_TOKEN || env.GEOAI_TOKEN;
const timeoutMs = () => {
  const value = Number(process.env.GEOAI_TIMEOUT_MS || env.GEOAI_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : env.GEOAI_TIMEOUT_MS;
};
const retriesCount = () => {
  const raw = process.env.GEOAI_RETRIES;
  const value = raw === undefined || raw === '' ? Number(env.GEOAI_RETRIES) : Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.min(value, 3) : env.GEOAI_RETRIES;
};

const headers = () => ({
  'content-type': 'application/json',
  ...(token() ? { 'x-geoai-token': token() } : {}),
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const engineError = (code, message, status = 503, details = null) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  error.isEngineError = true;
  return error;
};

/**
 * Appelle le moteur. Idempotent : une erreur réseau est retentée `GEOAI_RETRIES`
 * fois. Les erreurs 4xx du moteur (payload invalide) ne sont jamais retentées.
 */
export const callEngine = async (path, payload, options = {}) => {
  const url = `${baseUrl()}${path}`;
  if (!/^https?:\/\//.test(url)) {
    throw engineError('GEOSPATIAL_ENGINE_UNAVAILABLE', `GEOAI_URL invalide : « ${baseUrl()} »`, 503);
  }
  const retries = options.retries ?? retriesCount();
  const limit = options.timeout ?? timeoutMs();
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), limit);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload ?? {}),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const body = await response.json().catch(() => ({}));

      if (response.ok) return body;

      if (response.status === 422) {
        throw engineError(
          'GEOSPATIAL_INVALID_PAYLOAD',
          body?.error?.message ?? 'Données refusées par le moteur géospatial',
          422,
          body?.error?.details ?? null,
        );
      }
      if (response.status === 401 || response.status === 403) {
        throw engineError('GEOSPATIAL_UNAUTHORIZED', 'Jeton du moteur géospatial refusé', 502);
      }

      lastError = engineError(
        'GEOSPATIAL_ENGINE_ERROR',
        `Moteur géospatial en erreur (HTTP ${response.status})`,
        502,
        body?.error ?? null,
      );
    } catch (error) {
      clearTimeout(timer);
      if (error.isEngineError) throw error;
      lastError = engineError(
        'GEOSPATIAL_ENGINE_UNAVAILABLE',
        `Moteur géospatial injoignable (${error.name === 'AbortError' ? 'délai dépassé' : error.message}). ` +
          'Démarre-le avec `python3 geoai/server.py` ou renseigne GEOAI_URL.',
        503,
      );
    }

    if (attempt < retries) await sleep(150 * (attempt + 1));
  }

  throw lastError;
};

/** Sonde de disponibilité (utilisée par `/geospatial/health` et la supervision). */
export const engineHealth = async () => {
  const url = `${baseUrl()}/health`;
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs(), 3000));
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const body = await response.json().catch(() => ({}));
    return {
      available: response.ok,
      engine: body?.service ?? ENGINE_NAME,
      version: body?.version ?? null,
      latencyMs: Date.now() - started,
      url: baseUrl(),
    };
  } catch (error) {
    logger.warn(`[geoai] indisponible : ${error.message}`);
    return { available: false, engine: ENGINE_NAME, version: null, latencyMs: Date.now() - started, url: baseUrl(), error: error.message };
  }
};

/** Métadonnées du moteur (seuils, méthodes, ordre de priorité des sources). */
export const engineMeta = async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs(), 5000));
  try {
    const response = await fetch(`${baseUrl()}/v1/meta`, {
      headers: headers(),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

export const analyzeSoil = (payload) => callEngine('/v1/soil/analyze', payload);
export const classifyTexture = (payload) => callEngine('/v1/soil/texture', payload);
export const subsurfaceProfile = (payload) => callEngine('/v1/subsurface/profile', payload);
export const spectralIndices = (payload) => callEngine('/v1/spectral/indices', payload);
export const phenology = (payload) => callEngine('/v1/spectral/phenology', payload);
export const sensorQuality = (payload) => callEngine('/v1/sensors/quality', payload);
export const analyzeImagery = (payload) => callEngine('/v1/imagery/analyze', payload);
export const fuseObservations = (payload) => callEngine('/v1/fusion', payload);

/**
 * Prévision d'un paramètre du sol.
 *
 * Le moteur rend `sufficient: false` avec un motif quand les données réelles
 * sont trop rares : il ne produit alors **aucune** valeur. L'appelant ne doit
 * jamais interpréter une réponse insuffisante comme une prévision nulle.
 */
export const forecastSoil = (payload) => callEngine('/v1/forecast/soil', payload);

/**
 * Évaluation d'une méthode sur découpage chronologique, sans prévision.
 *
 * C'est cette évaluation — et non une intention — qui conditionne la promotion
 * d'un modèle en production (`promotable`).
 */
export const forecastBacktest = (payload) => callEngine('/v1/forecast/backtest', payload);

/**
 * Interpolation spatiale (krigeage ordinaire) d'un paramètre de sol.
 *
 * Rend une grille avec son incertitude, les valeurs aberrantes motivées et la
 * validation croisée « laisser une sonde dehors ». Moins de trois sondes →
 * `sufficient: false` avec le motif, et **aucune** grille.
 */
export const interpolateGrid = (payload) => callEngine('/v1/interpolation/grid', payload);

/**
 * Validation croisée seule, sans carte.
 *
 * Sert à qualifier la méthode et ses sorties avant de produire une carte :
 * l'erreur « laisser une sonde dehors » est la seule mesure honnête disponible
 * en l'absence de vérité terrain indépendante.
 */
export const interpolationLoo = (payload) => callEngine('/v1/interpolation/loo', payload);

export const ENGINE = ENGINE_NAME;
