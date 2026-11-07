import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import Animated from 'react-native-reanimated';

import { COLORS } from '@/theme/colors';
import { type as presetStyle, type TypePreset } from '@/theme/typography';

export interface TextProps extends RNTextProps {
  /** Preset typographique (`heroDisplay`, `h1`, `body`, `overline`…). */
  preset?: TypePreset;
  /** Couleur de texte ; défaut = `textPrimary`. */
  color?: string;
  style?: RNTextProps['style'];
}

/**
 * Texte unique de l'application : la typographie ne se règle jamais au cas par
 * cas dans les écrans, on choisit un preset. Les graisses et interlignages sont
 * ceux des polices Space Grotesk (titres) et Inter (texte).
 */
export function Text({ preset = 'body', color = COLORS.textPrimary, style, ...rest }: TextProps) {
  return <RNText {...rest} style={[presetStyle(preset), { color }, style]} />;
}

/** Version animable (compteurs, texte qui change d'opacité au défilement). */
export const AnimatedText = Animated.createAnimatedComponent(Text);

export const Headline = ({ children, ...rest }: TextProps) => (
  <Text preset="h1" {...rest}>
    {children}
  </Text>
);

export const Title = ({ children, ...rest }: TextProps) => (
  <Text preset="h2" {...rest}>
    {children}
  </Text>
);

export const Overline = ({ children, ...rest }: TextProps) => (
  <Text preset="overline" color={COLORS.slateGray} {...rest}>
    {children}
  </Text>
);
