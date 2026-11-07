/**
 * Stockage sécurisé (web).
 *
 * Sur le web, `sessionStorage`/`localStorage` ne sont pas chiffrés : les jetons
 * y sont donc stockés uniquement pour la durée de l'onglet et jamais exposés
 * dans l'URL, les cookies ou les logs. Le backend impose des jetons courts
 * (≤ 15 min) avec refresh rotatif, ce qui limite la fenêtre d'exposition.
 */

export const STORAGE_KEYS = {
  accessToken: 'agrikonnect.accessToken',
  refreshToken: 'agrikonnect.refreshToken',
  profile: 'agrikonnect.profile',
  locale: 'agrikonnect.locale',
} as const;

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
    localStorage.setItem(key, value);
  } catch {
    // quota dépassé ou stockage désactivé
  }
}

function remove(key: string): void {
  try {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    return read(key);
  },
  async set(key: string, value: string): Promise<void> {
    write(key, value);
  },
  async remove(key: string): Promise<void> {
    remove(key);
  },
};
