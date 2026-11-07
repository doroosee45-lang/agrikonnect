/**
 * Palette officielle AGRIKONNECT AFRICA.
 *
 * Les valeurs de `COLORS` sont celles fournies par le client (charte V1→V5).
 * Les blocs `TINTS`, `SURFACES` et `DARK` en sont des dérivés assumés :
 * ils n'inventent aucune couleur de marque, ils déclinent les mêmes teintes
 * pour les fonds, les pastilles sémantiques et les sections sombres.
 */

import { VERT, TERRE, CREME, ENCRE, ROUGE } from './agrikonnect';

/**
 * Couleurs de l'application.
 *
 * **Les noms sont historiques, les valeurs sont celles des jetons
 * AGRIKONNECT AFRICA** (`./agrikonnect`). 206 écrans référencent ces noms ; les
 * renommer d'un coup aurait été une régression silencieuse. Les ancres ont donc
 * été repointées vers l'identité normative, et l'ensemble de l'application en
 * hérite sans modification.
 *
 * Pour du **nouveau** code, importer directement `VERT`, `TERRE`, `CREME`,
 * `ENCRE` de `./agrikonnect`. Écrire un code hexadécimal dans un écran reste
 * interdit (I3).
 */
export const COLORS = {
  /** Marque — `vert-800` #123d2a. */
  forestGreen: VERT[800],
  livingGreen: VERT[500],
  /**
   * Accent — `terre-700` #9c4423.
   *
   * L'ancienne valeur était un or (#D6A64F) absent de la palette normative.
   */
  /* A5 : l'or en TEXTE ou en trait sur fond clair → terre-700 (6,43:1 sur blanc). */
  gold: TERRE[700],
  /* A5 : l'or en SURFACE (badge, bandeau, fond) → terre-400, texte encre-900 (6,12:1). */
  goldSurface: TERRE[400],
  /* Texte à poser sur goldSurface. */
  onGoldSurface: ENCRE[900],
  /** Fond d'écran — `creme-100` #faf6ec. Jamais de blanc opaque en fond. */
  naturalWhite: CREME[100],
  pureWhite: '#FFFFFF',
  paleGreen: VERT[100],
  /** Texte courant — `encre-700` #33403a. Jamais de noir pur. */
  textPrimary: ENCRE[700],
  slateGray: ENCRE[500],
  lightBorder: 'rgba(18, 61, 42, 0.10)',

  success: VERT[600],
  /* A4 : terre-500 (#c46f33) ne tient pas AA en texte (3,70:1 sur blanc).
     terre-700 donne 6,43:1. terre-500 reste dans l'échelle pour les usages
     non textuels du rôle « attente » (filets, remplissages). */
  warning: TERRE[700],
  error: ROUGE[700],
  info: ENCRE[700],
  /** Surface surélevée — blanc à 85 %, sur le fond crème. */
  surface: 'rgba(255, 255, 255, 0.85)',
  /** Bordure plus marquée, pour les boutons secondaires. */
  bordureForte: 'rgba(18, 61, 42, 0.20)',
} as const;

/** Déclinaisons à faible opacité des couleurs sémantiques (pastilles, alertes). */
  /*
   * B1 — fonds de puce : les valeurs de la PALETTE, pas un calcul.
   *
   * La formule précédente (mix(base, blanc, 0.92)) écrasait les teintes : cinq
   * familles de puces tombaient sur deux blancs cassés indiscernables — écart
   * maximum de 3 unités de canal entre success/living/info/forest, et 3 entre
   * warning/error. La couleur ne codait plus rien (les libellés portaient seuls
   * le sens, H4 était respecté, mais le signal visuel avait disparu).
   *
   * Rôles et séparations, avec les valeurs réelles du dépôt :
   *   succès / mesuré → vert-100  #e0ece5 · texte vert-800  #123d2a · 10,02:1
   *   information     → vert-50   #f2f7f4 · texte vert-800  #123d2a · 11,23:1
   *   attention       → terre-100 #f5e3d8 · texte terre-800 #7d3620 ·  6,97:1
   *   erreur          → rouge-50  #fef2f2 · texte rouge-700 #b91c1c ·  5,91:1
   *   neutre          → creme-50  #fdfbf6 · texte encre-700 #33403a · 10,49:1
   *   écart de teinte : succès/attention 21 · succès/erreur 30 · attention/erreur 26
   *
   * B2 — terre-50 #fbf4ef n'est PAS utilisé pour l'attention : il n'est qu'à
   * 3 unités de rouge-50 #fef2f2, attention et erreur deviendraient
   * indistinguables. terre-100 est à 26 unités.
   */
export const TINTS = {
  successBg: VERT[100],
  warningBg: TERRE[100],
  errorBg: ROUGE[50],
  infoBg: VERT[50],

  goldBg: TERRE[100],
  livingGreenBg: VERT[100],
  forestGreenBg: VERT[100],

  /** Voile utilisé au-dessus des images (lisibilité du texte). */
  scrimLight: 'rgba(18, 61, 42, 0.32)',
  scrimStrong: 'rgba(14, 48, 34, 0.72)',
} as const;

/** Surfaces claires de l'application (site public + espaces métier). */
export const SURFACES = {
  canvas: COLORS.naturalWhite,
  card: COLORS.pureWhite,
  cardMuted: '#FBFCF9',
  border: COLORS.lightBorder,
  borderSoft: '#EAF0E9',
  text: COLORS.textPrimary,
  textMuted: COLORS.slateGray,
  accent: COLORS.forestGreen,
  accentSoft: COLORS.paleGreen,
} as const;

/**
 * Sections sombres : le vert forêt décliné en profondeurs.
 * Utilisé pour le footer premium, les blocs statistiques et l'écran de chargement.
 */
  /*
   * B2 — DARK recalculé depuis VERT[800] (#123d2a), formule unique :
   *   fond = mix(VERT[800], #000000, pas)  avec pas = 30 % / 18 % / 6 %
   * Texte creme-100 dessus : 14,10:1 / 12,98:1 / 11,88:1 — tous très au-dessus de AA.
   */
export const DARK = {
  bg: '#0d2b1d',
  bgAlt: '#0f3222',
  elevated: '#113927',
  border: 'rgba(250, 246, 236, 0.14)',
  borderStrong: 'rgba(250, 246, 236, 0.28)',
  text: CREME[100],
  textMuted: 'rgba(250, 246, 236, 0.68)',
  textFaint: 'rgba(250, 246, 236, 0.45)',
  gold: COLORS.goldSurface,
  green: COLORS.livingGreen,
} as const;

export type ColorToken = keyof typeof COLORS;

export const PALETTE_SWATCHES: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'forestGreen', hex: COLORS.forestGreen },
  { name: 'livingGreen', hex: COLORS.livingGreen },
  { name: 'gold', hex: COLORS.gold },
  { name: 'naturalWhite', hex: COLORS.naturalWhite },
  { name: 'paleGreen', hex: COLORS.paleGreen },
  { name: 'textPrimary', hex: COLORS.textPrimary },
  { name: 'slateGray', hex: COLORS.slateGray },
  { name: 'lightBorder', hex: COLORS.lightBorder },
];
