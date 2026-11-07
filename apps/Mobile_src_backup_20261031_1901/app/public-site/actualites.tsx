import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Card, Chip, PressableCard, Reveal, Section, Text } from '@/components/ui';
import { RELEASE_TRACK } from '@/lib/platform';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * Journal du réseau (surface publique).
 *
 * Aucun contenu éditorial n'est inventé : le journal décrit le périmètre
 * fonctionnel réellement livré, lu dans `RELEASE_TRACK`.
 */
export default function PublicSiteActualites() {
  return (
    <PublicShell active="actualites">
      <PageHeader index="08" eyebrow="Journal" title="Ce que la plateforme sait faire" subtitle="Périmètre livré version par version, sans communiqué sans substance." />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <View style={styles.list}>
          {RELEASE_TRACK.map((release, index) => (
            <Reveal key={release.tag} index={index} variant="up">
              <PressableCard onPress={() => router.push(`/public-site/actualites/${release.tag.toLowerCase()}` as never)}>
                <View style={styles.card}>
                  <View style={styles.chips}>
                    <Chip label={release.tag} tone="success" size="sm" />
                    <Chip label={release.name} tone="neutral" size="sm" />
                  </View>
                  <Text preset="bodySm" color={COLORS.slateGray}>{release.body}</Text>
                </View>
              </PressableCard>
            </Reveal>
          ))}
        </View>
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, list: { gap: SPACING.sm }, card: { gap: SPACING.xs }, chips: { flexDirection: 'row', gap: SPACING.xs } });
