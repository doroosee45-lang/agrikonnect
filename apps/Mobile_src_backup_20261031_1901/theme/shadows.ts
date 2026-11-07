import type { ViewStyle } from 'react-native';

import { COLORS } from './colors';
import { BLANC, CREME, TERRE, VERT } from './agrikonnect';

const GREEN_SHADOW = 'rgba(23, 77, 53, 0.10)';
const GREEN_SHADOW_SOFT = 'rgba(23, 77, 53, 0.06)';

/**
 * Ombres : volontairement vertes et diffuses plutôt que grises,
 * pour rester dans la charte (le vert forêt est la couleur d'ombre de la marque).
 */
export const SHADOWS: Record<'hairline' | 'card' | 'lifted' | 'floating' | 'gold', ViewStyle> = {
  hairline: {
    shadowColor: GREEN_SHADOW_SOFT,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 1,
  },
  card: {
    shadowColor: GREEN_SHADOW_SOFT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  lifted: {
    shadowColor: GREEN_SHADOW,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 6,
  },
  floating: {
    shadowColor: GREEN_SHADOW,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 10,
  },
  gold: {
    shadowColor: 'rgba(219, 138, 76, 0.35)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 5,
  },
};

/** Dégradés réutilisables (expo-linear-gradient). */
export const GRADIENTS = {
  forest: [VERT[800], VERT[900]] as const,
  forestSoft: ['#1B5A3E', COLORS.forestGreen] as const,
  /* A5 : l'or en surface devient terre-400. Dégradé terre-300 → terre-400,
     texte encre-900 dessus : 8,88:1 puis 6,12:1. */
  gold: [TERRE[300], COLORS.goldSurface] as const,
  leaf: [VERT[500], VERT[600]] as const,
  scrimBottom: ['rgba(14, 48, 34, 0)', 'rgba(14, 48, 34, 0.85)'] as const,
  scrimTop: ['rgba(14, 48, 34, 0.55)', 'rgba(14, 48, 34, 0)'] as const,
  paper: [BLANC[95], CREME[50]] as const,
} as const;
