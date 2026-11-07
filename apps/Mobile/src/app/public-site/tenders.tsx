import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { AuthGate, Chip, EmptyState, ErrorState, LoadingState, PressableCard, Reveal, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { tenderApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function PublicSiteTenders() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.tenders.list({ limit: 100 }),
    queryFn: () => tenderApi.list({ limit: 100 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data ?? [];
  return (
    <PublicShell active="tenders">
      <PageHeader index="11" eyebrow="Appels d'offres" title="Appels d'offres" subtitle="Consultations lancées par des acheteurs, avec date limite." />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Appels d'offres" icon="megaphone-outline" description="Les appels d'offres sont réservés aux comptes connectés.">
          {query.isLoading ? <LoadingState count={3} height={100} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucun appel d'offres" description="Aucune consultation ouverte." icon="megaphone-outline" /> : (
            <View style={styles.list}>
              {items.map((tender, index) => (
                <Reveal key={tender.id} index={index} variant="up">
                  <PressableCard onPress={() => router.push(`/tenders` as never)}>
                    <View style={styles.row}>
                      <View style={styles.rowBody}>
                        <Text preset="bodyMedium">{tender.title}</Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          {tender.quantity} {tender.unit} · {tender.destinationCountry} · limite {formatDate(tender.deadline, locale)}
                        </Text>
                      </View>
                      <Chip label={tender.status} tone={tender.status === 'OPEN' ? 'success' : 'neutral'} size="sm" />
                    </View>
                  </PressableCard>
                </Reveal>
              ))}
            </View>
          )}
        </AuthGate>
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 } });
