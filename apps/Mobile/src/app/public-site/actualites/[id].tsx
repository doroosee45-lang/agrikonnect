import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Button, Card, Chip, EmptyState, Reveal, Section, Text } from '@/components/ui';
import { RELEASE_TRACK } from '@/lib/platform';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';

export default function PublicSiteActualiteDetail() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = RELEASE_TRACK.find((item) => item.tag.toLowerCase() === String(id ?? '').toLowerCase());

  return (
    <PublicShell active="actualites">
      <PageHeader index="08" eyebrow={t('ui.journal')} title={entry ? `${entry.tag} · ${entry.name}` : t('ui.entreeIntrouvable')} subtitle={entry ? t('ui.perimetreFonctionnelReellementLivre') : undefined} />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        {entry ? (
          <Reveal index={0} variant="up">
            <Card tone="white" style={styles.card}>
              <View style={styles.chips}>
                <Chip label={entry.tag} tone="success" size="sm" />
                <Chip label={entry.name} tone="neutral" size="sm" />
              </View>
              <Text preset="body">{entry.body}</Text>
              <View style={styles.actions}>
                <Button label={t('ui.voirLesServices')} variant="outline" onPress={() => router.push('/public-site/services')} />
                <Button label={t('ui.retourAuJournal')} variant="ghost" onPress={() => router.push('/public-site/actualites')} />
              </View>
            </Card>
          </Reveal>
        ) : (
          <EmptyState title={t('ui.entreeIntrouvable')} description={t('ui.aucuneEntreeDuJournalNeCorrespond')} icon="newspaper-outline" />
        )}
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, card: { gap: SPACING.sm }, chips: { flexDirection: 'row', gap: SPACING.xs }, actions: { gap: SPACING.xs, marginTop: SPACING.sm } });
