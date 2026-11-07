import { Easing } from 'react-native-reanimated';

/**
 * Chorégraphie : toutes les animations de l'application piochent ici.
 * Objectif : un mouvement court et net (jamais plus de 700 ms sur l'UI),
 * un rebond léger sur les appuis, des révélations au défilement décalées.
 */
export const DURATION = {
  instant: 120,
  fast: 180,
  base: 260,
  slow: 420,
  reveal: 620,
} as const;

export const EASE = {
  out: Easing.out(Easing.cubic),
  inOut: Easing.inOut(Easing.cubic),
  /** Accélération franche pour les entrées de cartes. */
  emphasize: Easing.bezier(0.16, 1, 0.3, 1),
  /** Décélération douce pour les sorties. */
  standard: Easing.bezier(0.4, 0, 0.2, 1),
  linear: Easing.linear,
} as const;

/** Ressorts : press = vif, layout = souple, sheet = amorti. */
export const SPRING = {
  press: { damping: 18, stiffness: 420, mass: 0.6 },
  card: { damping: 22, stiffness: 200, mass: 0.9 },
  sheet: { damping: 28, stiffness: 160, mass: 1 },
} as const;

/** Décalage entre deux éléments d'une même liste (effet cascade). */
export const STAGGER = {
  card: 70,
  listItem: 45,
  stat: 60,
} as const;

/** Distance de translation des révélations au défilement. */
export const REVEAL = {
  offsetY: 26,
  offsetYStrong: 44,
  offsetX: 18,
  scaleFrom: 0.96,
  /** Fraction de l'élément visible qui déclenche l'apparition. */
  threshold: 0.16,
} as const;

/** Pression : échelle cible et opacité du voile. */
export const PRESS = {
  scale: 0.972,
  scaleStrong: 0.955,
  dim: 0.06,
} as const;
