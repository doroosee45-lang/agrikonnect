import { useCallback } from 'react';
import { create } from 'zustand';

import type { Locale } from '@/lib/format';
import { STORAGE_KEYS, secureStorage } from '@/lib/secure-storage';

import { en } from './en';
import { fr, type Dictionary } from './fr';

export { fr, en };
export type { Dictionary };

const DICTS: Record<Locale, Dictionary> = { fr, en };

type Paths<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}`;
    }[keyof T & string];

/** Clés i18n typées : `t('home.heroTitleLine1')` est vérifié à la compilation. */
export type TranslationKey = Paths<Dictionary>;

type Params = Record<string, string | number>;

function readPath(dict: unknown, segments: string[]): string | undefined {
  let node: unknown = dict;
  for (const segment of segments) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Traduit une clé. Repli systématique sur le français : une clé manquante en
 * anglais affiche du français plutôt que la clé brute.
 */
export function translate(locale: Locale, key: TranslationKey, params?: Params): string {
  const segments = (key as string).split('.');
  const raw = readPath(DICTS[locale], segments) ?? readPath(DICTS.fr, segments);
  if (raw === undefined) return key as string;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

interface I18nState {
  locale: Locale;
  hydrated: boolean;
  setLocale: (next: Locale) => void;
  hydrate: () => Promise<void>;
}

export const useI18nStore = create<I18nState>((set, get) => ({
  locale: 'fr',
  hydrated: false,

  setLocale(next) {
    if (get().locale === next) return;
    set({ locale: next });
    void secureStorage.set(STORAGE_KEYS.locale, next);
  },

  async hydrate() {
    if (get().hydrated) return;
    const stored = (await secureStorage.get(STORAGE_KEYS.locale)) as Locale | null;
    set({ locale: stored === 'en' || stored === 'fr' ? stored : 'fr', hydrated: true });
  },
}));

/** Hook principal : `const { t, locale } = useI18n();` */
export function useI18n() {
  const locale = useI18nStore((state) => state.locale);
  const setLocale = useI18nStore((state) => state.setLocale);
  const t = useCallback(
    (key: TranslationKey, params?: Params) => translate(locale, key, params),
    [locale],
  );
  return { t, locale, setLocale };
}

export const SUPPORTED_LOCALES: ReadonlyArray<{ code: Locale; label: string; native: string }> = [
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'en', label: 'English', native: 'English' },
];
