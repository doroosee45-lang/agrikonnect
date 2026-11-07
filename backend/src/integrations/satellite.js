import { env } from '../config/env.js';
import { logger } from '../shared/http/logger.js';
import { hardware } from '../config/hardware.js';
import { PRIMARY_MOISTURE_SOURCE, MOISTURE_INDEXES } from '../config/satellite.js';

/**
 * Abstraction fournisseur satellite — même contrat que pour le SMS.
 *
 * Le but est de pouvoir passer d'un fournisseur simulé à Sentinel Hub ou Earth
 * Engine **sans réécrire le backend** : seul `SATELLITE_PROVIDER` change, et les
 * secrets viennent de l'environnement.
 *
 * Deux règles non négociables :
 *
 *  1. **Un fournisseur réel qui n'est pas configuré échoue bruyamment.** Il ne
 *     retombe jamais sur des valeurs fabriquées : une scène simulée présentée
 *     comme une mesure serait indiscernable d'une vraie pour l'agriculteur.
 *  2. **Le mode simulé est explicitement marqué et refusé en production.** Une
 *     observation simulée porte `mode: 'SIMULATED'`, que la couche de données
 *     refuse d'écrire quand `NODE_ENV=production`.
 */

/**
 * Forme normalisée attendue de tout fournisseur.
 *
 * @typedef {object} Scene
 * @property {string} provider    identifiant du fournisseur
 * @property {string} sourceId    `sentinel-1` | `sentinel-2` (voir hardware.js)
 * @property {string} index       nom de l'index mesuré
 * @property {number} value       valeur de l'index
 * @property {Date}   observedAt  date d'acquisition de la scène
 * @property {number|null} cloudCoverPct  couverture nuageuse, `null` si inconnue
 * @property {'REAL'|'SIMULATED'} mode
 */

const timeoutOption = () =>
  hardware.satellite.requestTimeout.value === null
    ? {}
    : { signal: AbortSignal.timeout(hardware.satellite.requestTimeout.value) };

/**
 * Lecture des réglages à l'appel, et non à l'import.
 *
 * `env` est validé et figé au chargement du module : sans cette indirection, un
 * test ne pourrait pas changer de fournisseur sans recharger toute l'application.
 * C'est le même motif que `src/integrations/geospatial.js` pour `GEOAI_URL`.
 */
const activeProvider = () => process.env.SATELLITE_PROVIDER || env.SATELLITE_PROVIDER;
const apiUrl = () => process.env.SATELLITE_API_URL || env.SATELLITE_API_URL;
const apiKey = () => process.env.SATELLITE_API_KEY || env.SATELLITE_API_KEY;

/**
 * Activation de l'acquisition, lue à l'appel.
 *
 * `env` est figé au chargement : sans cette indirection, un test ne pourrait pas
 * activer le job sans recharger l'application.
 */
const acquisitionEnabled = () =>
  (process.env.SATELLITE_ACQUISITION_ENABLED ?? env.SATELLITE_ACQUISITION_ENABLED) === 'true';

/** Contrôle commun aux fournisseurs réels : sans configuration, on refuse. */
const requireRealConfig = (provider) => {
  if (!apiUrl()) {
    throw new Error(
      `SATELLITE_API_URL manquant pour le fournisseur « ${provider} » `
      + '(variable nommée par hardware.satellite.apiUrlEnvVar).',
    );
  }
  if (!apiKey()) {
    throw new Error(`SATELLITE_API_KEY manquant pour le fournisseur « ${provider} ».`);
  }
};

const callProvider = async (provider, body) => {
  const response = await fetch(apiUrl(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify(body),
    ...timeoutOption(),
  });
  if (!response.ok) {
    throw new Error(`Fournisseur satellite « ${provider} » : HTTP ${response.status}`);
  }
  return response.json();
};

/**
 * Lit une réponse fournisseur et refuse toute forme inattendue.
 *
 * Renvoyer `undefined` ici produirait une observation sans valeur, ou une valeur
 * numérique par défaut : dans les deux cas un nombre plausible mais faux.
 */
const normalise = (provider, payload, requested) => {
  const value = Number(payload?.value);
  if (!Number.isFinite(value)) {
    throw new Error(`Réponse du fournisseur « ${provider} » sans valeur numérique exploitable.`);
  }
  const observedAt = payload?.observedAt ? new Date(payload.observedAt) : null;
  if (!observedAt || Number.isNaN(observedAt.getTime())) {
    throw new Error(`Réponse du fournisseur « ${provider} » sans date d'acquisition valide.`);
  }
  return {
    provider,
    sourceId: payload?.sourceId ?? requested.sourceId,
    index: payload?.index ?? requested.index,
    value,
    observedAt,
    cloudCoverPct: Number.isFinite(Number(payload?.cloudCoverPct)) ? Number(payload.cloudCoverPct) : null,
    mode: 'REAL',
    raw: payload?.raw ?? null,
  };
};

const providers = {
  /**
   * Sentinel Hub — API statistique.
   *
   * L'implémentation appelle l'URL configurée avec un contrat explicite ; le
   * branchement sur l'API réelle est une affaire d'identifiants et d'URL, pas de
   * code métier.
   */
  sentinelhub: async (request) => {
    requireRealConfig('sentinelhub');
    const payload = await callProvider('sentinelhub', {
      provider: 'sentinelhub',
      mission: request.source.mission,
      sourceId: request.sourceId,
      index: request.index,
      bbox: request.bbox,
      from: request.from,
      to: request.to,
    });
    return normalise('sentinelhub', payload, request);
  },

  /** Google Earth Engine — même contrat, fournisseur différent. */
  earthengine: async (request) => {
    requireRealConfig('earthengine');
    const payload = await callProvider('earthengine', {
      provider: 'earthengine',
      mission: request.source.mission,
      sourceId: request.sourceId,
      index: request.index,
      bbox: request.bbox,
      from: request.from,
      to: request.to,
    });
    return normalise('earthengine', payload, request);
  },

  /**
   * Passerelle générique par webhook.
   *
   * Indispensable pour les agrégateurs locaux et pour les tests d'intégration :
   * c'est le seul fournisseur réel qu'on puisse brancher sans compte cloud.
   */
  webhook: async (request) => {
    if (!apiUrl()) throw new Error('SATELLITE_API_URL manquant pour le fournisseur webhook');
    const payload = await callProvider('webhook', {
      provider: 'webhook',
      sourceId: request.sourceId,
      index: request.index,
      bbox: request.bbox,
      from: request.from,
      to: request.to,
    });
    return normalise('webhook', payload, request);
  },

  /**
   * Fournisseur simulé — **réservé aux tests**.
   *
   * La valeur est déterministe (dérivée de la parcelle et de la date) pour que
   * les recettes soient reproductibles. Elle est marquée `SIMULATED` et le
   * service refuse de la persister en production : une valeur simulée qui
   * atteindrait une base réelle deviendrait indiscernable d'une mesure.
   */
  simulated: async (request) => {
    if (env.isProd) {
      throw new Error(
        'Le fournisseur satellite simulé est refusé en production. Configurez '
        + `${hardware.satellite.providerEnvVar} sur un fournisseur réel.`,
      );
    }
    // Hachage simple et stable : même parcelle, même jour → même scène.
    const seedSource = `${request.plotId}:${request.observedAtKey}`;
    let hash = 0;
    for (let i = 0; i < seedSource.length; i += 1) {
      hash = (hash * 31 + seedSource.charCodeAt(i)) % 100_000;
    }
    const fraction = hash / 100_000;

    const value = MOISTURE_INDEXES.includes(request.index)
      ? Number((12 + fraction * 30).toFixed(3))
      : Number((0.2 + fraction * 0.7).toFixed(4));

    logger.warn(
      `[satellite:simulated] scène générée pour ${request.plotId} (${request.index} = ${value}) — `
      + 'valeur simulée, jamais une mesure.',
    );

    return {
      provider: 'simulated',
      sourceId: request.sourceId,
      index: request.index,
      value,
      observedAt: new Date(request.to),
      // Le radar traverse les nuages : la couverture n'a pas d'effet sur lui.
      cloudCoverPct: request.source.cloudInsensitive ? null : Number((fraction * 100).toFixed(1)),
      mode: 'SIMULATED',
      simulated: true,
    };
  },
};

/**
 * Paramètres de fonctionnement, pour observabilité et tests.
 *
 * Le **fournisseur actif** et les **secrets** restent dans l'environnement ; les
 * limites (fenêtre de recherche, tentatives) viennent du fichier de
 * configuration matériel.
 */
export const satelliteSettings = () => ({
  provider: activeProvider(),
  providerEnvVar: hardware.satellite.providerEnvVar,
  availableProviders: hardware.satellite.providers,
  apiUrlConfigured: Boolean(apiUrl()),
  apiKeyConfigured: Boolean(apiKey()),
  acquisitionEnabled: acquisitionEnabled(),
  enabledEnvVar: hardware.satellite.enabledEnvVar,
  refreshHours: env.SATELLITE_REFRESH_HOURS,
  refreshIntervalEnvVar: hardware.satellite.refreshIntervalEnvVar,
  sceneLookbackDays: hardware.satellite.sceneLookbackDays.value,
  maxAttempts: hardware.satellite.maxAttempts,
  requestTimeoutMs: hardware.satellite.requestTimeout.value,
  retryDelayMs: hardware.satellite.retryDelay.value,
  primaryMoistureSource: PRIMARY_MOISTURE_SOURCE?.id ?? null,
  moistureIndexes: [...MOISTURE_INDEXES],
  /** Le mode simulé n'est jamais disponible en production. */
  simulatedAllowed: !env.isProd,
});

/**
 * Acquiert une scène auprès du fournisseur actif.
 *
 * Retente jusqu'à `maxAttempts` fois, puis laisse remonter l'erreur : l'appelant
 * trace l'échec plutôt que de le masquer derrière une valeur par défaut.
 *
 * @returns {Promise<Scene>}
 */
export const fetchScene = async (request) => {
  const selected = activeProvider();
  const provider = providers[selected];
  if (!provider) {
    throw new Error(
      `Fournisseur satellite inconnu : « ${selected} ». `
      + `Disponibles : ${hardware.satellite.providers.join(', ')}.`,
    );
  }

  const maxAttempts = hardware.satellite.maxAttempts;
  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await provider(request);
    } catch (error) {
      lastError = error;
      // Une configuration absente ou un refus du mode simulé ne se corrigent pas
      // en retentant : on remonte immédiatement.
      if (/manquant|refusé en production|inconnu/i.test(error.message)) throw error;
      if (attempt + 1 < maxAttempts && hardware.satellite.retryDelay.value !== null) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, hardware.satellite.retryDelay.value));
      }
    }
  }

  throw lastError;
};
