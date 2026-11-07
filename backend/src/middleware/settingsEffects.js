import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { ApiError } from '../shared/errors/ApiError.js';

/**
 * SPEC-SUPER-ADMIN M3 — effets réels des paramètres (AC-M3, RG-M3-4).
 *
 * Branché dans `app.js` **avant** les routes métier :
 *   app.use(env.apiPrefix, settingsEffects);
 *
 * Deux effets, lus dans la table `settings` (cache mémoire de 15 s,
 * invalidé par toute écriture des paramètres) :
 *
 *  1. `modules.<x>` = false → toute route du module répond
 *     **403 « module_disabled »** (AC-M3 : « module désactivé → route renvoie
 *     403 module_disabled ») ;
 *  2. `platform.maintenance` = true → **mutations refusées** (403
 *     « maintenance_mode ») hors administration : la plateforme est en
 *     lecture seule pour le métier (RG-M3-4). Restent exemptés : `/auth`
 *     (sans quoi personne ne pourrait plus se connecter pour administrer),
 *     `/admin`, `/webhooks` (rappels externes signés) et `/health`.
 *
 * En cas d'indisponibilité de la base, le garde-fou est **défaillant-libre** :
 * la requête passe (les effets reviennent dès que la lecture redevient
 * possible) — jamais de coupure générale causée par ce middleware.
 */

/** Module → préfixes d'URL concernés (montage réel de `routes/index.js`). */
export const MODULE_PREFIXES = [
  { module: 'market', prefixes: ['/listings', '/purchase-requests', '/market', '/orders', '/inventory', '/reviews'] },
  { module: 'transport', prefixes: ['/transport'] },
  { module: 'investissement', prefixes: ['/projects', '/dataroom', '/funding', '/investors', '/invest', '/tenders'] },
  { module: 'iot', prefixes: ['/iot'] },
  { module: 'satellite', prefixes: ['/satellite'] },
  { module: 'sms', prefixes: ['/sms'] },
  { module: 'ia', prefixes: ['/ai'] },
];

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const EXEMPT_PREFIXES = ['/auth', '/admin', '/webhooks', '/health'];

const WATCHED_KEYS = [
  'platform.maintenance',
  ...MODULE_PREFIXES.map(({ module }) => `modules.${module}`),
];

let cache = null;
let cacheAt = 0;
const TTL_MS = 15_000;

/** À appeler après toute écriture de `settings` (service M3). */
export const invalidateSettingsCache = () => {
  cache = null;
};

const loadFlags = async () => {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;
  const rows = await prisma.setting.findMany({ where: { key: { in: WATCHED_KEYS } } });
  cache = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  cacheAt = Date.now();
  return cache;
};

const normalizePath = (req) => {
  const brut = (req.originalUrl ?? req.url ?? '/').split('?')[0];
  if (brut.startsWith(env.apiPrefix)) {
    return brut.slice(env.apiPrefix.length) || '/';
  }
  return req.path || '/';
};

const matchModule = (path) => {
  for (const { module, prefixes } of MODULE_PREFIXES) {
    for (const prefix of prefixes) {
      if (path === prefix || path.startsWith(`${prefix}/`)) return module;
    }
  }
  return null;
};

export const settingsEffects = async (req, _res, next) => {
  try {
    const path = normalizePath(req);
    const flags = await loadFlags();

    // 1. Module désactivé (AC-M3) — toutes méthodes, lecture comprise.
    const module = matchModule(path);
    if (module && flags[`modules.${module}`] === false) {
      return next(
        ApiError.forbidden(`Module « ${module} » désactivé par l'administration`, {
          code: 'module_disabled',
          module,
        }),
      );
    }

    // 2. Mode maintenance (RG-M3-4) — mutations métier refusées hors admin.
    const exempt = EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
    if (
      flags['platform.maintenance'] === true &&
      MUTATION_METHODS.has(req.method) &&
      !exempt
    ) {
      return next(
        ApiError.forbidden('Plateforme en maintenance : opération temporairement refusée', {
          code: 'maintenance_mode',
        }),
      );
    }

    return next();
  } catch {
    // Défaillant-libre : une erreur de lecture des paramètres ne bloque pas
    // la plateforme (les effets reviennent dès que la lecture redevient
    // possible — cache invalidé à chaque écriture).
    return next();
  }
};
