/**
 * Rythme vertical, rayons et gabarits (kit 4-5).
 * Rayons alignes sur l echelle du kit : sm 6, md 10, lg 12, xl 16, 2xl 20.
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

/** Rayons (kit 5). */
export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 16,
  xxl: 20,
  pill: 999,
} as const;

/** Marges d ecran et largeurs de contenu (le site public reste centre sur tablette). */
export const LAYOUT = {
  screenPadding: 20,
  gutter: 12,
  /** Unifie avec MOUVEMENT.conteneur et --max-content-width. */
  maxContentWidth: 1180,
  sectionGap: 64,
  cardMinWidth: 260,
  tabBarHeight: 68,
  navbarHeight: 58,
} as const;

/** Breakpoints (kit 16) : mobile < 640, tablette 640-1023, desktop >= 1024. */
export const BREAKPOINT = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

/** Tailles d icones normalisees : evite les tailles arbitraires dans les ecrans. */
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
