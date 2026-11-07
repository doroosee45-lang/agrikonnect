import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { Chip, EmptyState, ErrorState, LoadingState, PressableCard, Reveal, Section, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { publicApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';

/** PUB-01 — annuaire public des producteurs (accès anonyme). */
export default function PublicSiteProducteurs() {
  const query = useQuery({
    queryKey: queryKeys.public.farms({ limit: 100 }),
    queryFn: () => publicApi.farms({ limit: 100 }).then((r) => r.data),
    retry: false,
  });
  const items = query.data ?? [];
  return (
    <PublicShell active="producteurs">
      <PageHeader index="02" eyebrow="Annuaire" title="Producteurs" subtitle="Exploitations publiées par leurs propriétaires." />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        {query.isLoading ? <LoadingState count={3} height={100} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucun producteur" description="Aucune exploitation publique pour le moment." icon="people-outline" /> : (
          <View style={styles.list}>
            {items.map((farm, index) => (
              <Reveal key={farm.slug} index={index} variant="up">
                <PressableCard onPress={() => router.push(`/public-site/producteurs/${farm.slug}` as never)}>
                  <View style={styles.row}>
                    <View style={styles.rowBody}>
                      <Text preset="bodyMedium">{farm.name}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {farm.countryCode}{farm.province ? ` · ${farm.province}` : ''}{farm.totalAreaHa !== null ? ` · ${farm.totalAreaHa} ha` : ''}
                      </Text>
                    </View>
                    {farm.verificationStatus ? <Chip label={farm.verificationStatus} tone={farm.verificationStatus === 'VERIFIED' ? 'success' : 'neutral'} size="sm" /> : null}
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
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 } });
