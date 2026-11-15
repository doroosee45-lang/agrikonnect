import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '../lib/utils';
import { useI18n } from '@/i18n';

/*
 * Sidebar Horizon (kit AgriKonnect v1.0) :
 * - En-tete : carre vert arrondi (28x28, r=8) + AgriKonnect + bouton repli ;
 * - Recherche instantanee sur fond blanc avec raccourci clavier Cmd/Ctrl+K ;
 * - Arborescence repliable epuree avec filet vertical de filiation + badges ;
 * - Pied de rail style Horizon : carte statut empilee + liens Parametres / Aide.
 *
 * I3 : aucune couleur hexadecimale en dur, uniquement les jetons du theme.
 */
export interface SidebarItem {
  to: string;
  label: string;
  icone?: string;
  badge?: string | number;
  children?: SidebarItem[];
}

export interface SidebarGroup {
  titre: string;
  items: SidebarItem[];
}

export interface SidebarStatusCard {
  titre: string;
  description: string;
  ctaLabel: string;
  ctaTo: string;
  verifie?: boolean;
}

export interface SidebarProps {
  groupes: SidebarGroup[];
  actif: string;
  replie: boolean;
  variante?: 'rail' | 'drawer';
  onBasculerRepli?: () => void;
  onNaviguer?: () => void;
  statusCard?: SidebarStatusCard | null;
}

const ICONES: Record<string, string[]> = {
  maison: ['M3 11.5 L12 4 L21 11.5', 'M6 10.5 V20 H18 V10.5'],
  graphe: ['M4 19 H20', 'M7 15 V11', 'M12 15 V6', 'M17 15 V9'],
  cible: ['M12 21 a9 9 0 1 0 0 -18 a9 9 0 0 0 0 18 Z', 'M12 15.5 a3.5 3.5 0 1 0 0 -7 a3.5 3.5 0 0 0 0 7 Z'],
  dossier: ['M3 6 H9 L11 8.5 H21 V19 H3 Z'],
  reglages: [
    'M12 15 a3 3 0 1 0 0 -6 a3 3 0 0 0 0 6 Z',
    'M19.4 15 a1.65 1.65 0 0 0 .33 1.82 l.06 .06 a2 2 0 1 1 -2.83 2.83 l-.06 -.06 a1.65 1.65 0 0 0 -1.82 -.33 a1.65 1.65 0 0 0 -1 1.51 V21 a2 2 0 1 1 -4 0 v-.09 A1.65 1.65 0 0 0 9 19.4 a1.65 1.65 0 0 0 -1.82 .33 l-.06 .06 a2 2 0 1 1 -2.83 -2.83 l.06 -.06 a1.65 1.65 0 0 0 .33 -1.82 a1.65 1.65 0 0 0 -1.51 -1 H3 a2 2 0 1 1 0 -4 h.09 A1.65 1.65 0 0 0 4.6 9 a1.65 1.65 0 0 0 -.33 -1.82 l-.06 -.06 a2 2 0 1 1 2.83 -2.83 l.06 .06 a1.65 1.65 0 0 0 1.82 .33 H9 a1.65 1.65 0 0 0 1 -1.51 V3 a2 2 0 1 1 4 0 v.09 a1.65 1.65 0 0 0 1 1.51 a1.65 1.65 0 0 0 1.82 -.33 l.06 -.06 a2 2 0 1 1 2.83 2.83 l-.06 .06 a1.65 1.65 0 0 0 -.33 1.82 V9 c.26 .6 .85 1 1.51 1 H21 a2 2 0 1 1 0 4 h-.09 a1.65 1.65 0 0 0 -1.51 1 Z',
  ],
  personne: ['M12 11 a4 4 0 1 0 0 -8 a4 4 0 0 0 0 8 Z', 'M4 21 c0 -4 3.5 -7 8 -7 s8 3 8 7'],
  carte: ['M3 6.5 L9 4 L15 6.5 L21 4 V17.5 L15 20 L9 17.5 L3 20 Z', 'M9 4 V17.5', 'M15 6.5 V20'],
  feuille: ['M5 19 C5 10 12 5 19 5 C19 12 14 19 5 19 Z', 'M6 18 C9 14 12 11 16 9'],
  boite: ['M4 8 L12 4 L20 8 V16 L12 20 L4 16 Z', 'M4 8 L12 12 L20 8', 'M12 12 V20'],
  globe: ['M12 21 a9 9 0 1 0 0 -18 a9 9 0 0 0 0 18 Z', 'M3.5 9 H20.5', 'M3.5 15 H20.5', 'M12 3 C15 7 15 17 12 21', 'M12 3 C9 7 9 17 12 21'],
  utilisateurs: ['M9 11 a3.5 3.5 0 1 0 0 -7 a3.5 3.5 0 0 0 0 7 Z', 'M3 20 c0 -3.5 2.5 -6 6 -6 s6 2.5 6 6', 'M16 4.5 a3 3 0 0 1 0 6', 'M17.5 14.5 c2.5 0.5 3.5 2.5 3.5 5.5'],
  verification: ['M12 3 L19 6 V11.5 C19 16 15.8 19.5 12 21 C8.2 19.5 5 16 5 11.5 V6 Z', 'M9 12 L11 14 L15.5 9.5'],
  message: ['M4 5 H20 V16 H12 L8 20 V16 H4 Z'],
  cloche: ['M12 4 a5.5 5.5 0 0 1 5.5 5.5 c0 4 1.5 5.5 2 6.5 H4.5 c0.5 -1 2 -2.5 2 -6.5 A5.5 5.5 0 0 1 12 4 Z', 'M10 20 a2 2 0 0 0 4 0'],
  panier: ['M4 8 H20 L18.5 20 H5.5 Z', 'M8.5 8 V6 a3.5 3.5 0 0 1 7 0 V8'],
  clef: ['M15 7 a4 4 0 1 1 -4 -4 c0 1 0.4 1.7 1 2.3 L4 13.5 V17 H7.5 V20 H10.5 L12.5 18 V14.5 L14.5 12.5 A4 4 0 0 1 15 7 Z'],
  sync: ['M4 12 a8 8 0 0 1 13.5 -5.8', 'M20 12 a8 8 0 0 1 -13.5 5.8', 'M17.5 3 V6.5 H14', 'M6.5 21 V17.5 H10'],
  appareils: ['M7 3 H17 V21 H7 Z', 'M10 18.5 H14'],
  livre: ['M4 5 a2 2 0 0 1 2 -2 h13 v16 H6 a2 2 0 0 0 -2 2 Z', 'M4 19 a2 2 0 0 1 2 -2 h13'],
  facture: ['M6 3 H14 L18 7 V21 H6 Z', 'M14 3 V7 H18', 'M9 12 H15', 'M9 16 H13'],
  camion: ['M2 7 H14 V16 H2 Z', 'M14 10 H18 L21 13 V16 H14 Z', 'M6 17.5 a1.8 1.8 0 1 0 0.01 0', 'M17 17.5 a1.8 1.8 0 1 0 0.01 0'],
  couches: ['M12 3 L21 8 L12 13 L3 8 Z', 'M3 12 L12 17 L21 12', 'M3 16 L12 21 L21 16'],
  grille: ['M4 4 H10 V10 H4 Z', 'M14 4 H20 V10 H14 Z', 'M4 14 H10 V20 H4 Z', 'M14 14 H20 V20 H14 Z'],
  code: ['M8 8 L4 12 L8 16', 'M16 8 L20 12 L16 16', 'M13.5 6 L10.5 18'],
  loupe: ['M11 18 a7 7 0 1 0 0 -14 a7 7 0 0 0 0 14 Z', 'M20 20 L16.2 16.2'],
  panneau: ['M4 5 a2 2 0 0 1 2 -2 h12 a2 2 0 0 1 2 2 v14 a2 2 0 0 1 -2 2 H6 a2 2 0 0 1 -2 -2 Z', 'M9 3 V21'],
  aide: ['M12 21 a9 9 0 1 0 0 -18 a9 9 0 0 0 0 18 Z', 'M9.5 9.5 a2.5 2.5 0 1 1 3.5 2.3 c-0.7 0.3 -1 0.8 -1 1.7', 'M12 17 h0.01'],
  eclair: ['M13 2 L4 14 H11 L10 22 L20 10 H13 Z'],
  'chevron-bas': ['M6 9 L12 15 L18 9'],
  'chevron-haut': ['M6 15 L12 9 L18 15'],
};

function Puce({ nom, taille = 16 }: { nom?: string; taille?: number }) {
  const paths = nom ? ICONES[nom] : undefined;
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths ? paths.map((d) => <path key={d} d={d} />) : <rect x="5" y="5" width="14" height="14" rx="3" />}
    </svg>
  );
}

function estActif(to: string, chemin: string): boolean {
  return chemin === to || chemin.startsWith(to + '/');
}

function aplatirItems(groupes: SidebarGroup[]): SidebarItem[] {
  const resultat: SidebarItem[] = [];
  for (const g of groupes) {
    for (const item of g.items) {
      resultat.push(item);
      if (item.children) {
        for (const child of item.children) resultat.push(child);
      }
    }
  }
  return resultat;
}

export function Sidebar({
  groupes,
  actif,
  replie,
  variante = 'rail',
  onBasculerRepli,
  onNaviguer,
  statusCard,
}: SidebarProps) {
  const { t } = useI18n();
  const [recherche, setRecherche] = useState('');
  const [ouverts, setOuverts] = useState<Record<string, boolean>>({});
  const champRef = useRef<HTMLInputElement | null>(null);

  const tous = useMemo(() => aplatirItems(groupes), [groupes]);

  const estExactOuMeilleur = (to: string) =>
    estActif(to, actif) &&
    !tous.some((autre) => autre.to !== to && autre.to.length > to.length && estActif(autre.to, actif));

  // Deploie uniquement la branche contenant la route courante au changement d'URL
  useEffect(() => {
    const prochain: Record<string, boolean> = {};
    for (const g of groupes) {
      for (const item of g.items) {
        if (item.children?.some((c) => estActif(c.to, actif))) {
          prochain[item.to] = true;
        }
      }
    }
    setOuverts(prochain);
  }, [actif, groupes]);

  // Raccourci clavier Cmd/Ctrl+K pour cibler la recherche de la sidebar
  useEffect(() => {
    if (replie) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        champRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [replie]);

  const groupesFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return groupes;
    return groupes
      .map((groupe) => ({
        ...groupe,
        items: groupe.items
          .map((item) => {
            const matchParent = item.label.toLowerCase().includes(q);
            const enfants = item.children?.filter((c) => c.label.toLowerCase().includes(q));
            if (matchParent) return item;
            if (enfants && enfants.length > 0) return { ...item, children: enfants };
            return null;
          })
          .filter((v): v is SidebarItem => v !== null),
      }))
      .filter((g) => g.items.length > 0);
  }, [groupes, recherche]);

  const basculerBranche = (cle: string) => {
    setOuverts((prev) => ({ ...prev, [cle]: !prev[cle] }));
  };

  return (
    <aside
      className={cn(
        'flex h-full flex-col overflow-hidden border-r border-bordure select-none',
        replie ? 'w-[72px]' : 'w-[256px]',
      )}
      style={{
        backgroundColor: 'var(--creme-50)',
        ...(variante === 'rail'
          ? { height: '100vh', transition: 'width 220ms cubic-bezier(.22,.61,.36,1)' }
          : {}),
      }}
    >
      {/* En-tete style Horizon : carre vert arrondi 28x28 + nom + bouton repli aligne a droite */}
      <div
        className={cn(
          'flex shrink-0 items-center',
          replie ? 'justify-center px-2' : 'justify-between px-4',
        )}
        style={{ height: 60 }}
      >
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2.5 text-texte"
          style={{ textDecoration: 'none' }}
          aria-label={t('ui.agrikonnectAfricaAccueil_258df')}
        >
          <span
            className="flex shrink-0 items-center justify-center bg-marque text-surface shadow-2xs"
            style={{ width: 28, height: 28, borderRadius: 8 }}
          >
            <Puce nom="feuille" taille={15} />
          </span>
          {!replie ? (
            <span className="truncate text-[15px] font-bold tracking-tight text-texte">{t('ui.agrikonnect')}</span>
          ) : null}
        </Link>

        {onBasculerRepli && !replie ? (
          <button
            type="button"
            onClick={onBasculerRepli}
            className="ml-2 flex shrink-0 items-center justify-center rounded-md text-texte-doux transition-colors hover:bg-surface hover:text-texte"
            style={{ width: 28, height: 28 }}
            aria-label={t('ui.replierLaNavigation')}
            title={t('ui.replierLaNavigation')}
          >
            <Puce nom="panneau" taille={15} />
          </button>
        ) : null}
      </div>

      {/* Champ de recherche rapide style Horizon (boite blanche nette sur fond creme-50) */}
      {!replie ? (
        <div className="shrink-0 px-3.5 pb-3">
          <div className="flex h-9 items-center gap-2 rounded-[10px] border border-bordure bg-surface px-2.5 shadow-2xs">
            <span className="shrink-0 text-texte-doux">
              <Puce nom="loupe" taille={14} />
            </span>
            <input
              ref={champRef}
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder={t('ui.rechercher')}
              aria-label={t('ui.rechercherDansLeMenu')}
              className="w-full min-w-0 border-0 bg-transparent text-[12.5px] text-texte outline-none placeholder:text-texte-doux"
            />
            <kbd className="shrink-0 rounded-[5px] border border-bordure bg-fond px-1.5 py-0.5 font-mono text-[10px] font-medium text-texte-doux">
              ⌘K
            </kbd>
          </div>
        </div>
      ) : onBasculerRepli ? (
        <div className="flex shrink-0 justify-center pb-2.5">
          <button
            type="button"
            onClick={onBasculerRepli}
            className="flex items-center justify-center rounded-[10px] border border-bordure bg-surface text-texte-doux shadow-2xs hover:text-texte"
            style={{ width: 34, height: 34 }}
            aria-label={t('ui.deployerLaNavigation')}
            title={t('ui.deployerLaNavigation')}
          >
            <Puce nom="panneau" taille={15} />
          </button>
        </div>
      ) : null}

      {/* Zone scrollable unique avec barre fine .ak-scroll */}
      <nav className="ak-scroll flex-1 overflow-y-auto px-3 py-1" aria-label={t('ui.navigationDeLEspace')}>
        {groupesFiltres.map((groupe, gIdx) => (
          <div key={groupe.titre} className={cn(gIdx > 0 ? 'mt-5' : 'mt-1')}>
            {!replie ? (
              <p
                className="mb-1.5 px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-texte-doux"
              >
                {groupe.titre}
              </p>
            ) : null}

            <ul className="flex flex-col gap-0.5" style={{ listStyle: 'none' }}>
              {groupe.items.map((item) => {
                const aEnfants = Boolean(item.children && item.children.length > 0);
                const itemExact = estExactOuMeilleur(item.to);
                const enfantActif = Boolean(item.children?.some((c) => estExactOuMeilleur(c.to)));
                const brancheActive = itemExact || enfantActif;
                const estOuvert = Boolean(recherche.trim()) || Boolean(ouverts[item.to]);

                if (!aEnfants || replie) {
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={onNaviguer}
                        aria-current={brancheActive ? 'page' : undefined}
                        title={replie ? item.label : undefined}
                        className={cn(
                          'flex h-9 items-center gap-2.5 rounded-[10px] text-[13px] transition-colors',
                          replie ? 'justify-center px-0' : 'px-2.5',
                          brancheActive
                            ? 'border border-bordure bg-surface font-semibold text-texte shadow-2xs'
                            : 'font-medium text-texte-doux hover:bg-surface/75 hover:text-texte',
                        )}
                        style={{ textDecoration: 'none' }}
                      >
                        <span className={cn('shrink-0', brancheActive ? 'text-secondaire' : 'text-texte-doux')}>
                          <Puce nom={item.icone} taille={16} />
                        </span>
                        {!replie ? <span className="truncate">{item.label}</span> : null}
                        {!replie && item.badge !== undefined ? (
                          <span className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-texte px-1.5 text-[10.5px] font-semibold text-surface">
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                }

                return (
                  <li key={item.to} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => basculerBranche(item.to)}
                      aria-expanded={estOuvert}
                      className={cn(
                        'flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13px] transition-colors',
                        brancheActive
                          ? 'font-semibold text-texte'
                          : 'font-medium text-texte-doux hover:bg-surface/75 hover:text-texte',
                      )}
                    >
                      <span className={cn('shrink-0', brancheActive ? 'text-secondaire' : 'text-texte-doux')}>
                        <Puce nom={item.icone} taille={16} />
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      <span className="shrink-0 text-texte-doux">
                        <Puce nom={estOuvert ? 'chevron-haut' : 'chevron-bas'} taille={13} />
                      </span>
                    </button>

                    {/* Sous-menu arborescent avec rail vertical et encoches horizontales style Horizon */}
                    {estOuvert ? (
                      <ul
                        className="mb-1 ml-[17px] mt-0.5 flex flex-col gap-0.5 border-l border-bordure py-0.5 pl-2.5"
                        style={{ listStyle: 'none' }}
                      >
                        {item.children?.map((child) => {
                          const childActif = estExactOuMeilleur(child.to);
                          return (
                            <li key={child.to} className="relative flex items-center">
                              <span
                                aria-hidden="true"
                                className="mr-1.5 inline-block h-px w-2 shrink-0 bg-bordure"
                              />
                              <Link
                                to={child.to}
                                onClick={onNaviguer}
                                aria-current={childActif ? 'page' : undefined}
                                className={cn(
                                  'flex h-8 min-w-0 flex-1 items-center justify-between rounded-[8px] px-2.5 text-[12.5px] transition-colors',
                                  childActif
                                    ? 'border border-bordure bg-surface font-semibold text-texte shadow-2xs'
                                    : 'font-normal text-texte-doux hover:bg-surface/70 hover:text-texte',
                                )}
                                style={{ textDecoration: 'none' }}
                              >
                                <span className="truncate">{child.label}</span>
                                {child.badge !== undefined ? (
                                  <span className="ml-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-texte px-1.5 text-[10px] font-semibold text-surface">
                                    {child.badge}
                                  </span>
                                ) : childActif ? (
                                  <span className="ml-2 h-1.5 w-1.5 shrink-0 rounded-full bg-secondaire" />
                                ) : null}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Pied de barre laterale style Horizon ("Premium plan" + Settings) */}
      {!replie ? (
        <div className="shrink-0 px-3.5 pb-3.5 pt-2">
          {statusCard ? (
            <div
              className="rounded-[14px] border border-bordure p-3.5 shadow-2xs"
              style={{
                background: 'linear-gradient(135deg, var(--vert-100) 0%, var(--pure-white) 62%)',
              }}
            >
              <span
                className="mb-2.5 flex items-center justify-center bg-secondaire text-surface shadow-2xs"
                style={{ width: 28, height: 28, borderRadius: 8 }}
              >
                <Puce nom={statusCard.verifie ? 'verification' : 'feuille'} taille={15} />
              </span>

              <div className="text-[12.5px] font-bold leading-snug text-texte">
                {statusCard.titre}
              </div>
              <p className="mt-1 line-clamp-2 text-[11.5px] leading-[1.45] text-texte-doux">
                {statusCard.description}
              </p>

              <Link
                to={statusCard.ctaTo}
                onClick={onNaviguer}
                className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-[8px] border border-bordure bg-surface px-3 text-[12px] font-semibold text-texte shadow-2xs transition-colors hover:bg-fond"
                style={{ textDecoration: 'none' }}
              >
                <span className="text-secondaire">
                  <Puce nom="eclair" taille={13} />
                </span>
                <span className="truncate">{statusCard.ctaLabel}</span>
              </Link>
            </div>
          ) : null}

          <div className="mt-2 flex flex-col gap-0.5">
            <Link
              to="/app/profile"
              onClick={onNaviguer}
              className="flex h-8 items-center gap-2.5 rounded-[8px] px-2 text-[12.5px] font-medium text-texte-doux transition-colors hover:bg-surface hover:text-texte"
              style={{ textDecoration: 'none' }}
            >
              <Puce nom="reglages" taille={15} />
              <span>{t('ui.parametres_ef8f0')}</span>
            </Link>
            <Link
              to="/services"
              onClick={onNaviguer}
              className="flex h-8 items-center gap-2.5 rounded-[8px] px-2 text-[12.5px] font-medium text-texte-doux transition-colors hover:bg-surface hover:text-texte"
              style={{ textDecoration: 'none' }}
            >
              <Puce nom="aide" taille={15} />
              <span>{t('ui.aideSupport')}</span>
            </Link>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
