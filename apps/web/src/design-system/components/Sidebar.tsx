import { Link } from 'react-router-dom';

import { cn } from '../lib/utils';

/*
 * Rail de navigation des espaces metier (kit 6.2) : 250px deploye /
 * 72px replie avec info-bulles, etat actif = fond vert du kit, variante
 * drawer pour le mobile. Iconographie = trais minimaux internes (aucune
 * dependance, aucune donnee : le contenu vient des groupes fournis par
 * lib/space-nav.ts, routes reelles uniquement).
 */
export interface SidebarItem {
  to: string;
  label: string;
  icone?: string;
}

export interface SidebarGroup {
  titre: string;
  items: SidebarItem[];
}

export interface SidebarProps {
  groupes: SidebarGroup[];
  actif: string;
  replie: boolean;
  variante?: 'rail' | 'drawer';
  onBasculerRepli?: () => void;
  onNaviguer?: () => void;
}

const ICONES: Record<string, string[]> = {
  maison: ['M3 11.5 L12 4 L21 11.5', 'M6 10.5 V20 H18 V10.5'],
  graphe: ['M4 4 V20 H20', 'M7 16 L11 11 L14 13.5 L19 7'],
  cible: ['M12 21 a9 9 0 1 0 0 -18 a9 9 0 0 0 0 18 Z', 'M12 16 a4 4 0 1 0 0 -8 a4 4 0 0 0 0 8 Z', 'M12 13 a1 1 0 1 0 0 -2 a1 1 0 0 0 0 2 Z'],
  dossier: ['M3 6 H9 L11 8.5 H21 V19 H3 Z'],
  reglages: ['M12 15.5 a3.5 3.5 0 1 0 0 -7 a3.5 3.5 0 0 0 0 7 Z', 'M12 2.5 V5', 'M12 19 V21.5', 'M2.5 12 H5', 'M19 12 H21.5', 'M5.3 5.3 L7 7', 'M17 17 L18.7 18.7', 'M18.7 5.3 L17 7', 'M7 17 L5.3 18.7'],
  personne: ['M12 11 a4 4 0 1 0 0 -8 a4 4 0 0 0 0 8 Z', 'M4 21 c0 -4 3.5 -7 8 -7 s8 3 8 7'],
  carte: ['M3 6.5 L9 4 L15 6.5 L21 4 V17.5 L15 20 L9 17.5 L3 20 Z', 'M9 4 V17.5', 'M15 6.5 V20'],
  feuille: ['M5 19 C5 10 12 5 19 5 C19 12 14 19 5 19 Z', 'M6 18 C9 14 12 11 16 9'],
  boite: ['M4 8 L12 4 L20 8 V16 L12 20 L4 16 Z', 'M4 8 L12 12 L20 8', 'M12 12 V20'],
  globe: ['M12 21 a9 9 0 1 0 0 -18 a9 9 0 0 0 0 18 Z', 'M3.5 9 H20.5', 'M3.5 15 H20.5', 'M12 3 C15 7 15 17 12 21', 'M12 3 C9 7 9 17 12 21'],
  utilisateurs: ['M9 11 a3.5 3.5 0 1 0 0 -7 a3.5 3.5 0 0 0 0 7 Z', 'M3 20 c0 -3.5 2.5 -6 6 -6 s6 2.5 6 6', 'M16 4.5 a3 3 0 0 1 0 6', 'M17.5 14.5 c2.5 0.5 3.5 2.5 3.5 5.5'],
  verification: ['M12 21 a9 9 0 1 0 0 -18 a9 9 0 0 0 0 18 Z', 'M8 12.5 L11 15.5 L16.5 9'],
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
  'chevron-gauche': ['M14 6 L9 12 L14 18'],
  'chevron-droite': ['M10 6 L15 12 L10 18'],
};

function Puce({ nom, taille = 20 }: { nom?: string; taille?: number }) {
  const paths = nom ? ICONES[nom] : undefined;
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
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

export function Sidebar({ groupes, actif, replie, variante = 'rail', onBasculerRepli, onNaviguer }: SidebarProps) {
  const plat = groupes.flatMap((groupe) => groupe.items);
  const estMeilleur = (to: string) =>
    estActif(to, actif) && !plat.some((autre) => autre.to.length > to.length && estActif(autre.to, actif));

  return (
    <aside
      className={cn(
        'flex h-full flex-col overflow-y-auto border-r border-bordure bg-surface',
        replie ? 'w-[72px]' : 'w-[250px]',
      )}
      style={variante === 'rail' ? { height: '100vh', transition: 'width 220ms ease' } : undefined}
    >
      <div
        className={cn('flex items-center gap-2 border-b border-bordure', replie ? 'justify-center px-2' : 'px-4')}
        style={{ minHeight: 64 }}
      >
        <Link to="/" className="flex items-center gap-2 text-marque" style={{ textDecoration: 'none' }} aria-label="AGRIKONNECT AFRICA, accueil">
          <Puce nom="feuille" taille={22} />
          {!replie ? <span style={{ fontWeight: 800, letterSpacing: 0.4, fontSize: 14 }}>AGRIKONNECT</span> : null}
        </Link>
        {onBasculerRepli ? (
          <button
            type="button"
            onClick={onBasculerRepli}
            className="ml-auto flex items-center justify-center rounded-lg border border-bordure bg-fond text-texte-doux"
            style={{ width: 28, height: 28 }}
            aria-label={replie ? 'Déployer la navigation' : 'Replier la navigation'}
          >
            <Puce nom={replie ? 'chevron-droite' : 'chevron-gauche'} taille={14} />
          </button>
        ) : null}
      </div>
      <nav className="flex-1 px-2 py-3">
        {groupes.map((groupe) => (
          <div key={groupe.titre} style={{ marginBottom: 16 }}>
            {!replie ? (
              <p
                className="text-texte-doux"
                style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, margin: '0 0 6px 10px' }}
              >
                {groupe.titre}
              </p>
            ) : null}
            <ul className="flex flex-col gap-1" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {groupe.items.map((item) => {
                const actifItem = estMeilleur(item.to);
                return (
                  <li key={item.to} className="group relative">
                    <Link
                      to={item.to}
                      onClick={onNaviguer}
                      aria-current={actifItem ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-xl',
                        replie ? 'justify-center px-0' : 'px-3',
                        actifItem ? 'bg-marque-clair text-marque' : 'text-texte-doux hover:bg-fond hover:text-texte',
                      )}
                      style={{
                        minHeight: 40,
                        fontSize: 14,
                        fontWeight: actifItem ? 600 : 500,
                        textDecoration: 'none',
                        transition: 'background-color 160ms ease, color 160ms ease',
                      }}
                    >
                      <Puce nom={item.icone} />
                      {!replie ? <span>{item.label}</span> : null}
                    </Link>
                    {replie ? (
                      <span
                        className="pointer-events-none absolute left-[62px] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-texte px-2 py-1 text-surface group-hover:block"
                        style={{ fontSize: 12 }}
                      >
                        {item.label}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
