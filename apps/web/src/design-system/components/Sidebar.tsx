import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '../lib/utils';
import { useI18n } from '@/i18n';

/*
 * Sidebar universelle d'AgriKonnect — un seul composant pour tous les espaces
 * (agriculteur, organisation, marché, investissement, compte, relecteur,
 * développeurs, administration).
 *
 * Le panneau ne gère que son contenu : c'est `AppLayout` qui décide où il
 * apparaît (colonne poussant le contenu sur ordinateur, tiroir par-dessus la
 * page sur mobile et tablette) et quand il s'ouvre (bouton hamburger).
 *
 * - En-tête : logo + nom + bouton de fermeture ;
 * - Recherche instantanée (Ctrl/Cmd+K) ;
 * - Groupes et sous-menus repliables, animés sans saut de mise en page ;
 * - États distincts : actif (fond teinté + filet vert), survolé, focus clavier ;
 * - Pied : carte d'état du dossier + Paramètres / Aide.
 *
 * I3 : aucune couleur hexadécimale en dur, uniquement les jetons du thème.
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
  /** Ferme le panneau (bouton ✕ de l'en-tête). */
  onFermer?: () => void;
  /** Appelé après un clic sur un lien (le tiroir mobile se referme). */
  onNaviguer?: () => void;
  statusCard?: SidebarStatusCard | null;
  /** Active le raccourci Ctrl/Cmd+K (panneau visible uniquement). */
  raccourciRecherche?: boolean;
  /** Identifiant DOM, référencé par `aria-controls` du bouton hamburger. */
  id?: string;
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
  croix: ['M6 6 L18 18', 'M18 6 L6 18'],
  'chevron-bas': ['M6 9 L12 15 L18 9'],
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
      strokeWidth={1.75}
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

/** Anneau de focus clavier commun (jamais au clic souris). */
const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-secondaire/60 focus-visible:ring-offset-1 focus-visible:ring-offset-fond';

export function Sidebar({
  groupes,
  actif,
  onFermer,
  onNaviguer,
  statusCard,
  raccourciRecherche = true,
  id,
}: SidebarProps) {
  const { t } = useI18n();
  const [recherche, setRecherche] = useState('');
  const [ouverts, setOuverts] = useState<Record<string, boolean>>({});
  const champRef = useRef<HTMLInputElement | null>(null);

  const tous = useMemo(() => aplatirItems(groupes), [groupes]);

  // L'entrée la plus précise gagne : « /organization » n'est pas actif sur « /organization/members ».
  const estExactOuMeilleur = (to: string) =>
    estActif(to, actif) &&
    !tous.some((autre) => autre.to !== to && autre.to.length > to.length && estActif(autre.to, actif));

  // Déploie la branche qui contient la page courante, à chaque changement d'URL.
  useEffect(() => {
    const prochain: Record<string, boolean> = {};
    for (const g of groupes) {
      for (const item of g.items) {
        if (item.children?.some((c) => estActif(c.to, actif))) prochain[item.to] = true;
      }
    }
    setOuverts(prochain);
  }, [actif, groupes]);

  useEffect(() => {
    if (!raccourciRecherche) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        champRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [raccourciRecherche]);

  const groupesFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return groupes;
    return groupes
      .map((groupe) => ({
        ...groupe,
        items: groupe.items
          .map((item) => {
            const enfants = item.children?.filter((c) => c.label.toLowerCase().includes(q));
            if (item.label.toLowerCase().includes(q)) return item;
            if (enfants && enfants.length > 0) return { ...item, children: enfants };
            return null;
          })
          .filter((v): v is SidebarItem => v !== null),
      }))
      .filter((g) => g.items.length > 0);
  }, [groupes, recherche]);

  const basculerBranche = (cle: string) => setOuverts((prev) => ({ ...prev, [cle]: !prev[cle] }));

  const lienPied = cn(
    'flex h-9 items-center gap-3 rounded-[10px] px-3 text-[13px] font-medium text-texte-doux transition-colors duration-150 hover:bg-surface hover:text-texte',
    FOCUS,
  );

  return (
    <aside
      id={id}
      className="flex h-full w-full flex-col overflow-hidden border-r border-bordure select-none"
      style={{ backgroundColor: 'var(--creme-50)' }}
      aria-label={t('ui.navigationDeLEspace')}
    >
      {/* En-tête : logo + nom + fermeture */}
      <div className="flex h-[60px] shrink-0 items-center justify-between gap-2 border-b border-bordure/70 px-4">
        <Link
          to="/"
          onClick={onNaviguer}
          className={cn('flex min-w-0 items-center gap-2.5 rounded-lg text-texte', FOCUS)}
          style={{ textDecoration: 'none' }}
          aria-label={t('ui.agrikonnectAfricaAccueil_258df')}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-marque text-surface shadow-2xs">
            <Puce nom="feuille" taille={16} />
          </span>
          <span className="truncate text-[15px] font-bold tracking-tight">{t('ui.agrikonnect')}</span>
        </Link>

        {onFermer ? (
          <button
            type="button"
            onClick={onFermer}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-texte-doux transition-colors hover:bg-surface hover:text-texte',
              FOCUS,
            )}
            aria-label={t('ui.fermerLaNavigation')}
            title={t('ui.fermerLaNavigation')}
          >
            <Puce nom="croix" taille={17} />
          </button>
        ) : null}
      </div>

      {/* Recherche rapide */}
      <div className="shrink-0 px-3.5 pb-2 pt-3.5">
        <label
          className="flex h-10 items-center gap-2 rounded-[11px] border border-bordure bg-surface px-3 shadow-2xs transition-shadow focus-within:border-secondaire/60 focus-within:ring-2 focus-within:ring-secondaire/20"
        >
          <span className="shrink-0 text-texte-doux">
            <Puce nom="loupe" taille={15} />
          </span>
          <input
            ref={champRef}
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t('ui.rechercher')}
            aria-label={t('ui.rechercherDansLeMenu')}
            className="w-full min-w-0 border-0 bg-transparent text-[13px] text-texte outline-none placeholder:text-texte-doux"
          />
          <kbd className="hidden shrink-0 rounded-[5px] border border-bordure bg-fond px-1.5 py-0.5 font-mono text-[10px] font-medium text-texte-doux sm:inline">
            ⌘K
          </kbd>
        </label>
      </div>

      {/* Menus */}
      <nav className="ak-scroll flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
        {groupesFiltres.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12.5px] text-texte-doux">{t('ui.aucuneEntreeDeMenuNeCorrespond')}</p>
        ) : null}

        {groupesFiltres.map((groupe) => (
          <section key={groupe.titre} className="mt-4 first:mt-2">
            <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-texte-doux/80">
              {groupe.titre}
            </p>

            <ul className="flex flex-col gap-0.5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {groupe.items.map((item) => {
                const aEnfants = Boolean(item.children && item.children.length > 0);
                const enfantActif = Boolean(item.children?.some((c) => estExactOuMeilleur(c.to)));
                // Un parent qui partage l'adresse de son premier sous-menu ne se surligne pas en double.
                const itemExact = estExactOuMeilleur(item.to) && !enfantActif;
                const brancheActive = itemExact || enfantActif;
                const estOuvert = Boolean(recherche.trim()) || Boolean(ouverts[item.to]);

                const classeEntree = cn(
                  'group relative flex h-10 w-full items-center gap-3 rounded-[11px] px-3 text-left text-[13.5px] transition-colors duration-150',
                  FOCUS,
                  itemExact
                    ? 'bg-marque-clair font-semibold text-marque'
                    : brancheActive
                      ? 'font-semibold text-texte hover:bg-surface'
                      : 'font-medium text-texte-doux hover:bg-surface hover:text-texte',
                );

                const icone = (
                  <span
                    className={cn(
                      'shrink-0 transition-colors',
                      brancheActive ? 'text-secondaire' : 'text-texte-doux group-hover:text-texte',
                    )}
                  >
                    <Puce nom={item.icone} taille={18} />
                  </span>
                );

                const filetActif = itemExact ? (
                  <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-secondaire" />
                ) : null;

                if (!aEnfants) {
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={onNaviguer}
                        aria-current={itemExact ? 'page' : undefined}
                        className={classeEntree}
                        style={{ textDecoration: 'none' }}
                      >
                        {filetActif}
                        {icone}
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.badge !== undefined ? (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-secondaire px-1.5 text-[10.5px] font-semibold text-surface">
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                }

                const idSousMenu = `sm-${item.to.replace(/[^a-z0-9]+/gi, '-')}`;
                return (
                  <li key={item.to}>
                    <button
                      type="button"
                      onClick={() => basculerBranche(item.to)}
                      aria-expanded={estOuvert}
                      aria-controls={idSousMenu}
                      className={classeEntree}
                    >
                      {filetActif}
                      {icone}
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      <span
                        className={cn(
                          'shrink-0 text-texte-doux transition-transform duration-200 motion-reduce:transition-none',
                          estOuvert ? 'rotate-180' : 'rotate-0',
                        )}
                      >
                        <Puce nom="chevron-bas" taille={14} />
                      </span>
                    </button>

                    {/* Sous-menu : hauteur animée par grid-rows (0fr → 1fr), sans mesurer le DOM. */}
                    <div
                      id={idSousMenu}
                      className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
                      style={{ gridTemplateRows: estOuvert ? '1fr' : '0fr' }}
                    >
                      <ul
                        className="min-h-0 overflow-hidden border-l border-bordure pl-3"
                        style={{ listStyle: 'none', margin: 0, marginLeft: 21, paddingTop: 0, paddingBottom: 0 }}
                        // Masqué = hors tabulation et hors lecteur d'écran.
                        {...(!estOuvert ? { inert: true, 'aria-hidden': true } : {})}
                      >
                        {item.children?.map((child) => {
                          const childActif = estExactOuMeilleur(child.to);
                          return (
                            <li key={child.to} className="py-[1px] first:pt-1 last:pb-1">
                              <Link
                                to={child.to}
                                onClick={onNaviguer}
                                aria-current={childActif ? 'page' : undefined}
                                className={cn(
                                  'flex h-9 min-w-0 items-center justify-between gap-2 rounded-[9px] px-3 text-[13px] transition-colors duration-150',
                                  FOCUS,
                                  childActif
                                    ? 'bg-marque-clair font-semibold text-marque'
                                    : 'font-normal text-texte-doux hover:bg-surface hover:text-texte',
                                )}
                                style={{ textDecoration: 'none' }}
                              >
                                <span className="truncate">{child.label}</span>
                                {child.badge !== undefined ? (
                                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-secondaire px-1.5 text-[10px] font-semibold text-surface">
                                    {child.badge}
                                  </span>
                                ) : childActif ? (
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-secondaire" />
                                ) : null}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>

      {/* Pied : état du dossier + Paramètres / Aide */}
      <div className="shrink-0 border-t border-bordure/70 px-3.5 pb-3.5 pt-3">
        {statusCard ? (
          <div
            className="mb-2 rounded-[14px] border border-bordure p-3 shadow-2xs"
            style={{ background: 'linear-gradient(135deg, var(--vert-100) 0%, var(--pure-white) 70%)' }}
          >
            <div className="flex items-start gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-secondaire text-surface shadow-2xs">
                <Puce nom={statusCard.verifie ? 'verification' : 'feuille'} taille={14} />
              </span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-bold leading-snug text-texte">{statusCard.titre}</div>
                <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-[1.45] text-texte-doux">
                  {statusCard.description}
                </p>
              </div>
            </div>
            <Link
              to={statusCard.ctaTo}
              onClick={onNaviguer}
              className={cn(
                'mt-2.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-[9px] border border-bordure bg-surface px-3 text-[12px] font-semibold text-texte shadow-2xs transition-colors hover:bg-fond',
                FOCUS,
              )}
              style={{ textDecoration: 'none' }}
            >
              <span className="text-secondaire">
                <Puce nom="eclair" taille={13} />
              </span>
              <span className="truncate">{statusCard.ctaLabel}</span>
            </Link>
          </div>
        ) : null}

        <Link to="/app/profile" onClick={onNaviguer} className={lienPied} style={{ textDecoration: 'none' }}>
          <Puce nom="reglages" taille={16} />
          <span>{t('ui.parametres_ef8f0')}</span>
        </Link>
        <Link to="/services" onClick={onNaviguer} className={lienPied} style={{ textDecoration: 'none' }}>
          <Puce nom="aide" taille={16} />
          <span>{t('ui.aideSupport')}</span>
        </Link>
      </div>
    </aside>
  );
}
