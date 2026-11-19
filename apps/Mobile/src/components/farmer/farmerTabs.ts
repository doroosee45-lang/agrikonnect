/**
 * Onglets de l'espace producteur — logique PURE (testée : tests/farmer-tabs.test.mts).
 *
 * Expo Router transmet à une barre d'onglets personnalisée TOUTES les routes
 * du dossier `src/app/farmer` (47 aujourd'hui : détails, créations, réglages…),
 * et `href: null` n'y est qu'une option `hidden` que seule la barre par défaut
 * respecte. La barre doit donc filtrer elle-même : on n'affiche que cette
 * liste fermée, dans cet ordre.
 *
 * Les noms sont ceux des routes du groupe `farmer/(tabs)` (voir son _layout).
 * Défense en profondeur : si d'autres routes arrivent jusqu'ici, elles sont
 * ignorées, et un détail `farms/…` / `plots/…` met en évidence son onglet.
 */
export const ONGLETS_PRODUCTEUR = ['index', 'farms', 'plots', 'productions', 'soil'] as const;

export type OngletProducteur = (typeof ONGLETS_PRODUCTEUR)[number];

/** Onglet à mettre en évidence pour une route (un détail d'exploitation reste sous « Exploitations »). */
export function ongletDeRoute(nomRoute: string): OngletProducteur | null {
  if ((ONGLETS_PRODUCTEUR as readonly string[]).includes(nomRoute)) return nomRoute as OngletProducteur;
  if (nomRoute.startsWith('farms/')) return 'farms';
  if (nomRoute.startsWith('plots/')) return 'plots';
  return null;
}

export interface RouteOnglet {
  name: string;
  key: string;
}

/**
 * Ce qu'Expo Router 58 transmet réellement à une barre personnalisée :
 * `{ state, descriptors, emitter, navigateToTab, insets }` — PAS d'objet
 * `navigation`. L'ancien code appelait `navigation.navigate(...)` : chaque appui
 * sur un onglet levait « Cannot read properties of undefined (reading
 * 'navigate') » et l'onglet ne répondait pas. `navigation` reste accepté en
 * repli pour une version qui le fournirait encore.
 */
export interface NavigationOnglets {
  emitter?: {
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented?: boolean };
  };
  navigateToTab?: (routeKey: string) => void;
  navigation?: { navigate: (name: string) => void };
}

/** Appui sur un onglet : même règle que la barre par défaut d'Expo Router. Renvoie l'action effectuée. */
export function appuyerOnglet(
  route: RouteOnglet,
  actif: boolean,
  nav: NavigationOnglets,
): 'navigate' | 'ignore' | 'indisponible' {
  const evenement = nav.emitter?.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
  if (actif || evenement?.defaultPrevented) return 'ignore';
  if (nav.navigateToTab) {
    nav.navigateToTab(route.key);
    return 'navigate';
  }
  if (nav.navigation?.navigate) {
    nav.navigation.navigate(route.name);
    return 'navigate';
  }
  return 'indisponible';
}

/**
 * Routes à afficher (ordre de `ONGLETS_PRODUCTEUR`) et position de l'onglet
 * actif parmi elles (-1 si la route courante n'appartient à aucun onglet,
 * par exemple « Alertes » ouverte depuis l'accueil).
 */
export function ongletsVisibles<R extends RouteOnglet>(
  routes: readonly R[],
  indexCourant: number,
): { onglets: R[]; actif: number } {
  const onglets = ONGLETS_PRODUCTEUR.map((nom) => routes.find((route) => route.name === nom)).filter(
    (route): route is R => Boolean(route),
  );
  const courante = routes[indexCourant];
  const cible = courante ? ongletDeRoute(courante.name) : null;
  return { onglets, actif: cible ? onglets.findIndex((route) => route.name === cible) : -1 };
}
