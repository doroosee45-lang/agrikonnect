import { VERT, TERRE, CREME, ENCRE, BLANC, ROUGE } from './agrikonnect';

/**
 * Couleurs de l'application.
 *
 * **Les noms sont historiques, les valeurs sont celles des jetons
 * AGRIKONNECT AFRICA** (`./agrikonnect`). 157 pages web et 206 écrans mobile
 * référencent ces noms ; les renommer d'un coup aurait été une régression
 * silencieuse. Les ancres ont donc été repointées vers l'identité normative, et
 * l'ensemble de l'application en hérite sans modification.
 *
 * Pour du **nouveau** code, importer directement `VERT`, `TERRE`, `CREME`,
 * `ENCRE` de `./agrikonnect` : ces noms-là disent ce qu'ils sont.
 *
 * Écrire un code hexadécimal dans un composant reste interdit (I3).
 */
export const COLORS = {
  /** Marque — `vert-800` #123d2a. */
  forestGreen: VERT[800],
  livingGreen: VERT[500],
  /**
   * Accent — `terre-700` #9c4423.
   *
   * L'ancienne valeur était un or (#D6A64F) qui n'existe pas dans la palette
   * normative. Repointé sur l'accent terre : c'est le rôle que ce jeton joue
   * partout où il est utilisé (sur-titres, parcours partenaire, filets).
   */
  /* A5 : l'or en TEXTE ou en trait sur fond clair → terre-700 (6,43:1 sur blanc). */
  gold: TERRE[700],
  /* A5 : l'or en SURFACE (badge, bandeau, fond) → terre-400, texte encre-900 (6,12:1). */
  goldSurface: TERRE[700],
  /* Texte à poser sur goldSurface. */
  onGoldSurface: ENCRE[900],
  /** Fond de page — `creme-100` #faf6ec. Jamais de blanc opaque en fond. */
  naturalWhite: CREME[100],
  pureWhite: '#FFFFFF',
  paleGreen: VERT[100],
  /** Texte courant — `encre-700` #33403a. Jamais de noir pur. */
  textPrimary: ENCRE[700],
  /** Texte secondaire — `encre-500`. */
  slateGray: ENCRE[500],
  /** Bordure — vert de marque à 10 %. */
  lightBorder: 'rgba(18, 61, 42, 0.10)',
  success: VERT[600],
  /* A4 : terre-500 (#c46f33) ne tient pas AA en texte (3,70:1 sur blanc).
     terre-700 donne 6,43:1. terre-500 reste dans l'échelle pour les usages
     non textuels du rôle « attente » (filets, remplissages). */
  warning: TERRE[500],
  error: ROUGE[700],
  info: ENCRE[700],
  /**
   * Surface surélevée — blanc à 85 %.
   *
   * Ajoutée parce que le système normatif distingue le fond crème de la surface
   * posée dessus, et que l'ancien jeu n'avait que du blanc opaque.
   */
  surface: BLANC[85],
} as const;

export const TINTS = {
  forestGreenBg: 'rgba(23, 77, 53, 0.1)',
  livingGreenBg: 'rgba(101, 166, 75, 0.1)',
  goldBg: 'rgba(214, 166, 79, 0.1)',
  infoBg: 'rgba(62, 110, 142, 0.1)',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const LAYOUT = {
  maxContentWidth: 1180,
  headerHeight: 72,
} as const;

export const DURATION = {
  fast: 150,
  base: 250,
  slow: 400,
} as const;

export const EASE = {
  out: [0.16, 1, 0.3, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
};
