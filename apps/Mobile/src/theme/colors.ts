/**
 * Palette de l application mobile : aliases des jetons AGRIKONNECT (kit v1.0).
 *
 * Les noms sont historiques, les valeurs sont celles de ./agrikonnect.
 * 206 ecrans referencent ces noms ; ne pas les renommer. Pour du nouveau
 * code, importer directement VERT, TERRE, CREME, ENCRE, SCIENTIFIQUE ou
 * FONCTION.
 *
 * I3 : ecrire un code hexadecimal dans un ecran reste interdit.
 * AA : les rôles texte prennent les etapes derivees ; les couleurs exactes
 * du kit restent aux remplissages avec libelle (kit 2.2).
 */

import { VERT, TERRE, CREME, ENCRE, ROUGE, SCIENTIFIQUE, FONCTION } from './agrikonnect';

export const COLORS = {
  /** Marque -- kit primary-900 #124c34. */
  forestGreen: VERT[800],
  livingGreen: VERT[500],
  /** Accent en TEXTE -- terre-700 derive AA. */
  gold: TERRE[700],
  /** Accent en SURFACE -- terre-400, texte encre-900 : 7,32:1. */
  goldSurface: TERRE[400],
  onGoldSurface: ENCRE[900],
  /** Fond d ecran -- kit background #f5f8f5. */
  naturalWhite: CREME[100],
  pureWhite: '#FFFFFF',
  paleGreen: VERT[100],
  /** kit text-primary #17231d. 15,16:1 sur le fond. */
  textPrimary: ENCRE[700],
  slateGray: ENCRE[500],
  /** kit border #e3eae5. */
  lightBorder: '#E3EAE5',
  success: VERT[700],
  warning: TERRE[700],
  error: ROUGE[700],
  /** Information en texte -- kit scientific-900. */
  info: SCIENTIFIQUE[900],
  /** kit surface #ffffff : cartes et panneaux. */
  surface: '#FFFFFF',
  /** Bordure plus marquee, pour les boutons secondaires. */
  bordureForte: 'rgba(18, 76, 52, 0.22)',
} as const;

/**
 * Fonds de puces (B1) : les valeurs de la PALETTE, pas un calcul.
 *
 * Rôles et separations, avec les contrastes reels du kit v1.0 :
 *   succes / mesure -> vert-100 #e6f3ec, texte vert-800 #124c34 : 8,72:1
 *   information     -> scientifique-100 #e4eef8, texte #17324d : 11,18:1
 *   attention       -> terre-100 #f0e2cc, texte terre-800 #6e4c1d : 6,06:1
 *   erreur          -> rouge-50 #fef2f2, texte rouge-700 #b42318 : 6,01:1
 *   neutre          -> creme-50 #fafbfa, texte encre-700 #17231d : 15,64:1
 * La couleur ne code jamais seule le sens (A11) : libelle + icone.
 */
export const TINTS = {
  successBg: VERT[100],
  warningBg: TERRE[100],
  errorBg: ROUGE[50],
  infoBg: SCIENTIFIQUE[100],

  goldBg: TERRE[100],
  livingGreenBg: VERT[100],
  forestGreenBg: VERT[100],

  /** Voile utilise au-dessus des images (lisibilite du texte). */
  scrimLight: 'rgba(18, 76, 52, 0.32)',
  scrimStrong: 'rgba(14, 58, 41, 0.72)',
} as const;

/** Surfaces de l application (kit background/surface/border). */
export const SURFACES = {
  canvas: COLORS.naturalWhite,
  card: COLORS.pureWhite,
  cardMuted: '#FBFCF9',
  border: COLORS.lightBorder,
  borderSoft: '#EBF0EC',
  text: COLORS.textPrimary,
  textMuted: COLORS.slateGray,
  accent: COLORS.forestGreen,
  accentSoft: COLORS.paleGreen,
} as const;

/**
 * Sections sombres : le vert de marque decline en profondeurs.
 * Formule : mix(VERT[800] #124c34, noir, 30 % / 18 % / 6 %).
 */
export const DARK = {
  bg: '#0d3524',
  bgAlt: '#0f3e2b',
  elevated: '#114731',
  border: 'rgba(245, 248, 245, 0.14)',
  borderStrong: 'rgba(245, 248, 245, 0.28)',
  text: CREME[100],
  textMuted: 'rgba(245, 248, 245, 0.68)',
  textFaint: 'rgba(245, 248, 245, 0.45)',
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
