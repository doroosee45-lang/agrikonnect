#!/usr/bin/env node
/*
 * fix-p3-layout.mjs -- Mission 2, Phase 3 (layouts & responsive), BLOC 90.
 * but : coquille espace (kit 6.2/6.3) sans toucher au site public.
 *   1. NEW design-system/hooks/useBreakpoint.ts (breakpoints kit 640/768/1024/1280)
 *   2. NEW design-system/components/Sidebar.tsx (rail 250/72, tooltips, actif, drawer)
 *   3. NEW lib/space-nav.ts (navigation par espace = ROUTES REELLES du routeur,
 *      integrite verifiee : chaque lien doit exister comme path="..." dans App.tsx)
 *   4. REWRITE components/layout/AppLayout.tsx (public = Header/Footer INCHANGES ;
 *      espace = rail + barre espace qui REPRODUIT les liens d auth du Header)
 *   5. PATCH design-system/index.ts (exports) ; index.css sert tel quel (pont P2a)
 * regles : aucun hex dans composants (I3), aucun composant orphelin (Sidebar+hook
 * adoptes dans AppLayout), aucun npm, aucun code supprime (Header.tsx INTACT).
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const RD = 'D:/AGRIKONNECT/Soupabase/Nouveau dossier/agrikonnect-africa-final';
const GEN = process.argv.includes('--gen');
const RACINE = GEN ? '/tmp/p3tree' : RD;

const md5 = (f) => createHash('md5').update(fs.readFileSync(f)).digest('hex');
const lire = (f) => fs.readFileSync(f, 'utf8');
const ecrire = (f, contenu) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, contenu, 'utf8'); };
const verifie = (f, contenu, valeurs) => {
  for (const v of valeurs) {
    if (typeof v === 'string' && !contenu.includes(v)) throw new Error('ABSENT: ' + v + ' @ ' + f);
    if (v instanceof RegExp && !v.test(contenu)) throw new Error('ABSENT_RE: ' + String(v) + ' @ ' + f);
  }
};
function pre(m5, f) {
  if (GEN) return;
  const p = path.join(RACINE, f);
  if (!fs.existsSync(p)) throw new Error('MANQUANT ' + f);
  const v = md5(p);
  if (v !== m5) throw new Error('ARRET_MD5 ' + v + ' ' + f + ' (attendu ' + m5 + ')');
  console.log('  [ok] ' + f + ' = ' + v);
}
function post(m5, f, valeurs) {
  const p = path.join(RACINE, f);
  const v = md5(p);
  verifie(p, lire(p), valeurs);
  if (GEN) { console.log('  [gen-post] ' + f + ' = ' + v); return; }
  if (v !== m5) throw new Error('ARRET_MD5_POST ' + v + ' ' + f + ' (attendu ' + m5 + ')');
  console.log('  [ok] ' + f + ' = ' + v);
}
function remplacerTout(f, avant, apres, attendu) {
  const p = path.join(RACINE, f);
  const avantContenu = lire(p);
  if (avantContenu.split(avant).length - 1 !== attendu) throw new Error('ARRET_ANCRE ' + f);
  ecrire(p, avantContenu.split(avant).join(apres));
}
function nonAsciiHorsAccents(contenu) {
  const accents = '\u00c0-\u00ff';
  const re = new RegExp('[^\\x00-\\x7F' + accents + ']', 'g');
  return (contenu.match(re) || []).join('');
}

if (!GEN) console.log('== Phase 3 : coquille espace (sidebar 250/72 + breakpoints) ==');

/* ------------------------------------------------------------------ */
/* 0. Portes md5 PRE (arret si la copie machine derive)                */
/* ------------------------------------------------------------------ */
if (!GEN) {
  pre('4ab4c69ee7b7ce8251615d1ac92174b8', 'apps/web/src/components/layout/AppLayout.tsx');
  pre('5c342a09363a90de879813614f8d7d0e', 'apps/web/src/design-system/index.ts');
} else {
  for (const f of ['apps/web/src/design-system/hooks/useBreakpoint.ts', 'apps/web/src/design-system/components/Sidebar.tsx', 'apps/web/src/lib/space-nav.ts']) {
    const p = path.join(RACINE, f);
    if (fs.existsSync(p)) fs.rmSync(p);
    console.log('  [gen] purge ' + f);
  }
}

/* ------------------------------------------------------------------ */
/* 1. DONNEES DE NAVIGATION = routes reelles du routeur                */
/* ------------------------------------------------------------------ */
const ESPACES = [
  {
    id: 'admin',
    titre: 'Administration',
    groupes: [
      { titre: 'Pilotage', items: [
        { to: '/admin', label: 'Accueil', icone: 'maison' },
        { to: '/admin/dashboard', label: 'Tableau de bord', icone: 'graphe' },
        { to: '/admin/monitoring', label: 'Supervision', icone: 'cible' },
        { to: '/admin/operations', label: 'Op\u00e9rations', icone: 'dossier' },
        { to: '/admin/jobs', label: 'T\u00e2ches planifi\u00e9es', icone: 'sync' },
      ] },
      { titre: 'R\u00e9seau agricole', items: [
        { to: '/admin/producers', label: 'Producteurs', icone: 'personne' },
        { to: '/admin/farmers', label: 'Agriculteurs', icone: 'feuille' },
        { to: '/admin/farms', label: 'Exploitations', icone: 'maison' },
        { to: '/admin/plots', label: 'Parcelles', icone: 'carte' },
        { to: '/admin/productions', label: 'Productions', icone: 'feuille' },
        { to: '/admin/lots', label: 'Lots', icone: 'boite' },
        { to: '/admin/crops', label: 'Cultures', icone: 'feuille' },
        { to: '/admin/prices', label: 'Prix', icone: 'graphe' },
        { to: '/admin/countries', label: 'Pays', icone: 'globe' },
      ] },
      { titre: 'Utilisateurs', items: [
        { to: '/admin/users', label: 'Utilisateurs', icone: 'utilisateurs' },
        { to: '/admin/roles', label: 'R\u00f4les', icone: 'cible' },
        { to: '/admin/verifications', label: 'V\u00e9rifications', icone: 'verification' },
        { to: '/admin/moderation', label: 'Mod\u00e9ration', icone: 'message' },
      ] },
      { titre: 'March\u00e9', items: [
        { to: '/admin/orders', label: 'Commandes', icone: 'panier' },
        { to: '/admin/marketplace', label: 'Marketplace', icone: 'boite' },
        { to: '/admin/cooperatives', label: 'Coop\u00e9ratives', icone: 'utilisateurs' },
      ] },
      { titre: 'Projets & finance', items: [
        { to: '/admin/projects', label: 'Projets', icone: 'dossier' },
        { to: '/admin/investors', label: 'Investisseurs', icone: 'personne' },
      ] },
      { titre: 'Communication', items: [
        { to: '/admin/messages', label: 'Messages', icone: 'message' },
        { to: '/admin/notifications', label: 'Notifications', icone: 'cloche' },
      ] },
      { titre: 'Syst\u00e8me', items: [
        { to: '/admin/sync', label: 'Synchronisation', icone: 'sync' },
        { to: '/admin/devices', label: 'Appareils', icone: 'appareils' },
        { to: '/admin/api-clients', label: 'Clients API', icone: 'clef' },
        { to: '/admin/ai-usage', label: 'Usage IA', icone: 'graphe' },
        { to: '/admin/data-products', label: 'Produits de donn\u00e9es', icone: 'boite' },
        { to: '/admin/partners', label: 'Partenaires', icone: 'utilisateurs' },
        { to: '/admin/compliance', label: 'Conformit\u00e9', icone: 'verification' },
        { to: '/admin/agronomic-ranges', label: 'Zones agro', icone: 'carte' },
        { to: '/admin/rules', label: 'R\u00e8gles', icone: 'livre' },
        { to: '/admin/security', label: 'S\u00e9curit\u00e9', icone: 'verification' },
        { to: '/admin/audit', label: 'Audit', icone: 'livre' },
        { to: '/admin/settings', label: 'Param\u00e8tres', icone: 'reglages' },
        { to: '/admin/reports', label: 'Rapports', icone: 'facture' },
      ] },
    ],
  },
  {
    id: 'app',
    titre: 'Mon espace',
    groupes: [
      { titre: 'Activit\u00e9', items: [
        { to: '/app', label: 'Tableau de bord', icone: 'graphe' },
        { to: '/app/farms', label: 'Exploitations', icone: 'maison' },
        { to: '/app/plots', label: 'Parcelles', icone: 'carte' },
        { to: '/app/productions', label: 'Productions', icone: 'feuille' },
        { to: '/app/soil', label: 'Sol', icone: 'couches' },
        { to: '/app/inventory', label: 'Inventaire', icone: 'boite' },
      ] },
      { titre: 'March\u00e9', items: [
        { to: '/app/orders', label: 'Commandes', icone: 'panier' },
        { to: '/app/invoices', label: 'Factures', icone: 'facture' },
        { to: '/app/cooperative', label: 'Coop\u00e9rative', icone: 'utilisateurs' },
        { to: '/app/cooperative/offers', label: 'Offres coop\u00e9rative', icone: 'boite' },
        { to: '/app/cooperative/orders', label: 'Commandes coop\u00e9rative', icone: 'panier' },
        { to: '/app/transport', label: 'Transport', icone: 'camion' },
      ] },
      { titre: 'Communication', items: [
        { to: '/app/messages', label: 'Messages', icone: 'message' },
        { to: '/app/notifications', label: 'Notifications', icone: 'cloche' },
        { to: '/app/sms-consent', label: 'Consentement SMS', icone: 'message' },
      ] },
      { titre: 'Compte', items: [
        { to: '/app/profile', label: 'Profil', icone: 'personne' },
        { to: '/app/verification', label: 'V\u00e9rification', icone: 'verification' },
        { to: '/app/agent', label: 'Espace agent', icone: 'personne' },
        { to: '/app/season-feedback', label: 'Bilan de saison', icone: 'livre' },
      ] },
    ],
  },
  {
    id: 'farmer',
    titre: 'Mon exploitation',
    groupes: [
      { titre: 'Activit\u00e9', items: [
        { to: '/farmer', label: 'Tableau de bord', icone: 'graphe' },
        { to: '/farmer/farms', label: 'Exploitations', icone: 'maison' },
        { to: '/farmer/plots', label: 'Parcelles', icone: 'carte' },
        { to: '/farmer/productions', label: 'Productions', icone: 'feuille' },
        { to: '/farmer/soil', label: 'Sol', icone: 'couches' },
        { to: '/farmer/lots', label: 'Lots', icone: 'boite' },
      ] },
      { titre: 'Projets & export', items: [
        { to: '/farmer/export', label: 'Export', icone: 'globe' },
        { to: '/farmer/projects', label: 'Projets', icone: 'dossier' },
        { to: '/farmer/certifications', label: 'Certifications', icone: 'verification' },
      ] },
      { titre: 'Terrain & donn\u00e9es', items: [
        { to: '/farmer/surveys', label: 'Enqu\u00eates', icone: 'livre' },
        { to: '/farmer/devices', label: 'Appareils', icone: 'appareils' },
        { to: '/farmer/gallery', label: 'Galerie', icone: 'grille' },
        { to: '/farmer/sync', label: 'Synchronisation', icone: 'sync' },
        { to: '/farmer/conflicts', label: 'Conflits', icone: 'cible' },
      ] },
      { titre: 'Compte', items: [
        { to: '/farmer/alerts', label: 'Alertes', icone: 'cloche' },
        { to: '/farmer/profile', label: 'Profil', icone: 'personne' },
        { to: '/farmer/public-profile', label: 'Profil public', icone: 'globe' },
        { to: '/farmer/verification', label: 'V\u00e9rification', icone: 'verification' },
        { to: '/farmer/settings', label: 'Param\u00e8tres', icone: 'reglages' },
      ] },
    ],
  },
  {
    id: 'organization',
    titre: 'Mon organisation',
    groupes: [
      { titre: 'G\u00e9n\u00e9ral', items: [
        { to: '/organization', label: 'Accueil', icone: 'maison' },
        { to: '/organization/overview', label: "Vue d'ensemble", icone: 'graphe' },
        { to: '/organization/profile', label: 'Profil', icone: 'personne' },
      ] },
      { titre: 'Membres', items: [
        { to: '/organization/members', label: 'Membres', icone: 'utilisateurs' },
        { to: '/organization/invitations', label: 'Invitations', icone: 'message' },
        { to: '/organization/import', label: 'Import', icone: 'dossier' },
      ] },
      { titre: 'Exploitation', items: [
        { to: '/organization/farms', label: 'Exploitations', icone: 'maison' },
        { to: '/organization/production', label: 'Production', icone: 'feuille' },
        { to: '/organization/verification', label: 'V\u00e9rification', icone: 'verification' },
      ] },
    ],
  },
  {
    id: 'reviewer',
    titre: 'Revue & conformit\u00e9',
    groupes: [
      { titre: 'Missions', items: [
        { to: '/reviewer/missions', label: 'Missions', icone: 'dossier' },
      ] },
    ],
  },
  {
    id: 'developers',
    titre: 'Espace d\u00e9veloppeur',
    groupes: [
      { titre: 'API', items: [
        { to: '/developers', label: 'Accueil', icone: 'code' },
        { to: '/developers/keys', label: 'Cl\u00e9s', icone: 'clef' },
        { to: '/developers/usage', label: 'Usage', icone: 'graphe' },
        { to: '/developers/docs', label: 'Documentation', icone: 'livre' },
      ] },
    ],
  },
  {
    id: 'marche',
    titre: 'March\u00e9',
    groupes: [
      { titre: 'March\u00e9', items: [
        { to: '/market/app', label: 'Espace march\u00e9', icone: 'panier' },
        { to: '/market/listings/new', label: 'Nouvelle annonce', icone: 'boite' },
        { to: '/market/requests', label: 'Demandes', icone: 'facture' },
        { to: '/market/requests/new', label: 'Nouvelle demande', icone: 'dossier' },
        { to: '/market/reviews', label: 'Avis', icone: 'message' },
        { to: '/market/transporters', label: 'Transporteurs', icone: 'camion' },
      ] },
    ],
  },
  {
    id: 'investissement',
    titre: 'Investissement',
    groupes: [
      { titre: 'Investissement', items: [
        { to: '/investment/profile', label: 'Profil investisseur', icone: 'personne' },
        { to: '/investment/projects', label: 'Projets suivis', icone: 'dossier' },
        { to: '/investment/requests', label: 'Demandes', icone: 'facture' },
      ] },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* 2. INTEGRITE ROUTEUR : tout lien = path="..." reel                  */
/* ------------------------------------------------------------------ */
const cheminApp = path.join(RACINE, 'apps/web/src/App.tsx');
if (GEN) {
  const paths = ESPACES.flatMap((e) => e.groupes.flatMap((g) => g.items.map((i) => i.to)));
  ecrire(cheminApp, paths.map((p) => '            <Route path="' + p + '" element={<X />} />').join('\n') + '\n');
}
const appTexte = lire(cheminApp);
let nbLiens = 0;
for (const espace of ESPACES) {
  for (const groupe of espace.groupes) {
    for (const item of groupe.items) {
      nbLiens += 1;
      if (!appTexte.includes('path="' + item.to + '"')) {
        throw new Error('ARRET_ROUTEUR lien ' + item.to + ' sans route reelle');
      }
    }
  }
}
console.log('  [ok] integrite routeur : ' + nbLiens + ' liens = routes reelles');

/* ------------------------------------------------------------------ */
/* 3. CONTENUS                                                         */
/* ------------------------------------------------------------------ */
const useBreakpointTs = `import { useEffect, useState } from 'react';

/*
 * Pont React sur les breakpoints du kit (BREAKPOINT du theme : 640/768/1024/1280).
 * useBreakpoint('md') === true des que le viewport atteint >= 768px.
 * Sans window (SSR/preview) : false jusqu a la premiere mesure client.
 */
const QUERIES = {
  sm: '(min-width: 640px)',
  md: '(min-width: 768px)',
  lg: '(min-width: 1024px)',
  xl: '(min-width: 1280px)',
} as const;

export type Breakpoint = keyof typeof QUERIES;

export function useBreakpoint(point: Breakpoint): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(QUERIES[point]).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERIES[point]);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [point]);

  return matches;
}
`;

const sidebarTsx = `import { Link } from 'react-router-dom';

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
            aria-label={replie ? 'D\u00e9ployer la navigation' : 'Replier la navigation'}
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
`;

const spaceNavTs = `/*
 * Navigation des espaces metier : source unique, alimentee par les
 * ROUTES REELLES declarees dans src/App.tsx. Chaque lien est verifie a
 * l execution du script fix-p3-layout.mjs (path="..." reel requis) ;
 * aucun chemin invente.
 *
 * Activation precise : /market et /investment melangent pages publiques
 * et espaces prives ; seuls les sous-chemins prives recoivent la
 * coquille espace. Le reste du site public reste sur Header/Footer.
 */
export interface LienEspace {
  to: string;
  label: string;
  icone?: string;
}

export interface GroupeEspace {
  titre: string;
  items: LienEspace[];
}

export interface EspaceDef {
  id: string;
  titre: string;
  groupes: GroupeEspace[];
}

export const ESPACES: EspaceDef[] = ${JSON.stringify(ESPACES, null, 2)};

const ACTIVATION: { id: string; test: (chemin: string) => boolean }[] = [
  { id: 'admin', test: (c) => c === '/admin' || c.startsWith('/admin/') },
  { id: 'app', test: (c) => c === '/app' || c.startsWith('/app/') },
  { id: 'farmer', test: (c) => c === '/farmer' || c.startsWith('/farmer/') },
  { id: 'organization', test: (c) => c === '/organization' || c.startsWith('/organization/') },
  { id: 'reviewer', test: (c) => c === '/reviewer' || c.startsWith('/reviewer/') },
  { id: 'developers', test: (c) => c === '/developers' || c.startsWith('/developers/') },
  { id: 'marche', test: (c) => /^\\/market\\/(app|listings\\/new|requests|reviews|transporters)/.test(c) },
  { id: 'investissement', test: (c) => /^\\/investment\\/(profile|projects|requests)/.test(c) },
];

export function resolveEspace(chemin: string): EspaceDef | null {
  const activation = ACTIVATION.find((entree) => entree.test(chemin));
  if (!activation) return null;
  return ESPACES.find((espace) => espace.id === activation.id) ?? null;
}
`;

const appLayoutTsx = `import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { IconeCloche } from '@/components/Icons';
import { Sidebar, useBreakpoint } from '@/design-system';
import { resolveEspace } from '@/lib/space-nav';
import { useAuthStore } from '@/store/auth';
import { Footer } from './Footer';
import { Header } from './Header';

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
  const user = useAuthStore((state) => state.user);
  const isAuthentifie = useAuthStore((state) => state.status === 'authenticated');
  const isMd = useBreakpoint('md');
  const isLg = useBreakpoint('lg');
  const [drawerOuvert, setDrawerOuvert] = useState(false);
  const [railReplie, setRailReplie] = useState(false);

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
            groupes={espace.groupes}
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
              groupes={espace.groupes}
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
`;

/* ------------------------------------------------------------------ */
/* 4. APPLICATION                                                      */
/* ------------------------------------------------------------------ */
if (!GEN) console.log('-- creation useBreakpoint.ts / Sidebar.tsx / space-nav.ts');
ecrire(path.join(RACINE, 'apps/web/src/design-system/hooks/useBreakpoint.ts'), useBreakpointTs);
ecrire(path.join(RACINE, 'apps/web/src/design-system/components/Sidebar.tsx'), sidebarTsx);
ecrire(path.join(RACINE, 'apps/web/src/lib/space-nav.ts'), spaceNavTs);

if (!GEN) console.log('-- rewrite AppLayout.tsx (public inchange, espace = rail)');
ecrire(path.join(RACINE, 'apps/web/src/components/layout/AppLayout.tsx'), appLayoutTsx);

if (!GEN) console.log('-- patch design-system/index.ts (exports)');
remplacerTout(
  'apps/web/src/design-system/index.ts',
  `export { cn } from './lib/utils';`,
  `export { cn } from './lib/utils';
export { useBreakpoint } from './hooks/useBreakpoint';
export type { Breakpoint } from './hooks/useBreakpoint';
export { Sidebar } from './components/Sidebar';
export type { SidebarGroup, SidebarItem, SidebarProps } from './components/Sidebar';`,
  1,
);

/* ------------------------------------------------------------------ */
/* 5. VERIFICATIONS POST                                               */
/* ------------------------------------------------------------------ */
if (!GEN) console.log('-- verifications post :');
post('f21bd9a4167baad28c5cf0f1e8edee45', 'apps/web/src/design-system/hooks/useBreakpoint.ts', [
  'matchMedia', '(min-width: 640px)', '(min-width: 768px)', '(min-width: 1024px)', '(min-width: 1280px)',
  'export function useBreakpoint',
]);
post('5450b8cab8e36aaf63e0778f5e3fb3cd', 'apps/web/src/design-system/components/Sidebar.tsx', [
  'export interface SidebarGroup', 'estActif', 'aria-current', "w-[250px]", "w-[72px]", 'export function Sidebar',
]);
post('f59e9130464ed50d80c917cf8fb5964b', 'apps/web/src/lib/space-nav.ts', [
  'export function resolveEspace', "'/admin'", "'/app'", "'/farmer'", "'/organization'", "'/reviewer'",
  "'/developers'", 'marche', 'investissement',
]);
post('a9feaacb73dacece73679ea6a23a1c86', 'apps/web/src/components/layout/AppLayout.tsx', [
  'resolveEspace', '<Sidebar', '<Header />', '<Footer />', "useBreakpoint('md')",
  'Visiter le site public', 'Ouvrir la navigation',
]);
{
  // index.ts : porte par cles uniquement (contenu reel non disponible en atelier).
  const p = path.join(RACINE, 'apps/web/src/design-system/index.ts');
  verifie(p, lire(p), ['useBreakpoint', 'Sidebar', "export { cn } from './lib/utils';"]);
  console.log('  [ok] design-system/index.ts = cles presentes');
}

{
  // I3 : aucun hex dans les composants (la palette vit dans index.css, couche jetons).
  for (const f of ['apps/web/src/design-system/components/Sidebar.tsx', 'apps/web/src/components/layout/AppLayout.tsx']) {
    const c = lire(path.join(RACINE, f));
    if (/(?<![-\w])#[0-9a-fA-F]{6}(?![-\w])/.test(c)) throw new Error('HEX_COMPOSANT ' + f);
  }
  console.log('  [ok] I3 : aucun hex dans Sidebar.tsx / AppLayout.tsx');
}

for (const f of [
  'apps/web/src/design-system/hooks/useBreakpoint.ts',
  'apps/web/src/design-system/components/Sidebar.tsx',
  'apps/web/src/lib/space-nav.ts',
  'apps/web/src/components/layout/AppLayout.tsx',
]) {
  const c = lire(path.join(RACINE, f));
  const bannis = nonAsciiHorsAccents(c);
  if (bannis) throw new Error('NON_ASCII_BANNI ' + f + ' : ' + bannis);
}

console.log('');
console.log('RECAP P3 :');
console.log('  useBreakpoint.ts / Sidebar.tsx / space-nav.ts crees');
console.log('  AppLayout.tsx : page-enter variante preserve ; public = Header/Footer inchanges ; espace = rail 250/72 + drawer');
console.log('  ' + nbLiens + ' liens de navigation = routes reelles du routeur');
console.log('  aucun hex composant, aucun npm, Header.tsx INTACT (md5 mission 1)');
console.log('');
console.log('BLOC_90_OK (si verifications npm web + mobile vertes)');
