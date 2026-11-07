import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useI18n } from '@/i18n';
import { COLORS, DARK, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

import {
  Card,
  Divider,
  PaperBackground,
  ProvenanceTag,
  Reveal,
  Section,
  StatCounter,
  Text,
  VerticalDivider,
} from '@/components/ui';

import type { HeroStats } from './Hero';

/**
 * Section 2 — « Une donnée, une origine ».
 *
 * C'est la règle la plus structurante de la plateforme : elle est expliquée
 * avant toute donnée chiffrée, pour que le visiteur sache lire le reste.
 */
export function TrustBand() {
  const { t } = useI18n();

  const cards = [
    {
      kind: 'measured' as const,
      icon: 'analytics-outline' as const,
      title: 'Mesuré',
      body: 'Analyse de laboratoire, capteur de terrain, drone : la valeur provient d’un instrument identifié, avec sa date et sa méthode.',
      tone: TINTS.successBg,
      color: COLORS.success,
    },
    {
      kind: 'satellite' as const,
      icon: 'planet-outline' as const,
      title: 'Estimé',
      body: 'Imagerie satellite, modèle pédologique, fusion de sources : la valeur est approchée. Le marqueur ≈ le dit explicitement.',
      tone: TINTS.infoBg,
      color: COLORS.info,
    },
    {
      kind: 'declared' as const,
      icon: 'create-outline' as const,
      title: 'Déclaré',
      body: 'Saisie du producteur ou de l’agent. Rien n’est inventé pour combler un manque : un champ absent reste absent.',
      tone: TINTS.warningBg,
      color: COLORS.warning,
    },
  ];

  return (
    <Section
      index={1}
      eyebrow="Provenance"
      title={t('home.trustTitle')}
      subtitle={t('home.trustSubtitle')}
      background={COLORS.pureWhite}
    >
      <View style={styles.grid}>
        {cards.map((card, index) => (
          <Reveal key={card.title} index={index} variant="up" style={styles.gridItem}>
            <Card tone="white" style={styles.trustCard}>
              <View style={[styles.iconBox, { backgroundColor: card.tone }]}>
                <Ionicons name={card.icon} size={20} color={card.color} />
              </View>
              <View style={styles.trustTitleRow}>
                <Text preset="h3" color={COLORS.textPrimary}>
                  {card.title}
                </Text>
                <ProvenanceTag kind={card.kind} />
              </View>
              <Text preset="bodySm" color={COLORS.slateGray} style={styles.trustBody}>
                {card.body}
              </Text>
            </Card>
          </Reveal>
        ))}
      </View>

      <Reveal index={3} variant="fade">
        <Card tone="pale" style={styles.legend}>
          <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.forestGreen} />
          <Text preset="bodySm" color={COLORS.textPrimary} style={styles.legendText}>
            {t('provenance.legend')} — et « vérifié par AGRIKONNECT » ne signifie jamais la même chose que
            « déclaré par le producteur ».
          </Text>
        </Card>
      </Reveal>
    </Section>
  );
}

/** Section 3 — bandeau chiffré, alimenté par les compteurs publics. */
export function StatsBand({ stats }: { stats: HeroStats }) {
  const { t, locale } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 820;

  const items = [
    { value: stats.farms, label: 'profils producteurs publiés', source: '/public/farms' },
    { value: stats.located, label: 'exploitations géolocalisées', source: '/public/map' },
    { value: stats.soilAssessments, label: 'analyses de sol agrégées', source: '/public/soil-stats' },
    { value: stats.countries, label: 'pays représentés', source: '/public/map' },
  ];

  return (
    <View style={styles.statsWrapper}>
      <PaperBackground>
        <View style={styles.statsContent}>
          <Reveal index={0} variant="up">
            <View style={styles.statsHeader}>
              <Text preset="overline" color={COLORS.livingGreen}>
                {t('home.statsTitle')}
              </Text>
              <Text preset="bodySm" color={COLORS.slateGray} style={styles.statsNote}>
                {t('home.statsNote')}
              </Text>
            </View>
          </Reveal>

          <View style={[styles.statsRow, wide ? styles.statsRowWide : null]}>
            {items.map((item, index) => (
              <Reveal key={item.label} index={index + 1} variant="up" style={styles.statItem}>
                {stats.loading || item.value === null ? (
                  <Text preset="numeric" color={DARK.textFaint} style={styles.statValue}>
                    —
                  </Text>
                ) : (
                  <StatCounter
                    value={item.value}
                    locale={locale}
                    preset="numeric"
                    color={COLORS.forestGreen}
                    style={styles.statValue}
                  />
                )}
                <Text preset="caption" color={COLORS.slateGray}>
                  {item.label}
                </Text>
                <Text preset="caption" color="rgba(102, 115, 107, 0.7)" style={styles.statSource}>
                  {item.source}
                </Text>
                {index < items.length - 1 && wide ? <VerticalDivider /> : null}
              </Reveal>
            ))}
          </View>
        </View>
      </PaperBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: SPACING.md },
  gridItem: { flex: 1, minWidth: 260 },
  trustCard: { gap: SPACING.sm, height: '100%' },
  trustTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustBody: { lineHeight: 20 },
  legend: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start', marginTop: SPACING.lg },
  legendText: { flex: 1, lineHeight: 20 },
  statsWrapper: { width: '100%' },
  statsContent: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    gap: SPACING.xl,
  },
  statsHeader: { gap: SPACING.xs },
  statsNote: { maxWidth: 560, lineHeight: 19 },
  statsRow: { gap: SPACING.xl },
  statsRowWide: { flexDirection: 'row', alignItems: 'flex-start' },
  statItem: { flex: 1, gap: 2, minWidth: 140 },
  statValue: { fontSize: 34, lineHeight: 38 },
  statSource: { fontSize: 10, marginTop: 2 },
});

export const TrustDivider = Divider;
