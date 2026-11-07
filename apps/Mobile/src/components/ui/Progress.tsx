import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { COLORS } from '@/theme/colors';
import { DURATION, EASE } from '@/theme/motion';
import { RADIUS } from '@/theme/space';

export type ProgressTone = 'green' | 'gold' | 'info';

const TONES: Record<ProgressTone, string> = {
  green: COLORS.livingGreen,
  gold: COLORS.gold,
  info: COLORS.info,
};

/**
 * Barre de progression animée. La valeur affichée est toujours une donnée
 * réelle fournie par l'API : le composant n'extrapole rien.
 */
export function Progress({
  value,
  tone = 'green',
  height = 6,
}: {
  /** Pourcentage 0 → 100. */
  value: number;
  tone?: ProgressTone;
  height?: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(Math.min(100, Math.max(0, value)) / 100, {
      duration: DURATION.reveal,
      easing: EASE.emphasize,
    });
  }, [value, progress]);

  const style = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View style={[styles.track, { height, borderRadius: RADIUS.pill }]}>
      <Animated.View style={[styles.fill, style, { height, borderRadius: RADIUS.pill, backgroundColor: TONES[tone] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: COLORS.lightBorder, overflow: 'hidden' },
  fill: { width: '0%' },
});
