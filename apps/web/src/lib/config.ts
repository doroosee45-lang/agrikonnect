import { tr } from '@/i18n';
/**
 * Configuration applicative.
 *
 * Priorité : variable d'environnement `VITE_*` (build CI), puis repli local.
 * Aucune valeur codée en dur ailleurs : tout passe par ce module.
 */

function pick(envValue: string | undefined, fallback: string): string {
  return envValue?.trim() || fallback;
}

export const API_BASE_URL = pick(
  import.meta.env.VITE_API_BASE_URL,
  'http://localhost:4000/api/v1',
);

/**
 * Serveur temps réel (Socket.IO, chemin `/realtime`) : par défaut l'ORIGINE de
 * l'API — sans `VITE_REALTIME_URL`, viser `localhost` en production casserait
 * la sonnerie des appels.
 */
function origineDe(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return 'http://localhost:4000';
  }
}

export const REALTIME_URL = pick(
  import.meta.env.VITE_REALTIME_URL,
  origineDe(API_BASE_URL),
);

export const APP = {
  name: 'AGRIKONNECT AFRICA',
  shortName: 'AGRIKONNECT',
  get tagline() { return tr('ui.tracabiliteAgricoleMarchesEtInvestissementEn'); },
  version: '1.0.0',
} as const;

export const IS_WEB = true;
export const IS_NATIVE = false;

export const TIMEOUTS = {
  request: 20_000,
  upload: 60_000,
  refresh: 10_000,
} as const;

export const REALTIME_PATH = '/realtime';
