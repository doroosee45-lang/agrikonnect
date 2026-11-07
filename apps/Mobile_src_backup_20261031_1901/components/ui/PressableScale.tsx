import { useCallback } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { DURATION, EASE, PRESS, SPRING } from '@/theme/motion';
import { VERT } from '../../theme/agrikonnect';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Échelle à l'appui : `PRESS.scale` par défaut, `PRESS.scaleStrong` pour les CTA. */
  scaleTo?: number;
  /** Retour haptique (iOS/Android uniquement, silencieux sur web). */
  haptic?: boolean;
  /** Sur web : léger décalage + resserrement de l'ombre au survol. */
  liftOnHover?: boolean;
}

function tap() {
  if (Platform.OS === 'web') return;
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    /* le moteur haptique peut être indisponible : on ne bloque jamais un appui */
  }
}

/**
 * Le primitif d'interaction de l'application.
 *
 * Tout ce qui se touche passe par là : un ressort court à l'appui (jamais une
 * transition linéaire), un relâchement légèrement plus lent que la pression, et
 * un retour haptique sur mobile. Le ressort tourne sur le thread UI, donc
 * l'animation reste fluide même si le thread JS est occupé par un fetch.
 */
export function PressableScale({
  children,
  style,
  onPress,
  onPressIn,
  onPressOut,
  scaleTo = PRESS.scale,
  haptic = true,
  liftOnHover = true,
  disabled,
  ...rest
}: PressableScaleProps) {
  const pressed = useSharedValue(0);
  const hovered = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = withSpring(
      interpolate(pressed.value, [0, 1], [1, scaleTo]),
      pressed.value === 1 ? SPRING.press : { ...SPRING.press, damping: 26 },
    );
    const hoverLift = liftOnHover && Platform.OS === 'web' ? hovered.value : 0;

    return {
      transform: [{ scale }, { translateY: withTiming(hoverLift * -2, { duration: DURATION.fast }) }],
      opacity: disabled ? 0.5 : 1,
    };
  }, [scaleTo, disabled, liftOnHover]);

  const handlePressIn = useCallback(
    (event: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) => {
      pressed.value = 1;
      onPressIn?.(event);
    },
    [onPressIn, pressed],
  );

  const handlePressOut = useCallback(
    (event: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) => {
      pressed.value = 0;
      onPressOut?.(event);
    },
    [onPressOut, pressed],
  );

  const handleHover = useCallback(
    (event: { hovering: boolean }) => {
      hovered.value = withTiming(event.hovering ? 1 : 0, { duration: DURATION.fast, easing: EASE.out });
    },
    [hovered],
  );

  const handlePress = useCallback(
    (event: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
      if (haptic) tap();
      onPress?.(event);
    },
    [haptic, onPress],
  );

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPress={disabled ? undefined : handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onHoverIn={Platform.OS === 'web' ? () => handleHover({ hovering: true }) : undefined}
      onHoverOut={Platform.OS === 'web' ? () => handleHover({ hovering: false }) : undefined}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Voile d'appui : à poser par-dessus le contenu d'une carte pressable. */
export function PressOverlay({ pressed }: { pressed: boolean }) {
  const opacity = useSharedValue(0);
  opacity.value = withTiming(pressed ? PRESS.dim : 0, { duration: DURATION.instant });
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: VERT[950] }, style]}
    />
  );
}
