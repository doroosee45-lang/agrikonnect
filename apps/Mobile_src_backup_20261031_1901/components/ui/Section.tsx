import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/theme/colors';
import { LAYOUT, RADIUS, SPACING } from '@/theme/space';

import { PressableScale } from './PressableScale';
import { Reveal } from './Reveal';
import { Text } from './Text';

export interface SectionProps {
  children: React.ReactNode;
  /** Fond de section ; `undefined` hérite de l'écran. */
  background?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Numéro affiché dans l'eyebrow (le site public numérote ses sections). */
  index?: number | string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** Lien « tout voir » aligné à droite de l'en-tête. */
  action?: { label: string; onPress: () => void };
  /** En-tête centré (sections d'ouverture). */
  centered?: boolean;
  /** Titre en clair (sections sombres). */
  light?: boolean;
  compact?: boolean;
  /** Masque l'en-tête mais garde le rythme vertical. */
  bare?: boolean;
}

/**
 * Section de page + en-tête éditorial.
 *
 * L'en-tête reprend la signature du site : un index numéroté, un filet doré, un
 * sur-titre en petites capitales, puis le titre en Space Grotesk. L'ensemble
 * arrive en cascade (`Reveal` index 0/1/2) plutôt que d'un bloc.
 */
export function Section({
  children,
  background,
  style,
  contentStyle,
  index,
  eyebrow,
  title,
  subtitle,
  action,
  centered = false,
  light = false,
  compact = false,
  bare = false,
}: SectionProps) {
  return (
    <View style={[background ? { backgroundColor: background } : null, style]}>
      <View
        style={[
          styles.content,
          { paddingVertical: compact ? SPACING.xxl : LAYOUT.sectionGap },
          contentStyle,
        ]}
      >
        {!bare && (eyebrow || title) ? (
          <SectionHeader
            index={index}
            eyebrow={eyebrow}
            title={title}
            subtitle={subtitle}
            action={action}
            centered={centered}
            light={light}
          />
        ) : null}
        {children}
      </View>
    </View>
  );
}

export interface SectionHeaderProps {
  index?: number | string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
  centered?: boolean;
  light?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({
  index,
  eyebrow,
  title,
  subtitle,
  action,
  centered = false,
  light = false,
  style,
}: SectionHeaderProps) {
  const titleColor = light ? COLORS.naturalWhite : COLORS.textPrimary;
  const subtitleColor = light ? 'rgba(246, 247, 242, 0.72)' : COLORS.slateGray;

  return (
    <View style={[styles.header, centered ? styles.centered : null, style]}>
      <Reveal index={0} variant="up" distance={14}>
        <View style={[styles.eyebrowRow, centered ? styles.centered : null]}>
          {index !== undefined ? (
            <View style={styles.indexBadge}>
              <Text preset="overline" color={COLORS.gold} style={styles.indexText}>
                {String(index).padStart(2, '0')}
              </Text>
            </View>
          ) : null}
          {eyebrow ? (
            <Text preset="overline" color={light ? COLORS.gold : COLORS.livingGreen}>
              {eyebrow}
            </Text>
          ) : null}
          <View style={[styles.rule, centered ? styles.ruleCentered : null]} />
        </View>
      </Reveal>

      {title ? (
        <Reveal index={1} variant="up" distance={18}>
          <Text preset="display" color={titleColor} style={[styles.title, centered ? styles.centeredText : null]}>
            {title}
          </Text>
        </Reveal>
      ) : null}

      {subtitle ? (
        <Reveal index={2} variant="up" distance={18}>
          <Text
            preset="lead"
            color={subtitleColor}
            style={[styles.subtitle, centered ? styles.centeredText : null]}
          >
            {subtitle}
          </Text>
        </Reveal>
      ) : null}

      {action ? (
        <Reveal index={3} variant="fade">
          <PressableScale
            onPress={action.onPress}
            accessibilityRole="link"
            style={styles.action}
          >
            <Text preset="caption" color={light ? COLORS.gold : COLORS.forestGreen}>
              {action.label}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={14}
              color={light ? COLORS.gold : COLORS.forestGreen}
            />
          </PressableScale>
        </Reveal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: LAYOUT.screenPadding,
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    alignSelf: 'center',
  },
  header: { gap: SPACING.md, marginBottom: SPACING.xl },
  centered: { alignItems: 'center' },
  centeredText: { textAlign: 'center' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  indexBadge: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(214, 166, 79, 0.5)',
    backgroundColor: 'rgba(214, 166, 79, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: { letterSpacing: 0.6 },
  rule: { flex: 1, height: 1, backgroundColor: 'rgba(214, 166, 79, 0.35)', marginLeft: SPACING.xs },
  ruleCentered: { maxWidth: 64 },
  title: { maxWidth: 620 },
  subtitle: { marginTop: SPACING.xs, maxWidth: 560 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    alignSelf: 'flex-start',
    paddingVertical: SPACING.xs,
  },
});
