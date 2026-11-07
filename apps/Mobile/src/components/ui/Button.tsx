import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, DARK } from '@/theme/colors';
import { GRADIENTS, SHADOWS } from '@/theme/shadows';
import { RADIUS, SPACING } from '@/theme/space';

import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { CREME } from '../../theme/agrikonnect';

export type ButtonVariant = 'primary' | 'gold' | 'living' | 'outline' | 'ghost' | 'dark' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Ombre portée colorée (CTA principaux). */
  elevated?: boolean;
  testID?: string;
}

const SIZES: Record<ButtonSize, { height: number; paddingHorizontal: number; font: 'caption' | 'button'; icon: number }> = {
  /*
   * 48 pt minimum, y compris pour la petite taille (I14). L'ancienne valeur
   * était 38 pt : 340 usages de `size="sm"` dans l'application étaient donc sous
   * le seuil. On réduit la police et l'icône, pas la zone tactile.
   */
  sm: { height: 48, paddingHorizontal: SPACING.lg, font: 'caption', icon: 15 },
  md: { height: 48, paddingHorizontal: SPACING.xl, font: 'button', icon: 18 },
  lg: { height: 56, paddingHorizontal: SPACING.xxl, font: 'button', icon: 20 },
};

type VariantStyle = {
  gradient?: readonly [string, string];
  background?: string;
  border?: string;
  color: string;
  shadow?: ViewStyle;
};

const VARIANTS: Record<ButtonVariant, VariantStyle> = {
  primary: { gradient: GRADIENTS.forestSoft, color: COLORS.pureWhite, shadow: SHADOWS.lifted },
  /* B1 : un bouton PRINCIPAL ordinaire est toujours vert-800 (creme-100 dessus = 11,27:1).
     L'ancien dégradé or, une fois l'or devenu terre-700, tombait à 1,63:1 sur son
     extrémité claire. terre-700 reste réservé aux CTA partenaire/investisseur. */
  gold: { gradient: GRADIENTS.forestSoft, color: CREME[100], shadow: SHADOWS.lifted },
  living: { gradient: GRADIENTS.leaf, color: COLORS.pureWhite, shadow: SHADOWS.lifted },
  dark: { background: DARK.bg, color: COLORS.naturalWhite, border: DARK.borderStrong },
  outline: { background: 'transparent', color: COLORS.forestGreen, border: COLORS.forestGreen },
  ghost: { background: 'transparent', color: COLORS.forestGreen },
  danger: { background: COLORS.error, color: COLORS.pureWhite },
};

/**
 * Bouton de l'application : dégradé pour les actions principales, contour pour
 * les secondaires, fantôme pour le tertiaire. L'animation d'appui vient de
 * `PressableScale` (ressort), jamais d'une transition CSS.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  elevated = true,
  testID,
}: ButtonProps) {
  const variantStyle = VARIANTS[variant];
  const metrics = SIZES[size];
  const busy = loading || disabled;

  const shell: ViewStyle = {
    height: metrics.height,
    paddingHorizontal: metrics.paddingHorizontal,
    borderRadius: RADIUS.pill,
    borderWidth: variantStyle.border ? 1.4 : 0,
    borderColor: variantStyle.border,
    backgroundColor: variantStyle.background,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
    ...(elevated && variantStyle.shadow ? variantStyle.shadow : null),
    ...(fullWidth ? { alignSelf: 'stretch' } : null),
    overflow: 'hidden',
  };

  const content = (
    <>
      {loading ? (
        <ActivityIndicator size="small" color={variantStyle.color} />
      ) : (
        icon && <Ionicons name={icon} size={metrics.icon} color={variantStyle.color} />
      )}
      <Text preset={size === 'sm' ? 'caption' : 'button'} color={variantStyle.color} numberOfLines={1}>
        {label}
      </Text>
      {iconRight && !loading && <Ionicons name={iconRight} size={metrics.icon} color={variantStyle.color} />}
    </>
  );

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={busy}
      scaleTo={0.965}
      style={[shell, style]}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy, busy: loading }}
    >
      {variantStyle.gradient ? (
        <LinearGradient
          colors={[...variantStyle.gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={styles.content}>{content}</View>
    </PressableScale>
  );
}

/** Bouton icône seul (navigation, fermeture de modale). */
export function IconButton({
  icon,
  onPress,
  size = 20,
  color = COLORS.forestGreen,
  background = COLORS.pureWhite,
  diameter = 42,
  bordered = true,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  size?: number;
  color?: string;
  background?: string;
  diameter?: number;
  bordered?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{
        width: diameter,
        height: diameter,
        borderRadius: RADIUS.pill,
        backgroundColor: background,
        borderWidth: bordered ? 1 : 0,
        borderColor: COLORS.lightBorder,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={size} color={color} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
});
