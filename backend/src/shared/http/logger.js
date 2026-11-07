/**
 * Exigences CDC couvertes : SEC-11, NFR-05.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { env } from '../../config/env.js';

/**
 * Journalisation applicative.
 *
 * SEC-11 — aucune donnée sensible dans les journaux : les clés susceptibles de
 * porter un secret (mot de passe, jeton, clé d'API, en-tête d'autorisation,
 * secret TOTP) sont remplacées avant écriture, y compris lorsqu'elles
 * apparaissent dans un objet imbriqué.
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[env.LOG_LEVEL] ?? LEVELS.info;

const SENSITIVE_KEYS = [
  'password',
  'newpassword',
  'currentpassword',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'tokenhash',
  'authorization',
  'apikey',
  'keyhash',
  'secret',
  'secrethash',
  'mfaencryptionkey',
  'otp',
  'code',
  'backupcodes',
];

const REDACTED = '[redacted]';

const isSensitive = (key) => SENSITIVE_KEYS.includes(String(key).toLowerCase().replace(/[_-]/g, ''));

/** Remplace récursivement toute valeur dont la clé est sensible. */
export const redact = (value, depth = 0) => {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, code: value.code ?? null, stack: value.stack };
  }
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, isSensitive(key) ? REDACTED : redact(item, depth + 1)]),
  );
};

const stamp = () => new Date().toISOString();

const log = (level, ...args) => {
  if (LEVELS[level] < currentLevel) return;
  const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  consoleFn(`[${stamp()}] [${level.toUpperCase()}]`, ...args.map((arg) => redact(arg)));
};

export const logger = {
  debug: (...a) => log('debug', ...a),
  info: (...a) => log('info', ...a),
  warn: (...a) => log('warn', ...a),
  error: (...a) => log('error', ...a),
};
