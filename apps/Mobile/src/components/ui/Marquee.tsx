import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { SPACING } from '@/theme/space';

export interface MarqueeProps {
  children: React.ReactNode;
  /** Vitesse en points par seconde. */
  speed?: number;
  gap?: number;
  /** Met en pause (accessibilité : respect du mouvement réduit côté parent). */
  paused?: boolean;
}

/**
 * Défilement continu (logos partenaires, bandeaux d'information).
 *
 * Le contenu est dupliqué une fois et la translation repart de la largeur d'une
 * copie : la boucle est invisible. L'animation tourne sur le thread UI, elle ne
 * coûte rien au défilement de la page.
 */
export function Marquee({ children, speed = 42, gap = SPACING.xxl, paused = false }: MarqueeProps) {
  const [copyWidth, setCopyWidth] = useState(0);
  const translate = useSharedValue(0);

  useEffect(() => {
    if (!copyWidth || paused) {
      translate.value = 0;
      return;
    }
    const duration = (copyWidth / speed) * 1000;
    translate.value = withRepeat(withTiming(-copyWidth, { duration, easing: Easing.linear }), -1, false);
  }, [copyWidth, speed, paused, translate]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translate.value }],
  }));

  return (
    <View style={{ overflow: 'hidden', width: '100%' }}>
      <Animated.View style={[{ flexDirection: 'row', width: 'auto' }, animatedStyle]}>
        <View
          onLayout={(event) => setCopyWidth(event.nativeEvent.layout.width)}
          style={{ flexDirection: 'row', gap, paddingRight: gap }}
        >
          {children}
        </View>
        <View style={{ flexDirection: 'row', gap, paddingRight: gap }} aria-hidden>
          {children}
        </View>
      </Animated.View>
    </View>
  );
}
