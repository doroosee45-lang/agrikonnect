import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

import { Text } from '@/components/ui';

/**
 * Marque : une feuille stylisée dans un disque vert forêt, filets dorés.
 * Dessinée en SVG (aucune dépendance à un asset binaire, aucune requête).
 */
export function LogoMark({ size = 34, light = false }: { size?: number; light?: boolean }) {
  const ring = light ? 'rgba(246, 247, 242, 0.22)' : 'rgba(23, 77, 53, 0.18)';
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Circle cx="20" cy="20" r="19" fill={light ? 'rgba(246, 247, 242, 0.08)' : COLORS.forestGreen} />
      <Circle cx="20" cy="20" r="19" stroke={ring} strokeWidth="1" />
      <Path
        d="M20 30c0-6.5 3.6-11.4 9.5-13.2C28.6 24.2 25 29.2 20 30Z"
        fill={COLORS.livingGreen}
      />
      <Path
        d="M20 30c0-6.5-3.6-11.4-9.5-13.2C11.4 24.2 15 29.2 20 30Z"
        fill={COLORS.gold}
      />
      <Path d="M20 30V13.5" stroke={light ? COLORS.naturalWhite : COLORS.pureWhite} strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export interface LogoProps {
  light?: boolean;
  size?: number;
  showTagline?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Logo complet : marque + wordmark, avec le mot « AFRICA » en doré. */
export function Logo({ light = false, size = 34, showTagline = false, style }: LogoProps) {
  const primary = light ? COLORS.naturalWhite : COLORS.textPrimary;

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }, style]}>
      <LogoMark size={size} light={light} />
      <View>
        <Text
          preset="h3"
          color={primary}
          style={{ letterSpacing: 0.4, fontSize: size >= 40 ? 19 : 16 }}
        >
          AGRIKONNECT
        </Text>
        {showTagline ? (
          <Text preset="overline" color={COLORS.gold} style={{ fontSize: 9, letterSpacing: 2.4 }}>
            AFRICA
          </Text>
        ) : null}
      </View>
    </View>
  );
}
