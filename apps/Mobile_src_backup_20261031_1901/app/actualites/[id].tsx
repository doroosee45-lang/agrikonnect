import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Button, Card, EmptyState, Reveal, Section, Text } from '@/components/ui';
import { RELEASE_TRACK } from '@/lib/platform';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * Détail d'une entrée du journal.
 *
 * La plateforme ne publie aucun contenu éditorial inventé : le journal décrit
 * le périmètre fonctionnel réellement livré (V1 → V5), donc le détail est lu
 * dans `RELEASE_TRACK`, la même source que la page liste.
 */
export default function ActualiteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = RELEASE_TRACK.find((item) => item.tag.toLowerCase() === String(id ?? '').toLowerCase());

  return (
    <PublicShell active="actualites">
      <PageHeader index="—" eyebrow="Journal" title={entry ? `${entry.tag} · ${entry.name}` : 'Entrée introuvable'} subtitle={entry ? 'Périmètre fonctionnel réellement livré.' : undefined} />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        {entry ? (
          <Reveal index={0} variant="up">
            <Card tone="white" style={styles.card}>
              <Text preset="overline" color={COLORS.gold}>{entry.tag}</Text>
              <Text preset="h2">{entry.name}</Text>
              <Text preset="body">{entry.body}</Text>
              <View style={styles.actions}>
                <Button label="Voir les flux opérationnels" variant="outline" onPress={() => router.push('/explore')} />
                <Button label="Retour au journal" variant="ghost" onPress={() => router.push('/actualites')} />
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
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, card: { gap: SPACING.sm }, actions: { gap: SPACING.xs, marginTop: SPACING.sm } });
