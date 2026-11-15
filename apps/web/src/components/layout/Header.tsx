import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { IconeCarte, IconeCloche, IconeFeuille, IconeHorloge, IconePlant, IconeSonde } from '@/components/Icons';
import { COLORS, DURATION, EASE, LAYOUT } from '@/theme';
import { useAuthStore } from '@/store/auth';
import { getUserInitialRoute } from '@/lib/redirects';
import { useI18n, tr } from '@/i18n';

const NAV = [
  { get label() { return tr('ui.accueil'); }, href: '/' },
  { get label() { return tr('ui.aPropos'); }, href: '/a-propos' },
  { get label() { return tr('ui.services'); }, href: '/services' },
  { get label() { return tr('ui.marche'); }, href: '/market' },
  { get label() { return tr('ui.producteurs'); }, href: '/public/farmers' },
  { get label() { return tr('ui.investissement'); }, href: '/public/projects' },
  { get label() { return tr('ui.donnees'); }, href: '/insights' },
];

export function Header() {
  const { t } = useI18n();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const user = useAuthStore((state) => state.user);
  const permissions = useAuthStore((state) => state.permissions);

  /*
   * Navigation du cahier des charges : depuis l espace, "Visiter le site
   * public" ; depuis le site public, "Retour a mon espace" (destination
   * centrale calculee). La session n est jamais perdue : simple
   * navigation, aucun logout.
   */
  const PREFIXES_ESPACE = ['/admin', '/farmer', '/organization', '/market', '/app', '/reviewer', '/investment', '/developers'];
  const dansEspace = PREFIXES_ESPACE.some(
    (prefixe) => location.pathname === prefixe || location.pathname.startsWith(prefixe + '/'),
  );
  const destinationEspace = user
    ? getUserInitialRoute({ user, permissions }).route
    : '/app/profile';

  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <>
    <div className="site-topbar-shell">
      <div className="site-topbar">
        <div className="site-topbar-intro">
          <span className="site-topbar-kicker">{t('ui.conseilsAgricoles')}</span>
          <span className="site-topbar-title">{t('ui.duSolAuCalendrierDeSemis')}</span>
        </div>
        <nav className="site-topbar-links" aria-label={t('ui.accesRapidesAuxDonneesAgricoles')}>
          <Link to="/farmer/soil"><IconeSonde /><span>{t('ui.solSousSol')}</span></Link>
          <Link to="/public/agriculture/CD"><IconePlant /><span>{t('ui.culturesEnRdc')}</span></Link>
          <Link to="/farmer/plots"><IconeHorloge /><span>{t('ui.quandSemer')}</span></Link>
          <Link to="/public/map"><IconeCarte /><span>{t('ui.carteAgricole')}</span></Link>
        </nav>
      </div>
    </div>
    <header
      className="site-header"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: COLORS.pureWhite,
        borderBottom: `1px solid ${COLORS.lightBorder}`,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        className="site-header-inner"
        style={{
          maxWidth: 1440,
          margin: '0 auto',
          height: LAYOUT.headerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <Link to="/" className="site-brand" aria-label={t('ui.agrikonnectAfricaAccueil')}>
          <span className="site-brand-mark"><IconeFeuille /></span>
          <span className="site-brand-copy">
            <span className="site-brand-name">AGRIKONNECT</span>
            <span className="site-brand-tagline">{t('ui.rdcAfrica')}</span>
          </span>
        </Link>

        <nav className="site-nav" aria-label={t('ui.navigationPrincipale')}>
          {NAV.map((item) => {
            const targetPath = item.href.split('#')[0] || '/';
            const active = location.pathname === targetPath;
            return (
              <Link
                key={item.href}
                to={item.href}
                style={{
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  color: active ? COLORS.forestGreen : COLORS.slateGray,
                  textDecoration: 'none',
                  transition: `color ${DURATION.fast}ms`,
                  position: 'relative',
                }}
              >
                {item.label}
                {active ? (
                  <motion.div
                    layoutId="nav-underline"
                    style={{
                      position: 'absolute',
                      bottom: -4,
                      left: 0,
                      right: 0,
                      height: 2,
                      backgroundColor: COLORS.forestGreen,
                      borderRadius: 1,
                    }}
                    transition={{ duration: DURATION.base / 1000, ease: EASE.out }}
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="site-auth-actions" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {isAuthenticated ? (
            <>
              <Link
                to={dansEspace ? '/' : destinationEspace}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: COLORS.forestGreen,
                  textDecoration: 'none',
                }}
              >
                {dansEspace ? t('ui.visiterLeSitePublic') : t('ui.retourAMonEspace')}
              </Link>
              <Link
                to="/app/notifications"
                aria-label={t('ui.notifications')}
                style={{
                  fontSize: 13,
                  color: COLORS.slateGray,
                  textDecoration: 'none',
                }}
              >
                <IconeCloche />
              </Link>
              <Link
                to="/app/profile"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: COLORS.forestGreen,
                  textDecoration: 'none',
                }}
              >
                {user?.firstName ?? t('ui.profil')}
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/auth/login"
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: COLORS.forestGreen,
                  textDecoration: 'none',
                }}
              >{t('ui.connexion')}</Link>
              <Link
                to="/auth/register"
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: COLORS.pureWhite,
                  backgroundColor: COLORS.forestGreen,
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                }}
              >{t('ui.sInscrire')}</Link>
            </>
          )}
        </div>
        <button
          type="button"
          className="site-menu-toggle"
          aria-label={menuOpen ? t('ui.fermerLeMenu') : t('ui.ouvrirLeMenu')}
          aria-expanded={menuOpen}
          aria-controls="site-mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className={`site-menu-icon ${menuOpen ? 'is-open' : ''}`} aria-hidden="true">
            <i /><i /><i />
          </span>
        </button>
      </div>
      <div id="site-mobile-menu" className="site-mobile-menu" data-open={menuOpen}>
        <div>
          <nav aria-label={t('ui.navigationMobile')}>
            {NAV.map((item) => (
              <Link key={item.href} to={item.href} onClick={() => setMenuOpen(false)}>
                {item.label}
              </Link>
            ))}
            {isAuthenticated ? (
              <>
                <Link to={dansEspace ? '/' : destinationEspace} onClick={() => setMenuOpen(false)}>
                  {dansEspace ? t('ui.visiterLeSitePublic') : t('ui.retourAMonEspace')}
                </Link>
                <Link to="/app/profile" onClick={() => setMenuOpen(false)}>{user?.firstName ?? t('ui.monProfil')}</Link>
              </>
            ) : (
              <>
                <Link to="/auth/login" onClick={() => setMenuOpen(false)}>{t('ui.connexion')}</Link>
                <Link to="/auth/register" onClick={() => setMenuOpen(false)}>{t('ui.sInscrire_c08ce')}</Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
    </>
  );
}


