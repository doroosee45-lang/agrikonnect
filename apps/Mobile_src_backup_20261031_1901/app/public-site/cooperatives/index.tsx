import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { EmptyState, ErrorState, LoadingState, PressableCard, Reveal, Section, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { organizationApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';

/**
 * Coopératives.
 *
 * L'annuaire public (`/public/farms`) ne filtre pas par type d'organisation :
 * les coopératives sont lues sur `GET /organizations?type=COOPERATIVE`, seul
 * endpoint qui expose ce critère.
 */
export default function PublicSiteCooperatives() {
  const query = useQuery({
    queryKey: [...queryKeys.organizations.all, 'COOPERATIVE'] as unknown[],
    queryFn: () => organizationApi.list({ type: 'COOPERATIVE', limit: 100 }).then((r) => r.data),
    retry: false,
  });
  const items = query.data ?? [];
  return (
    <PublicShell active="cooperatives">
      <PageHeader index="02" eyebrow="Réseau" title="Coopératives" subtitle="Organisations collectives enregistrées." />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        {query.isLoading ? <LoadingState count={3} height={100} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucune coopérative" description="Aucune coopérative enregistrée pour le moment." icon="people-outline" /> : (
          <View style={styles.list}>
            {items.map((coop, index) => (
              <Reveal key={coop.id} index={index} variant="up">
                <PressableCard onPress={() => router.push(`/cooperatives/${coop.slug ?? coop.id}`)}>
                  <View style={styles.rowBody}>
                    <Text preset="bodyMedium">{coop.name}</Text>
                    <Text preset="caption" color={COLORS.slateGray}>{coop.countryCode}{coop.description ? ` · ${coop.description}` : ''}</Text>
                  </View>
                </PressableCard>
              </Reveal>
            ))}
          </View>
        )}
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, rowBody: { flex: 1, gap: 2 } });
