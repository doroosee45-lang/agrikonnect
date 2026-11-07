import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Stockage clé/valeur chiffré sur mobile (Keystore / Keychain) pour les
 * jetons, et repli localStorage sur le web. Aucune donnée sensible n'est
 * écrite ailleurs.
 */
export const secureStorage = {
  async get(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return globalThis.localStorage?.getItem(key) ?? null;
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        globalThis.localStorage?.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch {
      /* stockage indisponible : l'application continue en mémoire */
    }
  },

  async remove(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        globalThis.localStorage?.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      /* idem */
    }
  },
};

export const STORAGE_KEYS = {
  accessToken: 'ak.access_token',
  refreshToken: 'ak.refresh_token',
  profile: 'ak.profile',
  locale: 'ak.locale',
  onboarding: 'ak.onboarding_seen',
} as const;
