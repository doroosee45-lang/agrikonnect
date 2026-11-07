/**
 * Aliases web : les noms historiques de couleurs, geometrie et mouvement.
 *
 * Les noms sont historiques, les valeurs sont celles des jetons AGRIKONNECT
 * (./agrikonnect, kit v1.0). 157 pages referencent ces noms ; ne pas les
 * renommer. Pour du nouveau code, importer directement VERT, TERRE, CREME,
 * ENCRE, SCIENTIFIQUE ou FONCTION.
 *
 * I3 : ecrire un code hexadecimal dans un composant reste interdit.
 */
import { VERT, TERRE, CREME, ENCRE, BLANC, ROUGE, SCIENTIFIQUE, FONCTION } from './agrikonnect';

/**
 * Couleurs de l application.
 *
 * Regle AA : quand une couleur du kit echoue au contraste texte, le role
 * texte prend une etape derivee (VERT[700], TERRE[700], ROUGE[700],
 * SCIENTIFIQUE[900]) et la couleur du kit reste aux remplissages via
 * les roles *Surface et FONCTION.
 */
export const COLORS = {
  /** Marque -- kit primary-900 #124c34. */
  forestGreen: VERT[800],
  /** kit primary-500 #239b68. */
  livingGreen: VERT[500],
  /** Accent en TEXTE -- terre-700 derive AA : 5,83:1 sur blanc. */
  gold: TERRE[700],
  /** Accent en SURFACE -- terre-400, texte encre-900 : 7,32:1. */
  goldSurface: TERRE[400],
  /** Texte a poser sur goldSurface. */
  onGoldSurface: ENCRE[900],
  /** Fond de page -- kit background #f5f8f5. */
  naturalWhite: CREME[100],
  pureWhite: '#FFFFFF',
  paleGreen: VERT[100],
  /** kit text-primary #17231d. 15,16:1 sur le fond. */
  textPrimary: ENCRE[700],
  /** kit text-secondary #64736a. 4,67:1 sur le fond. */
  slateGray: ENCRE[500],
  /** kit border #e3eae5. */
  lightBorder: '#E3EAE5',
  /** Succes en texte/icône -- vert-700 (5,70:1 sur vert-100). */
  success: VERT[700],
  /** Attention en texte -- terre-700 (4,57:1 sur terre-100). */
  warning: TERRE[700],
  /** Erreur en texte -- rouge-700 (6,01:1 sur rouge-50). */
  error: ROUGE[700],
  /** Information en texte -- kit scientific-900 (11,18:1 sur scientifique-100). */
  info: SCIENTIFIQUE[900],
  /** kit surface #ffffff : cartes et panneaux. */
  surface: '#FFFFFF',
  /** kit scientific-500 : remplissages et icones information. */
  infoSurface: SCIENTIFIQUE[500],
  /** kit disabled #a3ada6. */
  desactive: FONCTION.desactive,
} as const;

export const TINTS = {
  forestGreenBg: 'rgba(18, 76, 52, 0.1)',
  livingGreenBg: 'rgba(35, 155, 104, 0.1)',
  goldBg: 'rgba(208, 154, 85, 0.1)',
  infoBg: 'rgba(40, 120, 200, 0.1)',
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

/** Rayons (kit 5) : sm 6, md 10, lg 12, xl 16, 2xl 20, pilule. */
export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 16,
  xxl: 20,
  pill: 999,
} as const;

export const LAYOUT = {
  /** Largeur du conteneur, unifiee avec MOUVEMENT.conteneur et tokens.css. */
  maxContentWidth: 1180,
  headerHeight: 72,
} as const;

/** Breakpoints (kit 16) : mobile < 640, tablette 640-1023, desktop >= 1024. */
export const BREAKPOINT = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
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
