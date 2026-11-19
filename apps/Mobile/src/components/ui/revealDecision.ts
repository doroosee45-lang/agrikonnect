/**
 * Décision d'apparition d'un `Reveal` — fonction PURE (worklet), testée par
 * tests/reveal-decision.test.mts.
 *
 * Deux défauts corrigés :
 * 1. une mesure absente (vue pas encore mise en page) ne doit jamais laisser
 *    l'élément invisible pour toujours : l'appelant relance la mesure après
 *    `onLayout` ;
 * 2. une animation déjà lancée ne doit pas être relancée à chaque image de
 *    défilement (sinon l'élément n'apparaît qu'à l'arrêt du défilement).
 */
export type ActionReveal = 'show' | 'hide' | 'none';

export interface BoiteMesuree {
  pageY: number;
  height: number;
}

export function estVisible(boite: BoiteMesuree, hauteurEcran: number, seuil: number): boolean {
  'worklet';
  return boite.pageY < hauteurEcran * (1 - seuil) && boite.pageY + boite.height > 0;
}

export function decisionReveal(
  visible: boolean,
  etat: { lance: boolean; repeter: boolean; etaitVisible: boolean },
): ActionReveal {
  'worklet';
  if (visible && !etat.lance) return 'show';
  if (!visible && etat.repeter && etat.lance && etat.etaitVisible) return 'hide';
  return 'none';
}
