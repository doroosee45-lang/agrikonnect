import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Button, Card, EmptyState, Reveal, Section, Text } from '@/components/ui';
import { RELEASE_TRACK } from '@/lib/platform';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';

/**
 * Détail d'une entrée du journal.
 *
 * La plateforme ne publie aucun contenu éditorial inventé : le journal décrit
 * le périmètre fonctionnel réellement livré (V1 → V5), donc le détail est lu
 * dans `RELEASE_TRACK`, la même source que la page liste.
 */
export default function ActualiteDetail() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = RELEASE_TRACK.find((item) => item.tag.toLowerCase() === String(id ?? '').toLowerCase());

  return (
    <PublicShell active="actualites">
      <PageHeader index="—" eyebrow={t('ui.journal')} title={entry ? `${entry.tag} · ${entry.name}` : t('ui.entreeIntrouvable')} subtitle={entry ? t('ui.perimetreFonctionnelReellementLivre') : undefined} />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        {entry ? (
          <Reveal index={0} variant="up">
            <Card tone="white" style={styles.card}>
              <Text preset="overline" color={COLORS.gold}>{entry.tag}</Text>
              <Text preset="h2">{entry.name}</Text>
              <Text preset="body">{entry.body}</Text>
              <View style={styles.actions}>
                <Button label={t('ui.voirLesFluxOperationnels')} variant="outline" onPress={() => router.push('/explore')} />
                <Button label={t('ui.retourAuJournal')} variant="ghost" onPress={() => router.push('/actualites')} />
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
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, card: { gap: SPACING.sm }, actions: { gap: SPACING.xs, marginTop: SPACING.sm } });
