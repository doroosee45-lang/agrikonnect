import { useState } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, TINTS } from '@/theme/colors';
import { DURATION, EASE } from '@/theme/motion';
import { RADIUS, SPACING } from '@/theme/space';

import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { CREME, ENCRE } from '../../theme/agrikonnect';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Message d'erreur par champ, repris de `errors[].field` côté serveur. */
  error?: string | null;
  helper?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Affiche le bouton œil (mots de passe). */
  secure?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  optionalLabel?: string;
}

/**
 * Champ de formulaire.
 *
 * Le contour s'anime vers le vert forêt à la prise de focus (interpolation de
 * couleur sur le thread UI) et vers la terracotta en cas d'erreur de validation
 * renvoyée par l'API.
 */
export function Input({
  label,
  error,
  helper,
  icon,
  secure = false,
  containerStyle,
  optionalLabel,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secure);
  const focus = useSharedValue(0);

  focus.value = withTiming(focused ? 1 : 0, { duration: DURATION.fast, easing: EASE.out });

  const animatedBorder = useAnimatedStyle(() => ({
    borderColor: error
      ? COLORS.error
      : interpolateColor(focus.value, [0, 1], [COLORS.lightBorder, COLORS.forestGreen]),
    backgroundColor: interpolateColor(focus.value, [0, 1], [COLORS.pureWhite, CREME[50]]),
  }));

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.labelRow}>
        <Text preset="caption" color={COLORS.textPrimary}>
          {label}
        </Text>
        {optionalLabel ? (
          <Text preset="caption" color={COLORS.slateGray}>
            {optionalLabel}
          </Text>
        ) : null}
      </View>

      <Animated.View style={[styles.field, animatedBorder]}>
        {icon ? <Ionicons name={icon} size={17} color={focused ? COLORS.forestGreen : COLORS.slateGray} /> : null}
        <AnimatedTextInput
          {...rest}
          secureTextEntry={hidden}
          placeholderTextColor={ENCRE[500]}
          onFocus={(event) => {
            setFocused(true);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            rest.onBlur?.(event);
          }}
          style={[styles.input, icon ? { paddingLeft: 0 } : null]}
        />
        {secure ? (
          <PressableScale onPress={() => setHidden((value) => !value)} accessibilityRole="button">
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={17} color={COLORS.slateGray} />
          </PressableScale>
        ) : null}
      </Animated.View>

      {error ? (
        <View style={styles.messageRow}>
          <Ionicons name="alert-circle" size={12} color={COLORS.error} />
          <Text preset="caption" color={COLORS.error}>
            {error}
          </Text>
        </View>
      ) : helper ? (
        <Text preset="caption" color={COLORS.slateGray}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

/** Zone de texte multiligne (messages, descriptions d'annonce). */
export function TextArea({
  label,
  error,
  helper,
  minHeight = 120,
  ...rest
}: Omit<InputProps, 'icon' | 'secure'> & { minHeight?: number }) {
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);
  focus.value = withTiming(focused ? 1 : 0, { duration: DURATION.fast, easing: EASE.out });

  const animatedBorder = useAnimatedStyle(() => ({
    borderColor: error
      ? COLORS.error
      : interpolateColor(focus.value, [0, 1], [COLORS.lightBorder, COLORS.forestGreen]),
  }));

  return (
    <View style={styles.container}>
      <Text preset="caption" color={COLORS.textPrimary}>
        {label}
      </Text>
      <Animated.View style={[styles.field, { alignItems: 'flex-start', minHeight, paddingVertical: SPACING.md }, animatedBorder]}>
        <TextInput
          {...rest}
          multiline
          placeholderTextColor={ENCRE[500]}
          onFocus={(event) => {
            setFocused(true);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            rest.onBlur?.(event);
          }}
          style={[styles.input, { height: minHeight - SPACING.xl, textAlignVertical: 'top', paddingTop: 0 }]}
        />
      </Animated.View>
      {error ? (
        <Text preset="caption" color={COLORS.error}>
          {error}
        </Text>
      ) : helper ? (
        <Text preset="caption" color={COLORS.slateGray}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACING.xs, width: '100%' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1.2,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 50,
    backgroundColor: COLORS.pureWhite,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    paddingLeft: SPACING.sm,
  },
  messageRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
});

export const INPUT_ERROR_BG = TINTS.errorBg;
