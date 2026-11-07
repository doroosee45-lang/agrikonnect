/**
 * Rythme vertical, rayons et gabarits.
 * Échelles ancrées sur les tokens fournis par le client : SPACING xs 4 → xxxl 48,
 * RADIUS sm 8 → pill 999. Les échelons intermédiaires sont des déductions
 * géométriques de ces deux bornes.
 */

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  pill: 999,
} as const;

/** Marges d'écran et largeurs de contenu (le site public reste centré sur tablette). */
export const LAYOUT = {
  screenPadding: 20,
  gutter: 12,
  maxContentWidth: 1180,
  sectionGap: 64,
  cardMinWidth: 260,
  tabBarHeight: 68,
  navbarHeight: 58,
} as const;

/** Tailles d'icônes normalisées : évite les tailles arbitraires dans les écrans. */
export const ICON_SIZE = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  hero: 48,
} as const;

export type SpacingToken = keyof typeof SPACING;
export type RadiusToken = keyof typeof RADIUS;
