import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Button, Card, Chip, EmptyState, Reveal, Section, Text } from '@/components/ui';
import { RELEASE_TRACK } from '@/lib/platform';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function PublicSiteActualiteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = RELEASE_TRACK.find((item) => item.tag.toLowerCase() === String(id ?? '').toLowerCase());

  return (
    <PublicShell active="actualites">
      <PageHeader index="08" eyebrow="Journal" title={entry ? `${entry.tag} · ${entry.name}` : 'Entrée introuvable'} subtitle={entry ? 'Périmètre fonctionnel réellement livré.' : undefined} />
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
                <Button label="Voir les services" variant="outline" onPress={() => router.push('/public-site/services')} />
                <Button label="Retour au journal" variant="ghost" onPress={() => router.push('/public-site/actualites')} />
              </View>
            </Card>
          </Reveal>
        ) : (
          <EmptyState title="Entrée introuvable" description="Aucune entrée du journal ne correspond à cet identifiant." icon="newspaper-outline" />
        )}
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, card: { gap: SPACING.sm }, chips: { flexDirection: 'row', gap: SPACING.xs }, actions: { gap: SPACING.xs, marginTop: SPACING.sm } });
