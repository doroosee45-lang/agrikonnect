import { useEffect, useRef, useState } from 'react';
import {
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { formatNumber, type Locale } from '@/lib/format';
import { DURATION, EASE } from '@/theme/motion';

import { Text, type TextProps } from './Text';

/**
 * Compteur animé.
 *
 * Utilisé uniquement pour des chiffres réellement présents dans les données :
 * l'animation ne crée aucune valeur, elle déroule celles que l'API a renvoyées.
 * Le `runOnJS` n'est déclenché que lorsque la valeur affichée change, ce qui
 * évite de saturer le thread JS pendant l'animation.
 */
export function StatCounter({
  value,
  locale = 'fr',
  decimals = 0,
  duration = DURATION.reveal * 2,
  prefix,
  suffix,
  ...textProps
}: {
  value: number;
  locale?: Locale;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
} & Omit<TextProps, 'children'>) {
  const [display, setDisplay] = useState(0);
  const progress = useSharedValue(0);
  const lastRendered = useRef(Number.MIN_SAFE_INTEGER);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration, easing: EASE.emphasize });
  }, [value, duration, progress]);

  useAnimatedReaction(
    () => Math.round(progress.value * value * Math.pow(10, decimals)) / Math.pow(10, decimals),
    (current) => {
      if (current === lastRendered.current) return;
      lastRendered.current = current;
      runOnJS(setDisplay)(current);
    },
  );

  return (
    <Text {...textProps}>
      {prefix}
      {formatNumber(display, locale, decimals)}
      {suffix}
    </Text>
  );
}
