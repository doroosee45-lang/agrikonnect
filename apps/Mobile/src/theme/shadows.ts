import type { ViewStyle } from 'react-native';

import { COLORS } from './colors';
import { BLANC, CREME, TERRE, VERT } from './agrikonnect';

const GREEN_SHADOW = 'rgba(18, 76, 52, 0.10)';
const GREEN_SHADOW_SOFT = 'rgba(18, 76, 52, 0.06)';

/**
 * Ombres : volontairement vertes et diffuses plutot que grises,
 * pour rester dans la charte (le vert de marque est la couleur d ombre).
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
    shadowColor: 'rgba(208, 154, 85, 0.35)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 5,
  },
};

/** Degradés réutilisables (expo-linear-gradient). */
export const GRADIENTS = {
  forest: [VERT[800], VERT[900]] as const,
  forestSoft: ['#176b45', COLORS.forestGreen] as const,
  gold: [TERRE[300], COLORS.goldSurface] as const,
  leaf: [VERT[500], VERT[600]] as const,
  scrimBottom: ['rgba(14, 58, 41, 0)', 'rgba(14, 58, 41, 0.85)'] as const,
  scrimTop: ['rgba(14, 58, 41, 0.55)', 'rgba(14, 58, 41, 0)'] as const,
  paper: [BLANC[95], CREME[50]] as const,
} as const;
