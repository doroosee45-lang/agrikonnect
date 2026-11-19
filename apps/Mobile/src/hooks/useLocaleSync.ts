import { useEffect, useRef } from 'react';

import { useI18nStore } from '@/i18n';
import { authApi } from '@/services/api/endpoints';
import { useAuthStore } from '@/store/auth';

/**
 * Synchronise la langue d'interface avec le profil serveur (`Profile.locale`).
 *
 * Le backend rédige les notifications et les e-mails dans la langue enregistrée
 * sur le profil du destinataire : sans cette synchronisation, un utilisateur qui
 * choisit l'anglais à l'écran recevrait encore ses notifications en français.
 *
 * Règle : au premier chargement d'une session, la langue serveur prime pour
 * garantir la continuité entre appareils. Les changements ultérieurs faits dans
 * l'application sont ensuite persistés (`PATCH /me { locale }`).
 *
 * Même règle que l'application web (apps/web/src/hooks/useLocaleSync.ts).
 */
export function useLocaleSync(): void {
  const locale = useI18nStore((state) => state.locale);
  const hydrated = useI18nStore((state) => state.hydrated);
  const setLocale = useI18nStore((state) => state.setLocale);
  const status = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const profileLocale = useAuthStore((state) => state.user?.locale ?? null);
  const pending = useRef<string | null>(null);
  const hydratedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated || status !== 'authenticated') return;
    if (userId && hydratedUserId.current !== userId) {
      hydratedUserId.current = userId;
      if (profileLocale === 'fr' || profileLocale === 'en') {
        setLocale(profileLocale);
        return;
      }
    }
    if (profileLocale === locale || pending.current === locale) return;
    pending.current = locale;
    authApi.updateMe({ locale }).catch(() => {
      pending.current = null;
    });
  }, [hydrated, status, userId, locale, profileLocale, setLocale]);
}
