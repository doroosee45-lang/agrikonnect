import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useI18n } from '@/i18n';
import { COLORS, DARK, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

import { Accordion, Button, Card, Chip, Reveal, Section, Text } from '@/components/ui';
import { RELEASE_TRACK } from '@/lib/platform';
import { FAQ_ENTRIES } from '@/lib/faq';
import { VERT } from '../../../theme/agrikonnect';

/** Sélection affichée sur l'accueil ; la page /faq expose la liste complète. */
const HOME_FAQ_IDS = ['provenance', 'verification', 'contacts', 'carte', 'statistiques', 'ia', 'prix', 'compte'];

/**
 * Section 11 — le périmètre fonctionnel, version par version.
 *
 * Ce calendrier est celui du cahier des charges (V1 → V5) : il décrit ce qui
 * est livré, pas une promesse commerciale.
 */
export function RoadmapSection() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const versions = RELEASE_TRACK;

  return (
    <Section
      index={8}
      eyebrow="Périmètre"
      title="Cinq versions, une même exigence"
      subtitle="Chaque version ajoute des usages sans jamais assouplir la règle de provenance des données."
      background={COLORS.naturalWhite}
    >
      <View style={[styles.roadmap, wide ? styles.roadmapWide : null]}>
        <View style={[styles.rail, wide ? styles.railWide : null]} />
        {versions.map((version, index) => (
          <Reveal key={version.tag} index={index} variant="up" style={styles.roadmapItem}>
            <View style={styles.node}>
              <View style={styles.nodeDot}>
                <Text preset="caption" color={COLORS.pureWhite}>
                  {version.tag.replace('V', '')}
                </Text>
              </View>
            </View>
            <Card tone="white" style={styles.roadmapCard}>
              <View style={styles.roadmapHeader}>
                <Text preset="h3" color={COLORS.forestGreen}>
                  {version.tag} · {version.name}
                </Text>
                <Chip label="Livré" tone="success" size="sm" icon="checkmark-circle" />
              </View>
              <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
                {version.body}
              </Text>
            </Card>
          </Reveal>
        ))}
      </View>
    </Section>
  );
}

/** Section 12 — FAQ. Réponses fondées sur le comportement réel de la plateforme. */
export function FaqSection() {
  const { t } = useI18n();

  const items = FAQ_ENTRIES.filter((entry) => HOME_FAQ_IDS.includes(entry.id)).map(
    ({ id, question, answer }) => ({ id, question, answer }),
  );

  return (
    <Section
      index={9}
      eyebrow="Questions"
      title={t('home.faqTitle')}
      subtitle={t('home.faqSubtitle')}
      background={COLORS.pureWhite}
    >
      <Reveal variant="up">
        <Accordion items={items} initialOpenId="provenance" />
      </Reveal>
    </Section>
  );
}

/** Section 13 — appel à l'action final. */
export function ContactCta() {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  return (
    <View style={styles.ctaWrapper}>
      <View style={styles.ctaInner}>
        <Reveal variant="up">
          <View style={[styles.ctaContent, wide ? styles.ctaContentWide : null]}>
            <View style={styles.ctaText}>
              <Text preset="overline" color={COLORS.gold}>
                Contact
              </Text>
              <Text preset="display" color={DARK.text} style={styles.ctaTitle}>
                {t('home.contactTitle')}
              </Text>
              <Text preset="lead" color="rgba(246, 247, 242, 0.74)" style={styles.lineHeight}>
                {t('home.contactSubtitle')}
              </Text>
            </View>

            <View style={styles.ctaActions}>
              <Button
                label={t('nav.contact')}
                onPress={() => router.push('/contact')}
                variant="gold"
                size="lg"
                icon="mail-outline"
                fullWidth={!wide}
              />
              <Button
                label={t('nav.signup')}
                onPress={() => router.push('/auth/register')}
                variant="dark"
                size="lg"
                icon="person-add-outline"
                fullWidth={!wide}
              />
            </View>
          </View>
        </Reveal>

        <Reveal index={1} variant="fade">
          <View style={styles.ctaFooter}>
            <Ionicons name="shield-checkmark-outline" size={15} color={COLORS.livingGreen} />
            <Text preset="caption" color={DARK.textMuted}>
              Aucune donnée de contact n’est collectée sur ce site sans votre envoi explicite du formulaire.
            </Text>
          </View>
        </Reveal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lineHeight: { lineHeight: 20 },
  roadmap: { gap: SPACING.md },
  roadmapWide: { flexDirection: 'row', flexWrap: 'wrap' },
  rail: { display: 'none' },
  railWide: { display: 'none' },
  roadmapItem: { flex: 1, minWidth: 250, gap: SPACING.sm },
  node: { flexDirection: 'row', alignItems: 'center' },
  nodeDot: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.forestGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roadmapCard: { gap: SPACING.sm, height: '100%' },
  roadmapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  ctaWrapper: { backgroundColor: VERT[950], width: '100%' },
  ctaInner: {
    paddingHorizontal: 20,
    paddingVertical: 56,
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    gap: SPACING.xl,
  },
  ctaContent: { gap: SPACING.xl },
  ctaContentWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctaText: { gap: SPACING.sm, flex: 1 },
  ctaTitle: { maxWidth: 520 },
  ctaActions: { gap: SPACING.md },
  ctaFooter: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
});

export const FAQ_TINT = TINTS.goldBg;
