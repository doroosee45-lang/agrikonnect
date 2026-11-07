/**
 * Jetons AGRIKONNECT AFRICA.
 *
 * Source normative : `CONSIGNES-AGENT-AGRIKONNECT.md` §3 et `design-tokens.json`.
 * **Ces valeurs ne se discutent pas** : elles sont l'identité de marque. Toute
 * nouvelle couleur passe par ce fichier, jamais par un composant.
 *
 * ## Pourquoi ce fichier coexiste avec `index.ts`
 *
 * L'application existante nomme ses couleurs autrement (`forestGreen`, `gold`,
 * `naturalWhite`…) et 157 pages web plus 206 écrans mobile s'y réfèrent. Les
 * renommer d'un coup serait une régression silencieuse. `colors.ts` **repointe
 * donc ses ancres vers les valeurs ci-dessous** : l'identité bascule partout en
 * une fois, sans toucher aux écrans. Les anciens noms restent des alias.
 *
 * Ce fichier est **identique à celui du web** (`apps/web/src/theme/agrikonnect.ts`)
 * : les deux plateformes doivent porter exactement les mêmes valeurs. Toute
 * modification se fait dans les deux.
 *
 * ## Ce qui est interdit (I3)
 *
 * Écrire `#123d2a` dans un composant. On importe `VERT[800]`, ou on utilise la
 * variable CSS `--vert-800`.
 */

/* ====== Vert — marque ====== */

export const VERT = {
  50: '#f2f7f4',
  100: '#e0ece5',
  200: '#c2d9cb',
  300: '#9cbfaa',
  400: '#6f9e83',
  500: '#4b7f63',
  600: '#2f6249',
  700: '#1e4f38',
  /** #123d2a — la marque. C'est cette valeur, pas une autre. */
  800: '#123d2a',
  /** #0e3022 — texte titre (§3). */
  900: '#0e3022',
  950: '#071a12',
} as const;

/* ====== Terre — accent ====== */

export const TERRE = {
  50: '#fbf4ef',
  100: '#f5e3d8',
  200: '#e9c4ac',
  300: '#e0a982',
  /** #db8a4c — les traits, filets et soulignements décoratifs. */
  400: '#db8a4c',
  500: '#c46f33',
  600: '#b05a27',
  /** #9c4423 — l'accent : sur-titres, parcours partenaire. */
  700: '#9c4423',
  800: '#7d3620',
  900: '#5f2a1a',
} as const;

/* ====== Crème — fonds ====== */

export const CREME = {
  50: '#fdfbf6',
  /** #faf6ec — le fond de page. C'est cette valeur, pas du blanc. */
  100: '#faf6ec',
  200: '#f0e8d8',
  300: '#e2d6c0',
} as const;

/* ====== Encre — texte ====== */

export const ENCRE = {
  /** Texte secondaire. */
  /** #5c665f — texte secondaire (§3). Contraste 5,53:1 sur creme-100. */
  500: '#5c665f',
  /** #33403a — le texte courant. Jamais de noir pur. */
  700: '#33403a',
  /** Titres. */
  900: '#1f2a24',
} as const;

/* ====== Blanc — surfaces, en opacité ====== */

export const BLANC = {
  40: 'rgba(255, 255, 255, 0.40)',
  55: 'rgba(255, 255, 255, 0.55)',
  70: 'rgba(255, 255, 255, 0.70)',
  /** La surface surélevée : blanc à 85 %, jamais opaque sur le fond crème. */
  85: 'rgba(255, 255, 255, 0.85)',
  95: 'rgba(255, 255, 255, 0.95)',
} as const;

/* ====== Rouge — uniquement l'erreur ====== */

export const ROUGE = {
  /** #fef2f2 — fond d'erreur (§3). */
  50: '#fef2f2',
  100: '#fbe4e2',
  300: '#eda9a3',
  400: '#e07a72',
  500: '#cf4f45',
  /** #b91c1c — l'erreur (§3). */
  700: '#b91c1c',
  800: '#7d231d',
} as const;

/**
 * Sémantique métier imposée (§3.4).
 *
 * Un badge porte **un** état. Jamais deux couleurs de sens opposé dans le même
 * badge, et jamais une information portée par la couleur seule (A11) : le
 * libellé et l'icône accompagnent toujours.
 */
export const SEMANTIQUE = {
  fiabiliteBasse: { fond: TERRE[100], texte: TERRE[800] },
  fiabiliteHaute: { fond: VERT[100], texte: VERT[800] },
  identiteVerifiee: VERT[600],
  identiteEnAttente: TERRE[500],
  annonceActive: { fond: VERT[100], texte: VERT[800] },
  annonceExpiree: { fond: CREME[200], texte: ENCRE[500] },
  erreur: ROUGE[700],
} as const;

/**
 * Typographie.
 *
 * **Aucune police n'est téléchargée** (I4) : les deux familles sont des piles
 * système. `serif` pour les titres, `sans` pour tout le reste. Ne jamais forcer
 * le serif sur un paragraphe, sauf citation éditoriale longue.
 */
export const TEXTE = {
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
} as const;

/**
 * Échelle autorisée (§4.2), en pixels.
 *
 * **Six tailles maximum par écran.** Toute valeur hors de cette liste doit être
 * justifiée dans le message de commit.
 */
export const TAILLES = {
  /** h1 — titre de page. */
  titrePage: 26,
  titrePageLarge: 32,
  /** h2 — titre de section. */
  titreSection: 24,
  /** h3 — sous-titre de carte. */
  sousTitre: 17,
  /** Corps de texte. */
  corps: 15,
  corpsBase: 16,
  /** Corps dense : tableaux, listes. */
  dense: 12.5,
  /** Aide sous un champ. */
  aide: 12,
  /** Sur-titre en majuscules. */
  surtitre: 11,
  /** Mention légale. */
  mention: 11.5,
} as const;

/* ====== Géométrie ====== */

export const RAYON = {
  /** Cartes : 20 px (§13). */
  carte: 20,
  champ: 12,
  pilule: 999,
} as const;

export const ESPACEMENT = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/**
 * Cibles tactiles minimales.
 *
 * 44 px sur le web, **48 pt sur mobile** (I14). Ces valeurs ne se réduisent pas
 * pour faire tenir une mise en page : on agrandit la zone, pas seulement
 * l'icône.
 */
export const TACTILE = {
  web: 44,
  mobile: 48,
  ecart: 8,
} as const;

/**
 * Mouvement (§7).
 *
 * **Seuls `opacity` et `transform` s'animent** (I5). Animer `height`, `width`,
 * `top`, `left`, `margin`, `box-shadow` ou `filter` est interdit. La courbe est
 * imposée, et tout doit être neutralisé quand le système demande de réduire les
 * animations.
 */
export const MOUVEMENT = {
  /** Courbe imposée — ne pas en inventer d'autre. */
  courbe: 'cubic-bezier(.22,.61,.36,1)',
  /** Apparition au défilement. */
  apparition: 700,
  /** Translation de l'apparition. */
  decalage: 22,
  /** Transition d'écran. */
  ecran: 500,
  /** Survol de carte. */
  carte: 300,
  /** Échelonnement dans une grille : 40 à 90 ms, jamais plus de 140. */
  echelonnement: 70,
  echelonnementMax: 140,
  /** Zoom de photo. */
  zoomPhoto: 1200,
  /** Largeur du conteneur, bloquée à partir de 1536 px. */
  conteneur: 1152,
} as const;
