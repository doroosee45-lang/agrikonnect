import { createContext, useContext, type ReactNode } from 'react';
import { View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  measure,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { DURATION, EASE, REVEAL, STAGGER } from '@/theme/motion';
import { useMouvementReducit } from '@/hooks/useMouvementReducit';

/**
 * Révélation au défilement.
 *
 * Le conteneur de défilement (`<Screen scroll>`) publie sa position dans ce
 * contexte ; chaque `Reveal` mesure sa position à l'écran et s'anime quand il
 * entre dans le viewport. La mesure se fait dans le worklet : le thread JS
 * n'est jamais sollicité pendant le défilement.
 */
const ScrollYContext = createContext<SharedValue<number> | null>(null);

export function useScrollY(): SharedValue<number> | null {
  return useContext(ScrollYContext);
}

export const ScrollYProvider = ScrollYContext.Provider;

export type RevealVariant = 'up' | 'down' | 'left' | 'right' | 'scale' | 'fade';

export interface RevealProps {
  children: ReactNode;
  variant?: RevealVariant;
  /** Rang dans la liste : décale l'apparition (effet cascade). */
  index?: number;
  /** Délai explicite, prioritaire sur `index`. */
  delay?: number;
  /** Distance de translation ; `REVEAL.offsetY` par défaut. */
  distance?: number;
  /** Rejoue l'animation à chaque entrée dans le viewport. */
  repeat?: boolean;
  style?: StyleProp<ViewStyle>;
}

const DIRECTION: Record<RevealVariant, { x: number; y: number; scale: number }> = {
  up: { x: 0, y: 1, scale: 0 },
  down: { x: 0, y: -1, scale: 0 },
  left: { x: 1, y: 0, scale: 0 },
  right: { x: -1, y: 0, scale: 0 },
  scale: { x: 0, y: 0, scale: 1 },
  fade: { x: 0, y: 0, scale: 0 },
};

export function Reveal({
  children,
  variant = 'up',
  index = 0,
  delay,
  distance = REVEAL.offsetY,
  repeat = false,
  style,
}: RevealProps) {
  const scrollY = useScrollY();
  const { height } = useWindowDimensions();
  const ref = useAnimatedRef<Animated.View>();

  /*
   * Réglage système « réduire les animations » (§7.2).
   *
   * S'il est actif : **aucune translation, aucun zoom**, et un fondu court
   * conservé. Un déplacement de 22 px peut déclencher le mal des transports ;
   * un fondu seul, non. Le contenu doit de toute façon finir visible.
   */
  const mouvementReduit = useMouvementReducit();

  // Sans contexte de défilement (modale, en-tête fixe), on affiche directement.
  const progress = useSharedValue(scrollY ? 0 : 1);
  const stagger = mouvementReduit ? 0 : (delay ?? index * STAGGER.card);
  const direction = DIRECTION[variant];
  const viewportHeight = height;
  const threshold = REVEAL.threshold;
  const distanceReelle = mouvementReduit ? 0 : distance;
  const dureeReelle = mouvementReduit ? 150 : DURATION.reveal;

  useAnimatedReaction(
    () => {
      if (!scrollY) return null;
      const box = measure(ref);
      if (!box) return null;
      // La valeur du scroll fait partie du résultat pour que la mesure soit
      // recalculée à chaque défilement. Sans elle, seuls les éléments visibles
      // au premier rendu déclenchent leur animation ; le reste reste invisible.
      const scrollPosition = scrollY.value;
      const visible = box.pageY < viewportHeight * (1 - threshold) && box.pageY + box.height > 0;
      return { visible, scrollPosition };
    },
    (state, previous) => {
      if (state === null) return;
      if (state.visible && progress.value !== 1) {
        progress.value = withDelay(stagger, withTiming(1, { duration: dureeReelle, easing: EASE.emphasize }));
      } else if (!state.visible && repeat && previous?.visible) {
        progress.value = withTiming(0, { duration: DURATION.fast, easing: EASE.standard });
      }
    },
    [viewportHeight, stagger, dureeReelle, repeat],
  );

  const animatedStyle = useAnimatedStyle(() => {
    const offset = (1 - progress.value) * distanceReelle;
    return {
      opacity: progress.value,
      transform: [
        { translateX: offset * direction.x },
        { translateY: offset * direction.y },
        /*
         * Le zoom est **désactivé** quand le mouvement est réduit, pas seulement
         * raccourci : c'est le mouvement le plus susceptible d'incommoder.
         */
        {
          scale:
            direction.scale && distanceReelle > 0
              ? 1 - (1 - progress.value) * (1 - REVEAL.scaleFrom)
              : 1,
        },
      ],
    };
  }, [distanceReelle, direction.x, direction.y, direction.scale]);

  // Ces pages privilégient l’affichage intégral au déclenchement animé. Un
  // rendu natif simple évite qu’une opacité Reanimated masque le contenu ou le
  // footer si le moteur d’animation ne reçoit pas les événements de scroll.
  if (!scrollY) {
    return <View style={style}>{children}</View>;
  }

  return (
    <Animated.View ref={ref} style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

/** Reveal horizontal plein cadre : utilisé pour les bandes de statistiques. */
export function RevealScale({ children, index = 0, style }: Pick<RevealProps, 'children' | 'index' | 'style'>) {
  return (
    <Reveal variant="scale" index={index} style={style} distance={0}>
      {children}
    </Reveal>
  );
}
