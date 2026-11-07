import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
  type Method,
} from 'axios';

import { API_BASE_URL, APP, IS_WEB, TIMEOUTS } from '@/lib/config';
import { ulid } from '@/lib/ulid';
import { useI18nStore } from '@/i18n';

import { sessionStore } from './session';
import { RequestError, type ApiEnvelope, type ApiMeta } from './types';

/**
 * Client HTTP unique de l'application.
 *
 * Contrat serveur (CDC §13.1) :
 * - succès : `{ success, message?, data, meta? }` — on ne remonte que `data`/`meta` ;
 * - erreur : `{ success:false, message, requestId, errors?, details? }` → `RequestError`.
 *
 * Deux comportements transverses sont gérés ici plutôt qu'à chaque appel :
 * 1. le 401 déclenche UN refresh rotatif puis rejoue la requête ;
 * 2. `idempotent: true` pose un `Idempotency-Key` (ULID) pour les POST sensibles.
 */

export type ExtraConfig = {
  /** Pose un `Idempotency-Key` généré côté client (POST sensibles). */
  idempotent?: boolean;
  /** Force un timeout différent (geoai 20 s, upload 60 s). */
  timeoutMs?: number;
  /** N'attache pas le jeton (endpoints publics). */
  anonymous?: boolean;
  /** Ne tente pas de refresh sur 401 (login, register). */
  skipAuthRefresh?: boolean;
};

type ClientRequestConfig = AxiosRequestConfig & ExtraConfig;
type InterceptedConfig = InternalAxiosRequestConfig & ExtraConfig & { _retried?: boolean };

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUTS.request,
  headers: { 'X-Client': `mobile/${APP.version}${IS_WEB ? '-web' : ''}` },
});

/** Callback posé par le store d'authentification : purge l'écran connecté. */
let onSessionLost: (() => void) | null = null;
export function setSessionLostHandler(handler: (() => void) | null) {
  onSessionLost = handler;
}

http.interceptors.request.use((raw) => {
  const config = raw as InterceptedConfig;
  if (config.timeoutMs) config.timeout = config.timeoutMs;

  if (!config.anonymous) {
    const token = sessionStore.accessToken;
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
  }

  const locale = useI18nStore.getState().locale;
  config.headers.set('Accept-Language', locale);

  if (config.idempotent && !config.headers.get('Idempotency-Key')) {
    config.headers.set('Idempotency-Key', ulid());
  }

  return config;
});

/** Transforme n'importe quelle erreur axios en `RequestError` typée. */
function toRequestError(error: AxiosError): RequestError {
  const response = error.response;
  if (!response) {
    // Timeout, DNS coupé, mode avion : statut 0 = famille `network`.
    return new RequestError(0, error.message || 'Réseau indisponible');
  }
  const body = (response.data ?? {}) as Record<string, unknown>;
  return new RequestError(response.status, String(body.message ?? error.message), {
    errors: body.errors as never,
    details: body.details as never,
    requestId: (body.requestId as string) ?? null,
  });
}

/** Rejoue une requête après refresh, en conservant méthode, corps et options. */
async function replay(config: InterceptedConfig): Promise<unknown> {
  const headers = { ...(config.headers as object) } as Record<string, unknown>;
  const token = sessionStore.accessToken;
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await axios.request({
    ...config,
    headers: headers as InternalAxiosRequestConfig['headers'],
    baseURL: config.baseURL,
    transformRequest: undefined,
    transformResponse: undefined,
  });
  return response.data;
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as InterceptedConfig | undefined;
    const status = error.response?.status;

    if (status === 401 && config && !config._retried && !config.skipAuthRefresh && !config.anonymous) {
      config._retried = true;
      const token = await sessionStore.refresh();
      if (token) return replay(config);
      onSessionLost?.();
    }

    throw toRequestError(error);
  },
);

export interface RequestResult<T> {
  data: T;
  meta?: ApiMeta;
  message?: string;
}

async function request<T>(method: Method, url: string, options?: ClientRequestConfig): Promise<RequestResult<T>> {
  const response = await http.request<ApiEnvelope<T>>({
    ...options,
    url,
    method,
  });
  const body = response.data;
  return { data: body.data, meta: body.meta, message: body.message };
}

export const api = {
  get: <T>(url: string, options?: ClientRequestConfig) => request<T>('GET', url, options),
  post: <T>(url: string, body?: unknown, options?: ClientRequestConfig) =>
    request<T>('POST', url, { ...options, data: body }),
  patch: <T>(url: string, body?: unknown, options?: ClientRequestConfig) =>
    request<T>('PATCH', url, { ...options, data: body }),
  put: <T>(url: string, body?: unknown, options?: ClientRequestConfig) =>
    request<T>('PUT', url, { ...options, data: body }),
  delete: <T>(url: string, options?: ClientRequestConfig) =>
    request<T>('DELETE', url, options),
};

/** Retire les clés vides d'un objet de query (axios les sérialiserait en "undefined"). */
export function cleanQuery<T extends object>(query: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      out[key as keyof T] = value as T[keyof T];
    }
  }
  return out;
}
