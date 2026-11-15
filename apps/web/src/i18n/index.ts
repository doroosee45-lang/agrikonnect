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

/**
 * Paramètres d'interpolation. `null`/`undefined` s'affichent comme une chaîne
 * vide — même règle que React pour un enfant JSX nul.
 */
export type Params = Record<string, string | number | null | undefined>;

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
  return raw.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!(name in params)) return match;
    const value = params[name];
    return value === null || value === undefined ? '' : String(value);
  });
}

/**
 * Langue de l'appareil (navigateur ou système) à la première ouverture.
 * `navigator.language` sur le web ; `Intl` (Hermes) sur mobile. Toute langue
 * non prise en charge retombe sur le français, langue de référence.
 */
export function detectDeviceLocale(): Locale {
  const candidates: Array<string | undefined> = [];
  try {
    const nav = (globalThis as { navigator?: { language?: string; languages?: readonly string[] } }).navigator;
    candidates.push(...(nav?.languages ?? []), nav?.language);
  } catch {
    /* environnement sans navigator */
  }
  try {
    candidates.push(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    /* Intl indisponible */
  }
  for (const tag of candidates) {
    const base = tag?.toLowerCase().split(/[-_]/)[0];
    if (base === 'fr' || base === 'en') return base;
  }
  return 'fr';
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
    // Choix enregistré, sinon langue de l'appareil, sinon français.
    const locale = stored === 'en' || stored === 'fr' ? stored : detectDeviceLocale();
    set({ locale, hydrated: true });
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

/**
 * Traduction hors composant React : constantes de module (menus, catalogues),
 * utilitaires, classes. Lit la langue courante au moment de l'appel.
 *
 * Dans un composant, préférer `useI18n().t` : le composant se ré-affiche
 * alors au changement de langue. Les constantes de module utilisent des
 * accesseurs (`get label() { return tr('…'); }`) pour être évaluées à
 * l'affichage, jamais à l'import.
 */
export function tr(key: TranslationKey, params?: Params): string {
  return translate(useI18nStore.getState().locale, key, params);
}

/**
 * Attribut `lang` du document tenu à jour (WCAG 3.1.1) : lecteurs d'écran,
 * césure et correcteur suivent la langue réellement affichée. Sans effet hors
 * navigateur.
 */
function syncDocumentLang(locale: Locale) {
  const doc = (globalThis as { document?: { documentElement?: { lang: string } } }).document;
  if (doc?.documentElement) doc.documentElement.lang = locale;
}
syncDocumentLang(useI18nStore.getState().locale);
useI18nStore.subscribe((state) => syncDocumentLang(state.locale));
