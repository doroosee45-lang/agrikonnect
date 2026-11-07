import { create } from 'zustand';

import { authApi } from '@/services/endpoints';
import { setSessionLostHandler } from '@/services/http';
import { profileStorage, sessionStore } from '@/services/session';
import type { LoginPayload, MeResult, PublicUser, RegisterPayload, Session } from '@/services/types';

/**
 * Session applicative.
 *
 * - les jetons vivent dans `sessionStore` (SecureStore) : jamais dans le state
 *   Zustand, donc jamais sérialisés dans un log ou un snapshot React ;
 * - le handler de refresh est branché ici : le client HTTP appelle
 *   `authApi.refresh` au premier 401 et rejoue la requête ;
 * - `status` pilote les écrans : `booting` → splash, `authenticated` → espace
 *   métier, `anonymous` → site public avec appels à l'action.
 */

export type AuthStatus = 'booting' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  user: PublicUser | null;
  permissions: string[];
  /** Identifiants conservés le temps de saisir le second facteur (NFR-01). */
  pendingMfa: LoginPayload | null;
  /** true tant qu'un login/register est en cours (bouton en état chargé). */
  busy: boolean;
  /** PROF-01 — complétude du profil, affichée dans l'espace producteur. */
  completeness: MeResult['completeness'] | null;

  init: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearPendingMfa: () => void;
  can: (permission: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
}

async function applySession(session: Session, user: PublicUser, permissions: string[] = []) {
  sessionStore.set(session);
  await profileStorage.save(user);
  return { user, permissions };
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Le refresh rotatif est branché dès la création du store.
  sessionStore.setRefreshHandler(async (refreshToken) => {
    const { data } = await authApi.refresh(refreshToken);
    return data.session;
  });

  setSessionLostHandler(() => {
    void profileStorage.clear();
    set({ status: 'anonymous', user: null, permissions: [], pendingMfa: null });
  });

  return {
    status: 'booting',
    user: null,
    permissions: [],
    pendingMfa: null,
    busy: false,
    completeness: null,

    async init() {
      const { accessToken, refreshToken } = await sessionStore.restore();
      if (!accessToken && !refreshToken) {
        set({ status: 'anonymous' });
        return;
      }

      // Jeton présent mais peut-être expiré : on tente /me, le 401 déclenche le refresh.
      try {
        const { data } = await authApi.me();
        await profileStorage.save(data.user);
        let permissions: string[] = [];
        try {
          permissions = (await authApi.permissions()).data.permissions ?? [];
        } catch {
          permissions = [];
        }
        set({ status: 'authenticated', user: data.user, permissions, completeness: data.completeness });
      } catch {
        // Repli : profil mis en cache pour afficher l'identité sans réseau.
        const cached = await profileStorage.load();
        if (cached) {
          set({ status: 'authenticated', user: cached, permissions: [] });
          return;
        }
        await sessionStore.clear();
        set({ status: 'anonymous', user: null, permissions: [] });
      }
    },

    async login(payload) {
      set({ busy: true, pendingMfa: null });
      try {
        const { data } = await authApi.login(payload);
        const applied = await applySession(data.session, data.user);
        let permissions: string[] = [];
        try {
          permissions = (await authApi.permissions()).data.permissions ?? [];
        } catch {
          permissions = [];
        }
        set({ status: 'authenticated', user: applied.user, permissions });
      } catch (error) {
        /*
         * Second facteur exigé : on garde les identifiants pour rejouer la
         * connexion avec le code.
         *
         * `mfaRequired` est une **propriété** de `RequestError`, calculée dans
         * son constructeur à partir de `body.details.mfaRequired`. La variable
         * s'appelait `details` alors qu'elle contient le booléen : ce nom a
         * contribué à masquer le défaut backend, où `details` n'arrivait jamais
         * (fabrique `ApiError.unauthorized` qui ignorait son second argument).
         */
        const secondFacteurRequis = (error as { mfaRequired?: boolean }).mfaRequired === true;
        if (secondFacteurRequis) set({ pendingMfa: payload });
        throw error;
      } finally {
        set({ busy: false });
      }
    },

    async register(payload) {
      set({ busy: true });
      try {
        const { data } = await authApi.register(payload);
        // Inscription par téléphone : pas de session immédiate (AUTH-01).
        if (!data.session) {
          set({ status: 'anonymous' });
          return;
        }
        const applied = await applySession(data.session, data.user);
        set({ status: 'authenticated', user: applied.user, permissions: [] });
      } finally {
        set({ busy: false });
      }
    },

    async logout() {
      try {
        await authApi.logout();
      } catch {
        // La déconnexion locale prime : le serveur révoquera le jeton à expiration.
      }
      await sessionStore.clear();
      await profileStorage.clear();
      set({ status: 'anonymous', user: null, permissions: [], pendingMfa: null });
    },

    async refreshProfile() {
      try {
        const { data } = await authApi.me();
        await profileStorage.save(data.user);
        set({ user: data.user, completeness: data.completeness });
      } catch {
        /* l'ancien profil reste affiché */
      }
    },

    clearPendingMfa() {
      set({ pendingMfa: null });
    },

    can(permission) {
      const list = get().permissions;
      return list.includes(permission) || list.includes('*');
    },

    hasAnyRole(roles) {
      const user = get().user;
      if (!user) return false;
      return user.organizations.some((org) => (org.roles ?? []).some((role) => roles.includes(role)));
    },
  };
});

/** Sélecteurs stables (évite les re-rendus sur tout le store). */
export const selectUser = (state: AuthState) => state.user;
export const selectStatus = (state: AuthState) => state.status;
export const selectIsAuthenticated = (state: AuthState) => state.status === 'authenticated';
