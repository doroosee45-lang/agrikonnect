import type { PublicUser, Session } from './types';

/**
 * Détenteur unique de la session.
 *
 * - les jetons vivent en mémoire + `sessionStorage` : jamais dans le state
 *   Zustand, donc jamais sérialisés dans un log ou un snapshot React ;
 * - le refresh est rotatif (AUTH-05) : chaque rafraîchissement remplace les
 *   deux jetons. Un seul refresh à la fois — les 401 simultanés attendent la
 *   même promesse (`pendingRefresh`).
 */

const ACCESS_KEY = 'agrikonnect.accessToken';
const REFRESH_KEY = 'agrikonnect.refreshToken';
const PROFILE_KEY = 'agrikonnect.profile';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let expiresAt: number | null = null;
let pendingRefresh: Promise<string | null> | null = null;
let refreshHandler: ((token: string) => Promise<Session | null>) | null = null;

function readStorage(key: string): string | null {
  try {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
    localStorage.setItem(key, value);
  } catch {
    // quota dépassé ou stockage désactivé : la session reste en mémoire
  }
}

function removeStorage(key: string): void {
  try {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const sessionStore = {
  get accessToken() {
    return accessToken;
  },
  get refreshToken() {
    return refreshToken;
  },
  get expiresAt() {
    return expiresAt;
  },

  /** Jeton encore valable avec une marge de 30 s (l'accès dure ≤ 15 min côté serveur). */
  isFresh(): boolean {
    if (!accessToken || !expiresAt) return false;
    return Date.now() < expiresAt - 30_000;
  },

  set(session: Session): void {
    accessToken = session.accessToken;
    refreshToken = session.refreshToken;
    expiresAt = Date.now() + Number(session.expiresIn ?? 900) * 1000;
    writeStorage(ACCESS_KEY, session.accessToken);
    if (session.refreshToken) writeStorage(REFRESH_KEY, session.refreshToken);
  },

  async restore(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
    const storedAccess = readStorage(ACCESS_KEY);
    const storedRefresh = readStorage(REFRESH_KEY);
    accessToken = storedAccess;
    refreshToken = storedRefresh;
    expiresAt = null; // inconnu jusqu'au premier refresh
    return { accessToken: storedAccess, refreshToken: storedRefresh };
  },

  async clear(): Promise<void> {
    accessToken = null;
    refreshToken = null;
    expiresAt = null;
    pendingRefresh = null;
    removeStorage(ACCESS_KEY);
    removeStorage(REFRESH_KEY);
  },

  /** Enregistré par le store d'authentification : appelé au premier 401. */
  setRefreshHandler(handler: ((token: string) => Promise<Session | null>) | null): void {
    refreshHandler = handler;
  },

  /** Un seul refresh en vol ; les autres appelants réutilisent la même promesse. */
  async refresh(): Promise<string | null> {
    if (pendingRefresh) return pendingRefresh;
    if (!refreshToken || !refreshHandler) return null;

    const token = refreshToken;
    pendingRefresh = (async () => {
      try {
        const next = await refreshHandler?.(token);
        if (!next) {
          await sessionStore.clear();
          return null;
        }
        sessionStore.set(next);
        return next.accessToken;
      } catch {
        await sessionStore.clear();
        return null;
      } finally {
        pendingRefresh = null;
      }
    })();

    return pendingRefresh;
  },
};

export const profileStorage = {
  async save(user: PublicUser): Promise<void> {
    try {
      const raw = JSON.stringify(user);
      sessionStorage.setItem(PROFILE_KEY, raw);
      localStorage.setItem(PROFILE_KEY, raw);
    } catch {
      // ignore
    }
  },
  async load(): Promise<PublicUser | null> {
    const raw = readStorage(PROFILE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PublicUser;
    } catch {
      return null;
    }
  },
  async clear(): Promise<void> {
    removeStorage(PROFILE_KEY);
  },
};
