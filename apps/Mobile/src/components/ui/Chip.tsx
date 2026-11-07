import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { ENCRE, ROUGE, TERRE, VERT } from '../../theme/agrikonnect';

export type ChipTone = 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'gold' | 'forest' | 'living';

const TONES: Record<ChipTone, { background: string; color: string; border: string }> = {
  /* B1 — les paires texte/fond viennent de la palette, pas d'un calcul. */
  neutral: { background: TINTS.infoBg, color: ENCRE[700], border: 'rgba(18, 61, 42, 0.14)' },
  success: { background: TINTS.successBg, color: VERT[800], border: 'rgba(18, 61, 42, 0.14)' },
  warning: { background: TINTS.warningBg, color: TERRE[800], border: 'rgba(125, 54, 32, 0.28)' },
  error: { background: TINTS.errorBg, color: ROUGE[700], border: 'rgba(185, 28, 28, 0.25)' },
  info: { background: TINTS.infoBg, color: VERT[800], border: 'rgba(18, 61, 42, 0.14)' },
  gold: { background: TINTS.goldBg, color: TERRE[800], border: 'rgba(125, 54, 32, 0.28)' },
  forest: { background: TINTS.forestGreenBg, color: VERT[800], border: 'rgba(18, 61, 42, 0.14)' },
  living: { background: TINTS.livingGreenBg, color: VERT[800], border: 'rgba(18, 61, 42, 0.14)' },
};

export interface ChipProps {
  label: string;
  tone?: ChipTone;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

/** Pastille d'état : statut de lot, certification, fraîcheur d'une donnée. */
export function Chip({ label, tone = 'neutral', icon, size = 'md', style }: ChipProps) {
  const palette = TONES[tone];
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          paddingHorizontal: size === 'sm' ? SPACING.sm : SPACING.md,
          height: size === 'sm' ? 24 : 30,
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={size === 'sm' ? 11 : 13} color={palette.color} /> : null}
      <Text preset="caption" color={palette.color} style={size === 'sm' ? styles.labelSm : undefined}>
        {label}
      </Text>
    </View>
  );
}

export interface FilterChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

/** Chip sélectionnable (filtres de marché, de culture, de pays). */
export function FilterChip({ label, active = false, onPress, icon }: FilterChipProps) {
  const palette = active ? TONES.forest : TONES.neutral;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        height: 36,
        paddingHorizontal: SPACING.lg,
        borderRadius: RADIUS.pill,
        backgroundColor: active ? COLORS.forestGreen : COLORS.pureWhite,
        borderWidth: 1,
        borderColor: active ? COLORS.forestGreen : COLORS.lightBorder,
      }}
    >
      {icon ? <Ionicons name={icon} size={14} color={palette.color} /> : null}
      <Text preset="caption" color={active ? COLORS.pureWhite : COLORS.slateGray}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** Rangée de filtres (retour à la ligne automatique). */
export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  labelSm: { fontSize: 11 },
  row: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
});
