import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { cooperativeApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** Offres groupées de la coopérative (`GET /cooperatives/:id/group-offers`). */
export default function OrganizationOffers() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const current = useQuery({
    queryKey: queryKeys.cooperatives.current,
    queryFn: () => cooperativeApi.current().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const cooperativeId = current.data?.id ?? null;
  const query = useQuery({
    queryKey: queryKeys.cooperatives.groupOffers(cooperativeId ?? ''),
    queryFn: () => cooperativeApi.groupOffers(cooperativeId ?? '').then((r) => r.data),
    enabled: isAuthenticated && Boolean(cooperativeId),
    retry: false,
  });
  const items = query.data ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Offres groupées" subtitle="Offres consolidées de la coopérative." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Offres groupées" icon="pricetag-outline">
          {query.isLoading ? <LoadingState count={3} height={100} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucune offre" description="Aucune offre groupée créée." icon="pricetag-outline" /> : (
            <View style={styles.list}>
              {items.map((row, index) => {
                const offer = row as Record<string, unknown>;
                const createdAt = typeof offer.createdAt === 'string' ? offer.createdAt : null;
                return (
                  <Reveal key={String(offer.id ?? index)} index={index} variant="up">
                    <Card tone="white" style={styles.row}>
                      <View style={styles.rowBody}>
                        <Text preset="bodyMedium">{String(offer.title ?? offer.cropId ?? 'Offre')}</Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          {offer.quantity !== undefined ? `${String(offer.quantity)} ${String(offer.unit ?? '')}` : 'quantité non renseignée'}
                          {createdAt ? ` · ${formatDate(createdAt, locale)}` : ''}
                        </Text>
                      </View>
                      <Chip label={String(offer.status ?? '—')} tone="neutral" size="sm" />
                    </Card>
                  </Reveal>
                );
              })}
            </View>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 } });
