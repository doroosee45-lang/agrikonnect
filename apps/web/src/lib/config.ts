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

export const REALTIME_URL = pick(
  import.meta.env.VITE_REALTIME_URL,
  'http://localhost:4000',
);

export const APP = {
  name: 'AGRIKONNECT AFRICA',
  shortName: 'AGRIKONNECT',
  tagline: 'Traçabilité agricole, marchés et investissement en Afrique',
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
