import { View, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS, DARK } from '@/theme/colors';
import { SPACING } from '@/theme/space';

import { Text } from './Text';

export interface DividerProps {
  /** Libellé centré sur le filet (« ou », « détails techniques »). */
  label?: string;
  light?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Filet de séparation ; avec libellé il sert de césure éditoriale. */
export function Divider({ label, light = false, style }: DividerProps) {
  const color = light ? DARK.border : COLORS.lightBorder;

  if (!label) return <View style={[{ height: 1, backgroundColor: color }, style]} />;

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }, style]}>
      <View style={{ flex: 1, height: 1, backgroundColor: color }} />
      <Text preset="caption" color={light ? DARK.textFaint : COLORS.slateGray}>
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: color }} />
    </View>
  );
}

/** Filet vertical (séparateur de statistiques en ligne). */
export function VerticalDivider({ light = false }: { light?: boolean }) {
  return <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: light ? DARK.border : COLORS.lightBorder }} />;
}
