import { env } from './env.js';

/**
 * Origines locales : localhost, 127.0.0.1, [::1] et adresses privées du réseau
 * local (192.168.x.x, 10.x.x.x, 172.16-31.x.x), en http ou https.
 */
const LOCAL_HOST = /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\]|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})$/;

const isLocalOrigin = (origin) => {
  try {
    const url = new URL(origin);
    return (url.protocol === 'http:' || url.protocol === 'https:') && LOCAL_HOST.test(url.hostname);
  } catch {
    return false;
  }
};

/**
 * Origine autorisée ?
 *
 * - Production : uniquement la liste `CORS_ORIGIN` (ou `*`).
 * - Développement : en plus, toute origine locale, QUEL QUE SOIT LE PORT.
 *   Vite passe à 5174, 5175… quand 5173 est occupé ; Expo web à 8082… : le
 *   site local doit continuer à joindre l'API sans retoucher `.env`.
 */
export const isOriginAllowed = (origin) => {
  if (!origin) return true; // Postman, server-to-server
  if (env.corsOrigins.includes('*') || env.corsOrigins.includes(origin)) return true;
  return env.isDev && isLocalOrigin(origin);
};
