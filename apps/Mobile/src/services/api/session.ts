import { STORAGE_KEYS, secureStorage } from '@/lib/secure-storage';

import type { PublicUser, Session } from './types';

/**
 * Détenteur unique de la session : le client HTTP lit les jetons ici et
 * l'écran de connexion les écrit ici. Isoler ce module évite toute importation
 * circulaire entre `http.ts` et le store Zustand.
 *
 * Le refresh est rotatif (AUTH-05) : chaque rafraîchissement remplace les deux
 * jetons. Un seul refresh à la fois — les 401 simultanés attendent la même
 * promesse (`pendingRefresh`).
 */

let accessToken: string | null = null;
let refreshToken: string | null = null;
let expiresAt: number | null = null;
let pendingRefresh: Promise<string | null> | null = null;
let refreshHandler: ((token: string) => Promise<Session | null>) | null = null;

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
    void secureStorage.set(STORAGE_KEYS.accessToken, session.accessToken);
    if (session.refreshToken) void secureStorage.set(STORAGE_KEYS.refreshToken, session.refreshToken);
  },

  async restore(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
    const [storedAccess, storedRefresh] = await Promise.all([
      secureStorage.get(STORAGE_KEYS.accessToken),
      secureStorage.get(STORAGE_KEYS.refreshToken),
    ]);
    accessToken = storedAccess;
    refreshToken = storedRefresh;
    expiresAt = storedAccess ? null : null; // inconnu jusqu'au premier refresh
    return { accessToken: storedAccess, refreshToken: storedRefresh };
  },

  async clear(): Promise<void> {
    accessToken = null;
    refreshToken = null;
    expiresAt = null;
    pendingRefresh = null;
    await Promise.all([
      secureStorage.remove(STORAGE_KEYS.accessToken),
      secureStorage.remove(STORAGE_KEYS.refreshToken),
    ]);
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
    await secureStorage.set(STORAGE_KEYS.profile, JSON.stringify(user));
  },
  async load(): Promise<PublicUser | null> {
    const raw = await secureStorage.get(STORAGE_KEYS.profile);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PublicUser;
    } catch {
      return null;
    }
  },
  async clear(): Promise<void> {
    await secureStorage.remove(STORAGE_KEYS.profile);
  },
};
