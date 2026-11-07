import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useI18n } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { COLORS, DARK } from '@/theme/colors';
import { DURATION } from '@/theme/motion';
import { LAYOUT, RADIUS, SPACING } from '@/theme/space';

import { Button, Card, HeroBackground, Reveal, StatCounter, Text } from '@/components/ui';

import type { Locale } from '@/lib/format';

/**
 * Ouverture du site.
 *
 * Trois mouvements composent l'arrivée : les lignes du titre montent en cascade,
 * le filet doré se déplie sous le mot clé, et la carte de données flotte en
 * arrière-plan. Aucun de ces mouvements n'est décoratif au point de gêner la
 * lecture : le titre est lisible dès la première frame.
 */
export function Hero({ stats }: { stats: HeroStats }) {
  const { t, locale } = useI18n();
  const { width, height } = useWindowDimensions();
  const wide = width >= 900;

  return (
    <HeroBackground style={{ minHeight: wide ? height * 0.94 : height * 0.98 }}>
      <View style={[styles.content, wide ? styles.contentWide : null]}>
        <View style={[styles.textColumn, wide ? { flex: 1.15 } : null]}>
          <Animated.View entering={FadeIn.delay(80).duration(DURATION.slow)}>
            <View style={styles.badge}>
              <LiveDot />
              <Text preset="overline" color={DARK.text} style={{ fontSize: 10 }}>
                {t('home.eyebrow')}
              </Text>
              <View style={styles.badgeDivider} />
              <Text preset="overline" color={COLORS.gold} style={{ fontSize: 10 }}>
                {t('home.heroBadge')}
              </Text>
            </View>
          </Animated.View>

          <View style={styles.titleBlock}>
            <HeroLine index={0} text={t('home.heroTitleLine1')} />
            <HeroLine index={1} text={t('home.heroTitleLine2')} />
            <HeroLine index={2} text={t('home.heroTitleLine3')} highlight />
          </View>

          <Reveal index={3} variant="up" distance={22}>
            <Text preset="lead" color="rgba(246, 247, 242, 0.76)" style={styles.subtitle}>
              {t('home.heroSubtitle')}
            </Text>
          </Reveal>

          <Reveal index={4} variant="up" distance={22}>
            <View style={[styles.ctaRow, wide ? styles.ctaRowWide : null]}>
              <Button
                label={t('home.heroCtaPrimary')}
                onPress={() => router.push('/marches')}
                variant="gold"
                size="lg"
                iconRight="arrow-forward"
              />
              <Button
                label={t('home.heroCtaSecondary')}
                onPress={() => router.push('/auth/register')}
                variant="dark"
                size="lg"
                icon="leaf-outline"
              />
            </View>
          </Reveal>

          <Reveal index={5} variant="up" distance={18}>
            <View style={styles.trustRow}>
              <TrustItem symbol="✔" label="Mesures de terrain et de laboratoire" />
              <TrustItem symbol="≈" label="Estimations signalées comme telles" />
              <TrustItem symbol="•" label="Coordonnées masquées par défaut" />
            </View>
          </Reveal>
        </View>

        <View style={[styles.visualColumn, wide ? { flex: 0.85 } : null]}>
          <FloatingDataCard stats={stats} locale={locale} />
        </View>
      </View>

      <ScrollHint />
    </HeroBackground>
  );
}

export interface HeroStats {
  farms: number | null;
  located: number | null;
  soilAssessments: number | null;
  countries: number | null;
  loading: boolean;
}

function HeroLine({ index, text, highlight = false }: { index: number; text: string; highlight?: boolean }) {
  const underline = useSharedValue(0);

  underline.value = withTiming(1, {
    duration: DURATION.reveal * 1.4,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: highlight ? underline.value : 1 }],
  }));

  return (
    <Animated.View entering={FadeIn.delay(160 + index * 130).duration(DURATION.slow)}>
      <View style={styles.titleLine}>
        <Text preset="heroDisplay" color={highlight ? COLORS.gold : DARK.text}>
          {text}
        </Text>
        {highlight ? (
          <Animated.View style={[styles.underline, lineStyle]} />
        ) : null}
      </View>
    </Animated.View>
  );
}

function LiveDot() {
  const pulse = useSharedValue(0);
  pulse.value = withRepeat(
    withSequence(withTiming(1, { duration: 1_400 }), withTiming(0, { duration: 1_400 })),
    -1,
    false,
  );
  const style = useAnimatedStyle(() => ({ opacity: 0.35 + pulse.value * 0.65 }));
  return <Animated.View style={[styles.dot, style]} />;
}

function TrustItem({ symbol, label }: { symbol: string; label: string }) {
  return (
    <View style={styles.trustItem}>
      <Text preset="caption" color={COLORS.gold}>
        {symbol}
      </Text>
      <Text preset="caption" color="rgba(246, 247, 242, 0.66)">
        {label}
      </Text>
    </View>
  );
}

/**
 * Carte flottante : chiffres réellement renvoyés par l'API publique.
 * Tant que la requête est en cours, les compteurs restent à zéro — on n'affiche
 * jamais un chiffre d'illustration.
 */
function FloatingDataCard({ stats, locale }: { stats: HeroStats; locale: Locale }) {
  const float = useSharedValue(0);
  float.value = withRepeat(
    withSequence(
      withTiming(1, { duration: 5_200, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 5_200, easing: Easing.inOut(Easing.quad) }),
    ),
    -1,
    false,
  );

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value * -10 }],
  }));

  const chipStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value * 12 }],
  }));

  return (
    <Animated.View style={[styles.cardWrap, floatStyle]}>
      <Animated.View entering={FadeIn.delay(520).duration(DURATION.slow)}>
        <Card tone="ink" radius={RADIUS.xxl} style={styles.dataCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardDotRow}>
              <View style={[styles.cardDot, { backgroundColor: COLORS.livingGreen }]} />
              <View style={[styles.cardDot, { backgroundColor: COLORS.goldSurface }]} />
              <View style={[styles.cardDot, { backgroundColor: 'rgba(246,247,242,0.3)' }]} />
            </View>
            <Text preset="overline" color={DARK.textFaint} style={{ fontSize: 9 }}>
              API publique · temps réel
            </Text>
          </View>

          <View style={styles.statGrid}>
            <DataStat
              value={stats.farms ?? 0}
              label="profils producteurs publiés"
              locale={locale}
              loading={stats.loading}
            />
            <DataStat
              value={stats.located ?? 0}
              label="exploitations géolocalisées"
              locale={locale}
              loading={stats.loading}
              accent
            />
            <DataStat
              value={stats.soilAssessments ?? 0}
              label="analyses de sol agrégées"
              locale={locale}
              loading={stats.loading}
            />
            <DataStat
              value={stats.countries ?? 0}
              label="pays représentés"
              locale={locale}
              loading={stats.loading}
              accent
            />
          </View>

          <LinearGradient
            colors={['rgba(101, 166, 75, 0)', 'rgba(101, 166, 75, 0.18)']}
            style={styles.cardGlow}
            pointerEvents="none"
          />
        </Card>
      </Animated.View>

      <Animated.View style={[styles.floatingChip, chipStyle]}>
        <Ionicons name="qr-code-outline" size={14} color={COLORS.textPrimary} />
        <Text preset="caption" color={COLORS.textPrimary}>
          AK-CI-2026-00001
        </Text>
      </Animated.View>

      <Text preset="caption" color={DARK.textFaint} style={styles.cardNote}>
        Compteurs issus de /public/farms, /public/map et /public/soil-stats.
      </Text>
    </Animated.View>
  );
}

function DataStat({
  value,
  label,
  locale,
  loading,
  accent = false,
}: {
  value: number;
  label: string;
  locale: Locale;
  loading: boolean;
  accent?: boolean;
}) {
  return (
    <View style={styles.dataStat}>
      {loading ? (
        <Text preset="numeric" color={DARK.textFaint}>
          —
        </Text>
      ) : (
        <StatCounter
          value={value}
          locale={locale}
          preset="numeric"
          color={accent ? COLORS.gold : DARK.text}
          style={{ fontSize: 26, lineHeight: 30 }}
        />
      )}
      <Text preset="caption" color={DARK.textMuted} style={styles.dataStatLabel}>
        {label}
      </Text>
    </View>
  );
}

function ScrollHint() {
  const bounce = useSharedValue(0);
  bounce.value = withRepeat(
    withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })),
    -1,
    false,
  );
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: bounce.value * 6 }],
    opacity: 0.4 + bounce.value * 0.4,
  }));

  return (
    <Animated.View style={[styles.scrollHint, style]} pointerEvents="none">
      <Text preset="overline" color={DARK.textFaint} style={{ fontSize: 9 }}>
        Défilez
      </Text>
      <Ionicons name="chevron-down" size={14} color={COLORS.gold} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: LAYOUT.navbarHeight + SPACING.xxl,
    paddingBottom: SPACING.xxxl * 1.6,
    paddingHorizontal: LAYOUT.screenPadding,
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    alignSelf: 'center',
    gap: SPACING.xl,
  },
  contentWide: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xxl },
  textColumn: { gap: SPACING.lg },
  visualColumn: { alignItems: 'center' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: DARK.border,
    backgroundColor: 'rgba(246, 247, 242, 0.06)',
  },
  badgeDivider: { width: 1, height: 10, backgroundColor: DARK.borderStrong },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.livingGreen },
  titleBlock: { gap: 2 },
  titleLine: { position: 'relative' },
  underline: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    width: '78%',
    height: 3,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(214, 166, 79, 0.55)',
  },
  subtitle: { maxWidth: 560 },
  ctaRow: { gap: SPACING.md },
  ctaRowWide: { flexDirection: 'row' },
  trustRow: { gap: SPACING.sm, marginTop: SPACING.sm },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  cardWrap: { width: '100%', maxWidth: 420, gap: SPACING.md },
  dataCard: { gap: SPACING.lg, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardDotRow: { flexDirection: 'row', gap: 5 },
  cardDot: { width: 7, height: 7, borderRadius: 4 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.lg },
  dataStat: { width: '44%', gap: 2 },
  dataStatLabel: { lineHeight: 16 },
  cardGlow: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 },
  floatingChip: {
    position: 'absolute',
    top: -14,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.goldSurface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
  },
  cardNote: { textAlign: 'center', lineHeight: 16 },
  scrollHint: {
    position: 'absolute',
    bottom: SPACING.lg,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 2,
  },
});

export const heroFormat = formatNumber;
