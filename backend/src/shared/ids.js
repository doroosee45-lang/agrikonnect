/**
 * Génération d'identifiants.
 *
 * CDC P7 / SYNC : les entités synchronisables acceptent un identifiant
 * généré côté client (ULID). Le serveur doit donc accepter un id fourni
 * par le client, mais valider son format pour éviter les collisions
 * malveillantes ou les injections.
 */

const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** ULID : 26 caractères Crockford base32, triés lexicographiquement par date. */
export const isUlid = (value) =>
  typeof value === 'string' && /^[0-9A-HJKMNP-TV-Z]{26}$/i.test(value);

/** Vérifie qu'un id est utilisable comme identifiant applicatif (ULID ou cuid/uuid). */
export const isClientId = (value) =>
  typeof value === 'string' &&
  value.length >= 20 &&
  value.length <= 40 &&
  /^[A-Za-z0-9_-]+$/.test(value);

/** Génère un ULID côté serveur (utile pour les entités créées par l'API). */
export const ulid = () => {
  const time = Date.now();
  let timePart = '';
  let remaining = time;
  for (let i = 0; i < 10; i += 1) {
    timePart = ULID_ALPHABET[remaining % 32] + timePart;
    remaining = Math.floor(remaining / 32);
  }
  let randomPart = '';
  for (let i = 0; i < 16; i += 1) {
    randomPart += ULID_ALPHABET[Math.floor(Math.random() * 32)];
  }
  return timePart + randomPart;
};

/** Identifiant d'entité : on honore l'id client (offline) sinon on génère. */
export const resolveId = (providedId) => (providedId && isClientId(providedId) ? providedId : ulid());
