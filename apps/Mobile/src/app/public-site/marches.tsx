import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { AuthGate, Card, EmptyState, ErrorState, LoadingState, PressableCard, Reveal, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatCurrency, formatDate } from '@/lib/format';
import { priceApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** PRC — prix de marché sourcés et datés (compte requis). */
export default function PublicSiteMarches() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.prices.list({ limit: 100 }),
    queryFn: () => priceApi.list({ limit: 100 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data?.items ?? [];
  return (
    <PublicShell active="marches">
      <PageHeader index="10" eyebrow={t('ui.marches')} title={t('ui.prixDeMarche')} subtitle={t('ui.chaquePrixEstSourceDateEt')} />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.prixDeMarche')} icon="trending-up-outline" description={t('ui.lesSeriesDePrixSontReservees')}>
          {query.isLoading ? <LoadingState count={4} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : (query.data?.available ?? true) === false ? (
            <Card tone="pale">
              <Text preset="bodySm" color={COLORS.slateGray}>{query.data?.message ?? t('ui.prixIndisponiblesPourLeMoment')}</Text>
            </Card>
          ) : items.length === 0 ? <EmptyState title={t('ui.aucunPrix')} description={t('ui.aucuneObservationDeMarcheDisponible')} icon="trending-up-outline" /> : (
            <View style={styles.list}>
              {items.map((price, index) => (
                <Reveal key={price.id} index={index} variant="up">
                  <PressableCard onPress={() => router.push(`/prices/${encodeURIComponent(price.cropId)}` as never)}>
                    <View style={styles.row}>
                      <View style={styles.rowBody}>
                        <Text preset="bodyMedium">{price.market}</Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          {price.city ?? price.countryCode} · {formatDate(price.observedAt, locale)} · {price.sourceLabel ?? price.source}
                        </Text>
                      </View>
                      <Text preset="bodyMedium">{formatCurrency(price.price, price.currency, locale)} / {price.unit}</Text>
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
