import { useEffect, useRef } from 'react';

import { useI18nStore } from '@/i18n';
import { authApi } from '@/services/endpoints';
import { useAuthStore } from '@/store/auth';

/**
 * Synchronise la langue d'interface avec le profil serveur (`Profile.locale`).
 *
 * Le backend rédige les notifications et les e-mails dans la langue enregistrée
 * sur le profil du destinataire : sans cette synchronisation, un utilisateur qui
 * choisit l'anglais à l'écran recevrait encore ses notifications en français.
 *
 * Règle : le choix fait sur l'appareil prime. Une seule écriture par changement
 * (`PATCH /me { locale }`) ; un échec réseau n'interrompt rien et sera retenté
 * au prochain changement de session ou de langue.
 */
export function useLocaleSync(): void {
  const locale = useI18nStore((state) => state.locale);
  const hydrated = useI18nStore((state) => state.hydrated);
  const status = useAuthStore((state) => state.status);
  const profileLocale = useAuthStore((state) => state.user?.locale ?? null);
  const pending = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated || status !== 'authenticated') return;
    if (profileLocale === locale || pending.current === locale) return;
    pending.current = locale;
    authApi.updateMe({ locale }).catch(() => {
      pending.current = null;
    });
  }, [hydrated, status, locale, profileLocale]);
}
