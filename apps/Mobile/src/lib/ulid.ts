/**
 * ULID client : les entités créées hors ligne (relevés de parcelle, brouillons
 * d'annonce) portent un identifiant stable et triable, réconcilié ensuite par
 * l'API. Triable par construction (48 bits de temps + 80 bits d'aléa).
 */
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford, sans I L O U

function encodeTime(time: number, length: number): string {
  let mod: number;
  let str = '';
  for (let i = length - 1; i >= 0; i -= 1) {
    mod = time % 32;
    str = ENCODING.charAt(mod) + str;
    time = (time - mod) / 32;
  }
  return str;
}

function encodeRandom(length: number): string {
  let str = '';
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < length; i += 1) str += ENCODING.charAt(bytes[i] % 32);
  return str;
}

export function ulid(seedTime: number = Date.now()): string {
  return encodeTime(seedTime, 10) + encodeRandom(16);
}

/** Fabrique monotone : deux ULID générés dans la même milliseconde restent triables. */
export function createUlidFactory() {
  let lastTime = 0;
  let lastRandom = '';
  return (seedTime: number = Date.now()): string => {
    if (seedTime === lastTime) {
      lastRandom = encodeRandom(16);
      return encodeTime(seedTime, 10) + lastRandom;
    }
    lastTime = seedTime;
    lastRandom = encodeRandom(16);
    return encodeTime(seedTime, 10) + lastRandom;
  };
}

export const isUlid = (value: string): boolean => /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value);
