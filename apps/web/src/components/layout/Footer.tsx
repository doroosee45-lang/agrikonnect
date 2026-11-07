import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useI18n } from '@/i18n';
import { APP } from '@/lib/config';
import { publicApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';

const FOOTER_COLUMNS = [
  {
    title: 'Plateforme',
    links: [
      { label: 'Services', href: '/services' },
      { label: 'Marchés', href: '/market' },
      { label: 'Appels d’offres', href: '/public/tenders' },
      { label: 'Projets', href: '/public/projects' },
      { label: 'Carte agricole', href: '/public/map' },
    ],
  },
  {
    title: 'Données',
    links: [
      { label: 'Prix agricoles', href: '/prices' },
      { label: 'Météo', href: '/weather' },
      { label: 'Catalogue de données', href: '/public/data' },
      { label: 'Traçabilité d’un lot', href: '/public/lots/demo' },
      { label: 'Agriculture par pays', href: '/public/agriculture/CD' },
    ],
  },
  {
    title: 'Réseau',
    links: [
      { label: '\u00c0 propos', href: '/a-propos' },
      { label: 'Producteurs', href: '/public/farmers' },
      { label: 'Coopératives', href: '/public/cooperatives' },
      { label: 'Choisir un pays et une langue', href: '/public/country-language' },
      { label: 'Informations légales', href: '/public/legal' },
      { label: 'Pays et cultures', href: '/public/agriculture/CD' },
    ],
  },
  {
    title: 'Espaces',
    links: [
      { label: 'Espace producteur', href: '/farmer' },
      { label: 'Connexion', href: '/auth/login' },
      { label: 'Créer un compte', href: '/auth/register' },
      { label: 'API développeurs', href: '/developers' },
      { label: 'Mon profil', href: '/app/profile' },
    ],
  },
];

export function Footer() {
  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const health = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => publicApi.health().then((response) => response.data),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const apiState = health.isLoading ? 'checking' : health.isError || health.data?.status !== 'ok' ? 'down' : 'up';
  const apiLabel = apiState === 'up'
    ? `${locale === 'fr' ? 'API opérationnelle' : 'API operational'} · v${health.data?.version ?? '?'}`
    : apiState === 'down'
      ? (locale === 'fr' ? 'API injoignable' : 'API unavailable')
      : (locale === 'fr' ? 'Vérification…' : 'Checking…');

  function submitNewsletter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!emailIsValid) return;
    navigate(`/auth/register?email=${encodeURIComponent(email.trim())}`);
  }

  return (
    <footer className="site-footer" aria-label="Pied de page AGRIKONNECT">
      <div className="site-footer-gold-line" />
      <div className="site-footer-content">
        <div className="site-footer-top">
          <div className="site-footer-brand">
            <Link to="/" className="site-footer-wordmark" aria-label="AGRIKONNECT AFRICA, accueil">
              <svg className="site-footer-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <circle cx="20" cy="20" r="19" fill="var(--vert-800)" stroke="rgba(250,246,236,.22)" />
                <path d="M20 30c0-6.5 3.6-11.4 9.5-13.2C28.6 24.2 25 29.2 20 30Z" fill="var(--vert-500)" />
                <path d="M20 30c0-6.5-3.6-11.4-9.5-13.2C11.4 24.2 15 29.2 20 30Z" fill="var(--terre-400)" />
                <path d="M20 30V13.5" stroke="var(--creme-100)" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <span>
                <strong>AGRIKONNECT</strong>
                <small>AFRICA</small>
              </span>
            </Link>
            <p>{t('home.footerNote')}</p>
            <div className="site-footer-api" role="status" aria-live="polite">
              <span className={`site-footer-api-dot is-${apiState}`} aria-hidden="true" />
              <span>{apiLabel}</span>
            </div>
          </div>

          <div className="site-footer-columns">
            {FOOTER_COLUMNS.map((column) => (
              <nav key={column.title} className="site-footer-column" aria-label={column.title}>
                <h2>{column.title}</h2>
                {column.links.map((item) => (
                  <Link key={item.label} className="site-footer-link" to={item.href}>{item.label}</Link>
                ))}
              </nav>
            ))}
          </div>
        </div>

        <div className="site-footer-divider" />

        <section className="site-footer-newsletter" aria-labelledby="site-footer-newsletter-title">
          <div className="site-footer-newsletter-copy">
            <h2 id="site-footer-newsletter-title">{t('home.newsletterTitle')}</h2>
            <p>{locale === 'fr'
              ? 'Les relevés de prix sont réservés aux comptes vérifiés : chaque prix publié porte sa source et sa date.'
              : 'Price reports are available to verified accounts. Every published price includes its source and date.'}</p>
          </div>
          <form className="site-footer-newsletter-form" onSubmit={submitNewsletter} noValidate>
            <label className="sr-only" htmlFor="footer-newsletter-email">{locale === 'fr' ? 'Adresse e-mail' : 'Email address'}</label>
            <input
              id="footer-newsletter-email"
              type="email"
              value={email}
              onChange={(event) => { setEmail(event.target.value); setTouched(false); }}
              onBlur={() => setTouched(true)}
              placeholder={t('home.newsletterPlaceholder')}
              autoComplete="email"
              aria-invalid={touched && !emailIsValid}
              aria-describedby={touched && !emailIsValid ? 'footer-newsletter-error' : undefined}
            />
            <button type="submit">
              {t('home.newsletterCta')} <span aria-hidden="true">→</span>
            </button>
            {touched && !emailIsValid ? (
              <span id="footer-newsletter-error" className="site-footer-newsletter-error" role="alert">
                {t('home.newsletterError')}
              </span>
            ) : null}
          </form>
        </section>

        <div className="site-footer-divider" />

        <div className="site-footer-bottom">
          <span>© {new Date().getFullYear()} {APP.name} · {APP.version}</span>
          <nav className="site-footer-legal" aria-label={locale === 'fr' ? 'Liens légaux' : 'Legal links'}>
            <Link className="site-footer-link" to="/public/legal">{t('home.footerLegal')}</Link>
            <Link className="site-footer-link" to="/public/legal">{t('home.footerPrivacy')}</Link>
            <Link className="site-footer-link" to="/public/legal">{t('home.footerTerms')}</Link>
          </nav>
          <div className="site-footer-languages" aria-label={locale === 'fr' ? 'Langue' : 'Language'}>
            {(['fr', 'en'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                aria-pressed={locale === code}
                className={locale === code ? 'is-active' : ''}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
