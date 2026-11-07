import { type StyleProp, type ViewStyle } from 'react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { COLORS } from '@/theme/colors';
import { DURATION, EASE } from '@/theme/motion';
import { RADIUS, SPACING } from '@/theme/space';

/**
 * Squelette de chargement.
 *
 * Un balayage lumineux (jamais un clignotement d'opacité) : la lecture de la
 * structure reste stable pendant le fetch. La forme du squelette reprend la
 * forme du contenu réel pour éviter tout saut de mise en page.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = RADIUS.sm,
  style,
}: {
  width?: ViewStyle['width'];
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useSharedValue(-1);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1_200, easing: EASE.inOut }), -1, false);
  }, [progress]);

  const shimmer = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [-1, 1], [-420, 420]) }],
  }));

  return (
    <View style={[{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: COLORS.paleGreen }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, shimmer]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

export function SkeletonText({ lines = 3, style }: { lines?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: SPACING.sm }, style]}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} height={12} width={index === lines - 1 ? '62%' : '100%'} />
      ))}
    </View>
  );
}

export function SkeletonCard({ height = 150 }: { height?: number }) {
  return (
    <View style={{ gap: SPACING.md }}>
      <Skeleton height={height} radius={RADIUS.xl} />
      <Skeleton height={14} width="70%" />
      <Skeleton height={12} width="45%" />
    </View>
  );
}

/** Trois cartes en cours de chargement : état par défaut des listes publiques. */
export function SkeletonList({ count = 3, height = 150 }: { count?: number; height?: number }) {
  return (
    <View style={{ gap: SPACING.lg }}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} height={height} />
      ))}
    </View>
  );
}

export const SKELETON_DURATION = DURATION.slow;
