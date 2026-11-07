import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS, DARK, SURFACES } from '@/theme/colors';
import { GRADIENTS, SHADOWS } from '@/theme/shadows';
import { RADIUS, SPACING } from '@/theme/space';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type CardTone = 'paper' | 'white' | 'pale' | 'forest' | 'ink' | 'gold';

export interface CardProps extends ViewProps {
  tone?: CardTone;
  padded?: boolean;
  radius?: number;
  /** Ombre douce ; les tons sombres portent une bordure claire à la place. */
  elevated?: boolean;
  gradient?: readonly [string, string];
  style?: StyleProp<ViewStyle>;
  bordered?: boolean;
}

const TONES: Record<CardTone, { background: string; border: string; shadow: ViewStyle }> = {
  paper: { background: COLORS.naturalWhite, border: SURFACES.borderSoft, shadow: SHADOWS.hairline },
  white: { background: COLORS.pureWhite, border: SURFACES.borderSoft, shadow: SHADOWS.card },
  pale: { background: COLORS.paleGreen, border: 'rgba(101, 166, 75, 0.22)', shadow: SHADOWS.hairline },
  forest: { background: COLORS.forestGreen, border: 'rgba(246, 247, 242, 0.12)', shadow: SHADOWS.lifted },
  ink: { background: DARK.bg, border: DARK.border, shadow: SHADOWS.lifted },
  gold: { background: COLORS.goldSurface, border: 'rgba(18, 61, 42, 0.18)', shadow: SHADOWS.gold },
};

export const GRADIENT = GRADIENTS;

/** Surface de base de l'application. */
export function Card({
  tone = 'white',
  padded = true,
  radius = RADIUS.xl,
  elevated = true,
  gradient,
  style,
  bordered = true,
  children,
  ...rest
}: CardProps) {
  const palette = TONES[tone];

  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: palette.background,
          borderRadius: radius,
          borderWidth: bordered ? 1 : 0,
          borderColor: palette.border,
          padding: padded ? SPACING.lg : 0,
          overflow: 'hidden',
        },
        elevated ? palette.shadow : null,
        style,
      ]}
    >
      {gradient ? (
        <LinearGradient colors={[...gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      ) : null}
      {children}
    </View>
  );
}

export interface PressableCardProps extends Omit<CardProps, 'elevated'> {
  onPress?: () => void;
}

/** Carte cliquable : ressort à l'appui (jamais de transition linéaire). */
export function PressableCard({
  onPress,
  tone = 'white',
  radius = RADIUS.xl,
  padded = true,
  bordered = true,
  gradient,
  style,
  children,
  ...rest
}: PressableCardProps) {
  const palette = TONES[tone];

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      {...rest}
      style={[
        {
          backgroundColor: palette.background,
          borderRadius: radius,
          borderWidth: bordered ? 1 : 0,
          borderColor: palette.border,
          padding: padded ? SPACING.lg : 0,
          overflow: 'hidden',
        },
        palette.shadow,
        style,
      ]}
    >
      {gradient ? (
        <LinearGradient colors={[...gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      ) : null}
      {children}
    </PressableScale>
  );
}

/** Rappel de provenance posé sous une carte de donnée. */
export function CardFootnote({ text, light = false }: { text: string; light?: boolean }) {
  return (
    <Text preset="caption" color={light ? DARK.textFaint : COLORS.slateGray} style={styles.footnote}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  footnote: { marginTop: SPACING.sm, lineHeight: 17 },
});
