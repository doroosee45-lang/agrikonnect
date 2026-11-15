import { SUPPORTED_LOCALES, useI18n } from '@/i18n';

/**
 * Sélecteur de langue compact (FR | EN).
 *
 * I18N-05 — la langue n'était modifiable que dans le pied de page public et dans
 * les paramètres du producteur : un utilisateur connecté d'un autre espace ne
 * pouvait pas en changer. Ce composant est posé dans la barre de chaque espace.
 * Le choix est conservé (stockage local) et reporté sur le profil serveur
 * (`useLocaleSync`).
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { t, locale, setLocale } = useI18n();
  return (
    <div
      role="group"
      aria-label={t('common.language')}
      className={`flex h-[34px] items-center rounded-[9px] border border-bordure bg-surface p-0.5 shadow-2xs ${className}`}
    >
      {SUPPORTED_LOCALES.map((option) => {
        const active = locale === option.code;
        return (
          <button
            key={option.code}
            type="button"
            lang={option.code}
            title={option.native}
            aria-label={option.native}
            aria-pressed={active}
            onClick={() => setLocale(option.code)}
            className={`h-full rounded-[7px] px-2 text-[11px] font-bold transition-colors ${
              active ? 'bg-marque text-white' : 'text-texte-doux hover:text-texte'
            }`}
          >
            {option.code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
