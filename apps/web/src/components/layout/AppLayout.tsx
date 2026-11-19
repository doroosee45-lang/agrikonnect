import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { IconeCloche } from '@/components/Icons';
import { Sidebar, useBreakpoint } from '@/design-system';
import { cn } from '@/design-system/lib/utils';
import type { SidebarGroup, SidebarItem, SidebarStatusCard } from '@/design-system';
import { getActiveOrganizationId, setActiveOrganizationId } from '@/lib/redirects';
import { resolveEspace } from '@/lib/space-nav';
import { useAuthStore } from '@/store/auth';
import { Footer } from './Footer';
import { Header } from './Header';
import { useI18n } from '@/i18n';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { bcpLocale } from '@/lib/format';

type AdminNavPermission =
  | 'admin.dashboard'
  | 'admin.users'
  | 'admin.audit'
  | 'admin.settings'
  | 'admin.jobs';

const ADMIN_NAV_PERMISSIONS: Record<string, readonly AdminNavPermission[]> = {
  '/admin': ['admin.dashboard'],
  '/admin/dashboard': ['admin.dashboard'],
  '/admin/users': ['admin.users'],
  '/admin/roles': ['admin.users'],
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

const LARGEUR_PANNEAU = 272;
const LARGEUR_TIROIR = 300;
const ID_NAVIGATION = 'ak-navigation';
const ID_NAVIGATION_MOBILE = 'ak-navigation-mobile';
const CLE_PREFERENCE_PANNEAU = 'ak.navigation.ouverte';

/** Préférence d'affichage du panneau sur ordinateur (masqué par défaut). */
function lirePreferencePanneau(): boolean {
  try {
    return window.localStorage.getItem(CLE_PREFERENCE_PANNEAU) === '1';
  } catch {
    return false;
  }
}

function ecrirePreferencePanneau(ouvert: boolean): void {
  try {
    window.localStorage.setItem(CLE_PREFERENCE_PANNEAU, ouvert ? '1' : '0');
  } catch {
    // Stockage indisponible (navigation privée…) : le choix vaut pour la session.
  }
}

/** Trois traits qui se changent en croix à l'ouverture. */
function IconeHamburger({ ouvert }: { ouvert: boolean }) {
  const trait = 'absolute left-0 h-[1.8px] w-full rounded-full bg-current transition-all duration-300 ease-out motion-reduce:transition-none';
  return (
    <span className="relative block h-[14px] w-[18px]" aria-hidden="true">
      <span className={cn(trait, ouvert ? 'top-[6px] rotate-45' : 'top-0')} />
      <span className={cn(trait, 'top-[6px]', ouvert ? 'opacity-0' : 'opacity-100')} />
      <span className={cn(trait, ouvert ? 'top-[6px] -rotate-45' : 'top-[12px]')} />
    </span>
  );
}

function filtrerItemsAdmin(
  items: SidebarItem[],
  can: (permission: string) => boolean,
): SidebarItem[] {
  const out: SidebarItem[] = [];
  for (const item of items) {
    const reqPerms = ADMIN_NAV_PERMISSIONS[item.to] ?? ['admin.users'];
    const parentOk = reqPerms.every((p) => can(p));
    const enfantsFiltres = item.children
      ? filtrerItemsAdmin(item.children, can)
      : undefined;

    if (parentOk || (enfantsFiltres && enfantsFiltres.length > 0)) {
      out.push({
        ...item,
        to: parentOk ? item.to : enfantsFiltres![0].to,
        children: enfantsFiltres && enfantsFiltres.length > 0 ? enfantsFiltres : undefined,
      });
    }
  }
  return out;
}

function trouverLibelleActif(groupes: SidebarGroup[], pathname: string): string | null {
  let meilleur: { to: string; label: string } | null = null;
  for (const g of groupes) {
    for (const item of g.items) {
      const candidats = [item, ...(item.children ?? [])];
      for (const c of candidats) {
        if (pathname === c.to || pathname.startsWith(c.to + '/')) {
          if (!meilleur || c.to.length > meilleur.to.length) {
            meilleur = { to: c.to, label: c.label };
          }
        }
      }
    }
  }
  return meilleur?.label ?? null;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { t } = useI18n();
  const location = useLocation();
  const queryClient = useQueryClient();
  const espaceBrut = resolveEspace(location.pathname);
  const permissions = useAuthStore((state) => state.permissions);
  const user = useAuthStore((state) => state.user);
  const completeness = useAuthStore((state) => state.completeness);
  const isAuthentifie = useAuthStore((state) => state.status === 'authenticated');

  const estInvestisseur = useMemo(
    () =>
      Boolean(
        isAuthentifie &&
          user?.organizations?.some(
            (org) => org.type === 'INVESTOR' || org.roles?.includes('INVESTOR'),
          ),
      ),
    [isAuthentifie, user],
  );

  // Sur /investment : Sidebar + Topbar Horizon uniquement pour un compte INVESTOR connecte ;
  // un visiteur ou un autre role reste dans la coquille Header + Footer sans Sidebar.
  const espace = useMemo(() => {
    if (!espaceBrut) return null;
    if (location.pathname === '/investment' && !estInvestisseur) return null;
    if (location.pathname.startsWith('/investment/') && !isAuthentifie) return null;
    return espaceBrut;
  }, [espaceBrut, location.pathname, estInvestisseur, isAuthentifie]);

  /*
   * Navigation : un seul bouton hamburger, toujours en haut à gauche.
   * - Ordinateur (≥ 1024 px) : panneau en colonne, masqué par défaut ; à
   *   l'ouverture il pousse le contenu (aucun chevauchement). Le choix est
   *   mémorisé pour ce navigateur.
   * - Mobile et tablette : tiroir par-dessus la page, depuis la gauche, avec
   *   fond assombri ; fermé par ✕, clic sur le fond, Échap ou navigation.
   */
  const isLg = useBreakpoint('lg');
  const [drawerOuvert, setDrawerOuvert] = useState(false);
  const [panneauOuvert, setPanneauOuvert] = useState<boolean>(() => lirePreferencePanneau());

  const basculerPanneau = (ouvert: boolean) => {
    setPanneauOuvert(ouvert);
    ecrirePreferencePanneau(ouvert);
  };
  const navigationOuverte = isLg ? panneauOuvert : drawerOuvert;
  const basculerNavigation = () => (isLg ? basculerPanneau(!panneauOuvert) : setDrawerOuvert((v) => !v));
  const [orgActive, setOrgActive] = useState<string>(
    () => getActiveOrganizationId() ?? user?.organizations?.[0]?.id ?? '',
  );

  useEffect(() => {
    const saved = getActiveOrganizationId();
    if (saved) setOrgActive(saved);
    else if (user?.organizations?.[0]?.id) setOrgActive(user.organizations[0].id);
  }, [user]);

  const changerOrganisation = (orgId: string) => {
    setOrgActive(orgId);
    setActiveOrganizationId(orgId || null);
    void queryClient.invalidateQueries();
  };

  const groupesEspace: SidebarGroup[] = useMemo(() => {
    if (!espace) return [];
    if (espace.id !== 'admin') return espace.groupes;

    const aDroitsAdmin = permissions.some((p) => p === '*' || p.startsWith('admin.'));
    if (!aDroitsAdmin) return espace.groupes;

    const canPerm = (perm: string) => permissions.includes('*') || permissions.includes(perm);
    const filtres = espace.groupes
      .map((groupe) => ({
        ...groupe,
        items: filtrerItemsAdmin(groupe.items, canPerm),
      }))
      .filter((groupe) => groupe.items.length > 0);

    return filtres.length > 0 ? filtres : espace.groupes;
    // `t` change avec la langue : les libellés (getters) sont relus après une bascule.
  }, [espace, permissions, t]);

  const libellePage = useMemo(
    () => trouverLibelleActif(groupesEspace, location.pathname),
    // `t` : hors espace admin, `groupesEspace` garde la même référence après une bascule de langue.
    [groupesEspace, location.pathname, t],
  );

  const statusCard: SidebarStatusCard | null = useMemo(() => {
    if (!isAuthentifie || !user) return null;
    const total = completeness?.criteria?.length ?? 0;
    const faits = completeness?.criteria?.filter((c) => c.done).length ?? 0;
    const verifie = Boolean(user.emailVerified || user.phoneVerified);

    if (total > 0 && faits < total) {
      return {
        titre: t('ui.dossierComplete', { faits, total }),
        description: t('ui.completezVosInformationsVerifieesPourDebloquer'),
        ctaLabel: t('ui.completerMonProfil'),
        ctaTo: espace?.id === 'farmer' ? '/farmer/profile' : '/app/profile',
        verifie: false,
      };
    }
    return {
      titre: verifie ? t('ui.compteVerifie') : t('ui.verificationDisponible'),
      description: verifie
        ? t('ui.orgDataTracedRealtime', { name: user.organizations?.[0]?.name ?? t('ui.activeOrganisationLabel') })
        : t('ui.validezVotreAdresseEMailOu'),
      ctaLabel: verifie ? t('ui.monProfil') : t('ui.verifierMonCompte'),
      ctaTo: verifie ? '/app/profile' : '/app/verification',
      verifie,
    };
  }, [isAuthentifie, user, completeness, espace?.id, t]);

  // Le tiroir se referme après chaque navigation, et quand l'écran passe en mode ordinateur.
  useEffect(() => setDrawerOuvert(false), [location.pathname, isLg]);

  // Tiroir ouvert : Échap le ferme, et la page derrière ne défile plus.
  useEffect(() => {
    if (!drawerOuvert) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOuvert(false);
    };
    const overflowAvant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflowAvant;
      window.removeEventListener('keydown', onKey);
    };
  }, [drawerOuvert]);

  if (!espace) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <main style={{ flex: 1 }}>
          <div key={location.pathname} className="page-enter">{children}</div>
        </main>
        <Footer />
      </div>
    );
  }

  const dateCourte = new Intl.DateTimeFormat(bcpLocale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  const initiales = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'AK';

  return (
    <div className="flex min-h-screen bg-fond">
      {isLg ? (
        /*
         * Colonne ordinateur : la largeur s'anime de 0 à 272 px, le contenu
         * intérieur garde sa largeur fixe (pas de texte qui se recompose pendant
         * l'animation). Fermée, elle est hors tabulation (`inert`).
         */
        <div
          className="sticky top-0 h-screen shrink-0 self-start overflow-hidden transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: panneauOuvert ? LARGEUR_PANNEAU : 0 }}
          {...(!panneauOuvert ? { inert: true, 'aria-hidden': true } : {})}
        >
          <div className="h-full" style={{ width: LARGEUR_PANNEAU }}>
            <Sidebar
              id={ID_NAVIGATION}
              groupes={groupesEspace}
              actif={location.pathname}
              statusCard={statusCard}
              raccourciRecherche={panneauOuvert}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col bg-fond">
        <header
          className="sticky top-0 z-40 flex items-center gap-2 border-b border-bordure bg-surface/95 px-3 backdrop-blur-sm sm:gap-3 sm:px-4 lg:px-6"
          style={{ height: 60 }}
        >
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-bordure bg-surface text-texte shadow-2xs transition-colors hover:bg-fond focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondaire/60"
            aria-label={navigationOuverte ? t('ui.fermerLaNavigation') : t('ui.ouvrirLaNavigation')}
            title={navigationOuverte ? t('ui.fermerLaNavigation') : t('ui.ouvrirLaNavigation')}
            aria-expanded={navigationOuverte}
            aria-controls={isLg ? ID_NAVIGATION : ID_NAVIGATION_MOBILE}
            onClick={basculerNavigation}
          >
            <IconeHamburger ouvert={navigationOuverte} />
          </button>

          <div className="flex min-w-0 items-center gap-2">
            {libellePage && libellePage !== espace.titre ? (
              <>
                <span className="hidden truncate text-[13px] font-medium text-texte-doux sm:inline">
                  {espace.titre}
                </span>
                <span className="hidden text-xs text-texte-doux sm:inline" aria-hidden="true">
                  /
                </span>
                <h1 className="truncate text-[16px] font-bold tracking-tight text-texte">
                  {libellePage}
                </h1>
              </>
            ) : (
              <h1 className="truncate text-[16px] font-bold tracking-tight text-texte">
                {espace.titre}
              </h1>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* I18N-05 — changement de langue disponible dans tous les espaces. */}
            <LanguageSwitcher />
            {isAuthentifie && (user?.organizations?.length ?? 0) > 1 ? (
              <select
                aria-label={t('ui.organisationActive')}
                value={orgActive}
                onChange={(e) => changerOrganisation(e.target.value)}
                className="hidden h-[34px] rounded-[9px] border border-bordure bg-surface px-3 text-xs font-semibold text-texte shadow-2xs md:inline-block"
              >
                {user?.organizations?.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            ) : null}

            <div className="hidden h-[34px] items-center gap-1.5 rounded-[9px] border border-bordure bg-surface px-3 text-xs font-medium text-texte-doux shadow-2xs lg:flex">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2.5" />
                <path d="M3 10 H21 M8 3 V7 M16 3 V7" />
              </svg>
              <span>{dateCourte}</span>
            </div>

            {isAuthentifie ? (
              <>
                <Link
                  to="/"
                  className="flex h-[34px] items-center gap-1.5 rounded-[9px] border border-bordure bg-surface px-3 text-xs font-medium text-texte shadow-2xs transition-colors hover:bg-fond"
                  style={{ textDecoration: 'none' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="text-secondaire" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3.5 9 H20.5 M3.5 15 H20.5 M12 3 C15 7 15 17 12 21 M12 3 C9 7 9 17 12 21" />
                  </svg>
                  <span className="hidden md:inline">{t('ui.sitePublic')}</span>
                </Link>

                <Link
                  to="/app/notifications"
                  aria-label={t('ui.notifications')}
                  className="relative flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-bordure bg-surface text-texte-doux shadow-2xs transition-colors hover:bg-fond hover:text-texte"
                  style={{ textDecoration: 'none' }}
                >
                  <IconeCloche />
                </Link>

                <Link
                  to="/app/profile"
                  aria-label={t('ui.profil')}
                  title={user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : t('ui.profil')}
                  className="flex h-[34px] items-center gap-2 rounded-[9px] border border-bordure bg-surface px-2.5 text-xs font-semibold text-texte shadow-2xs transition-colors hover:bg-fond"
                  style={{ textDecoration: 'none' }}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-marque-clair text-[10.5px] font-bold text-marque">
                    {initiales}
                  </span>
                  <span className="hidden md:inline">{user?.firstName ?? t('ui.profil')}</span>
                </Link>

                {espace.cta ? (
                  <Link
                    to={espace.cta.to}
                    className="hidden h-[34px] items-center gap-1.5 rounded-[9px] bg-secondaire px-3.5 text-xs font-semibold text-surface shadow-2xs transition-opacity hover:opacity-95 sm:inline-flex"
                    style={{ textDecoration: 'none' }}
                  >
                    <span className="text-[14px] leading-none">+</span>
                    <span>{espace.cta.label}</span>
                  </Link>
                ) : null}
              </>
            ) : (
              <>
                <Link
                  to="/auth/login"
                  className="flex h-[34px] items-center rounded-[9px] border border-bordure bg-surface px-3 text-xs font-semibold text-texte shadow-2xs hover:bg-fond"
                  style={{ textDecoration: 'none' }}
                >{t('ui.connexion')}</Link>
                <Link
                  to="/auth/register"
                  className="flex h-[34px] items-center rounded-[9px] bg-secondaire px-3.5 text-xs font-semibold text-surface shadow-2xs"
                  style={{ textDecoration: 'none' }}
                >{t('ui.sInscrire')}</Link>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 pb-8">
          <div key={location.pathname} className="page-enter">{children}</div>
        </main>
      </div>

      {!isLg ? (
        /*
         * Tiroir mobile / tablette : toujours monté pour animer l'entrée et la
         * sortie. Fermé, il ne capte ni clic, ni tabulation, ni lecteur d'écran.
         */
        <div
          className={cn('fixed inset-0 z-50', drawerOuvert ? 'pointer-events-auto' : 'pointer-events-none')}
          role="dialog"
          aria-modal={drawerOuvert || undefined}
          aria-label={t('ui.menu')}
          {...(!drawerOuvert ? { inert: true, 'aria-hidden': true } : {})}
        >
          <div
            className={cn(
              'absolute inset-0 bg-texte/45 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none',
              drawerOuvert ? 'opacity-100' : 'opacity-0',
            )}
            onClick={() => setDrawerOuvert(false)}
            aria-hidden="true"
          />
          <div
            className={cn(
              'absolute inset-y-0 left-0 h-full shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none',
              drawerOuvert ? 'translate-x-0' : '-translate-x-full',
            )}
            style={{ width: `min(${LARGEUR_TIROIR}px, 86vw)` }}
          >
            <Sidebar
              id={ID_NAVIGATION_MOBILE}
              groupes={groupesEspace}
              actif={location.pathname}
              onFermer={() => setDrawerOuvert(false)}
              onNaviguer={() => setDrawerOuvert(false)}
              statusCard={statusCard}
              raccourciRecherche={drawerOuvert}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
