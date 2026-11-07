import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { IconeCloche } from '@/components/Icons';
import { Sidebar, useBreakpoint } from '@/design-system';
import { resolveEspace } from '@/lib/space-nav';
import { useAuthStore } from '@/store/auth';
import { Footer } from './Footer';
import { Header } from './Header';

type AdminNavPermission =
  | 'admin.dashboard'
  | 'admin.users'
  | 'admin.audit'
  | 'admin.settings'
  | 'admin.jobs';

const ADMIN_NAV_PERMISSIONS: Record<string, readonly AdminNavPermission[]> = {
  '/admin/dashboard': ['admin.dashboard'],
  '/admin/users': ['admin.users'],
  '/admin/audit': ['admin.audit'],
  '/admin/operations': ['admin.users'],
  '/admin/notifications': ['admin.users'],
  '/admin/settings': ['admin.settings'],
  '/admin/jobs': ['admin.jobs'],
  '/admin/monitoring': ['admin.jobs'],
};

interface AppLayoutProps {
  children: ReactNode;
}

/*
 * Coquille generale. Site public : Header + Footer INCHANGES. Espaces
 * metier (resolveEspace) : rail lateral 250/72 + drawer mobile (plan
 * valide Phase 3, kit 6.2/6.3). La barre d espace REPRODUIT les liens
 * d authentification du Header (notifications, profil, bascule site
 * public) : aucune fonctionnalite supprimee, aucun logout ajoute.
 * Le wrapper page-enter de la variante machine est PRESERVE (2 branches).
 */
export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const espace = resolveEspace(location.pathname);
  const can = useAuthStore((state) => state.can);
  const user = useAuthStore((state) => state.user);
  const isAuthentifie = useAuthStore((state) => state.status === 'authenticated');
  const isMd = useBreakpoint('md');
  const isLg = useBreakpoint('lg');
  const [drawerOuvert, setDrawerOuvert] = useState(false);
  const [railReplie, setRailReplie] = useState(false);

  const groupesEspace = espace?.id === 'admin'
    ? espace.groupes
        .map((groupe) => ({
          ...groupe,
          items: groupe.items.filter((item) => {
            const permissions = ADMIN_NAV_PERMISSIONS[item.to];
            return permissions !== undefined && permissions.every((permission) => can(permission));
          }),
        }))
        .filter((groupe) => groupe.items.length > 0)
    : espace?.groupes ?? [];

  useEffect(() => setDrawerOuvert(false), [location.pathname]);

  useEffect(() => {
    if (!drawerOuvert) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOuvert(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOuvert]);

  if (!espace) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <main style={{ flex: 1 }}><div key={location.pathname} className="page-enter">{children}</div></main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {isMd ? (
        <div className="sticky top-0 self-start">
          <Sidebar
            groupes={groupesEspace}
            actif={location.pathname}
            replie={!isLg || railReplie}
            onBasculerRepli={isLg ? () => setRailReplie((valeur) => !valeur) : undefined}
          />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-bordure bg-surface px-4 lg:h-[72px]">
          {!isMd ? (
            <button
              type="button"
              className="flex items-center justify-center rounded-lg border border-bordure bg-fond text-texte"
              style={{ width: 36, height: 36 }}
              aria-label="Ouvrir la navigation"
              aria-expanded={drawerOuvert}
              onClick={() => setDrawerOuvert(true)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                <path d="M4 7 H20" />
                <path d="M4 12 H20" />
                <path d="M4 17 H20" />
              </svg>
            </button>
          ) : null}
          <h1 className="text-texte" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{espace.titre}</h1>
          <div className="ml-auto flex items-center gap-3">
            {isAuthentifie ? (
              <>
                <Link to="/" className="text-marque" style={{ fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                  Visiter le site public
                </Link>
                <Link to="/app/notifications" aria-label="Notifications" className="text-texte-doux" style={{ fontSize: 13, textDecoration: 'none', display: 'flex' }}>
                  <IconeCloche />
                </Link>
                <Link to="/app/profile" className="text-marque" style={{ fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                  {user?.firstName ?? 'Profil'}
                </Link>
              </>
            ) : (
              <>
                <Link to="/auth/login" className="text-marque" style={{ fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
                  Connexion
                </Link>
                <Link
                  to="/auth/register"
                  className="bg-marque text-surface"
                  style={{ fontSize: 14, fontWeight: 600, padding: '8px 16px', borderRadius: 10, textDecoration: 'none' }}
                >
                  S'inscrire
                </Link>
              </>
            )}
          </div>
        </header>
        <main className="flex-1"><div key={location.pathname} className="page-enter">{children}</div></main>
        <Footer />
      </div>
      {!isMd && drawerOuvert ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            className="flex-1 border-0 bg-texte/40"
            aria-label="Fermer la navigation"
            onClick={() => setDrawerOuvert(false)}
          />
          <aside className="h-full w-[250px] max-w-[82vw] overflow-y-auto">
            <Sidebar
              groupes={groupesEspace}
              actif={location.pathname}
              replie={false}
              variante="drawer"
              onNaviguer={() => setDrawerOuvert(false)}
            />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
