import { Platform } from 'react-native';
import Constants from 'expo-constants';

type Extra = Record<string, string | undefined>;

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/**
 * Ordre de priorité : variable d'environnement EXPO_PUBLIC_* (build CI),
 * puis `extra` d'app.json, puis repli local. Jamais de valeur codée en dur
 * ailleurs dans l'application : tout passe par ce module.
 */
function pick(envValue: string | undefined, extraKey: string, fallback: string): string {
  return envValue?.trim() || extra[extraKey]?.trim() || fallback;
}

export const API_BASE_URL = pick(
  process.env.EXPO_PUBLIC_API_BASE_URL,
  'apiBaseUrl',
  'http://localhost:4000/api/v1',
);

export const REALTIME_URL = pick(
  process.env.EXPO_PUBLIC_REALTIME_URL,
  'realtimeUrl',
  API_BASE_URL.replace(/\/api\/v1\/?$/, ''),
);

export const IS_WEB = Platform.OS === 'web';
export const IS_IOS = Platform.OS === 'ios';
export const IS_ANDROID = Platform.OS === 'android';

export const APP = {
  name: 'AGRIKONNECT AFRICA',
  version: Constants.expoConfig?.version ?? '1.0.0',
  scheme: Constants.expoConfig?.scheme ?? 'agrikonnect',
  slug: Constants.expoConfig?.slug ?? 'agrikonnect-africa',
} as const;

/** Les médias arrivent en URL signées (300 s) ; les chemins relatifs sont rebasés ici. */
export function resolveMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  const origin = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** Délais réseau alignés sur le contrat backend (geoai 20 s, reste 15 s). */
export const TIMEOUTS = {
  request: 15_000,
  geospatial: 20_000,
  upload: 60_000,
} as const;
