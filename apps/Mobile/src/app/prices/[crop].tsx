import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { Card, EmptyState, ErrorState, LoadingState, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatCurrency, formatDate } from '@/lib/format';
import { priceApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function PriceCropDetail() {
  const { crop } = useLocalSearchParams<{ crop: string }>();
  const { locale } = useI18n();
  const cropId = crop ?? '';
  const query = useQuery({
    queryKey: queryKeys.prices.list({ cropId, limit: 100 }),
    queryFn: () => priceApi.list({ cropId, limit: 100 }).then((r) => r.data),
    enabled: cropId.length > 0,
    retry: false,
  });
  const items = query.data?.items ?? [];
  const latest = items[0];
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={cropId || '—'} subtitle="Historique des prix de marché." />
      <Section bare contentStyle={styles.section}>
        {query.isLoading ? <LoadingState count={3} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucun prix" description="Aucune observation de marché pour cette culture." icon="trending-up-outline" /> : (
          <Card tone="white" style={styles.card}>
            <Text preset="overline" color={COLORS.slateGray}>Dernière observation</Text>
            <Text preset="h2">{formatCurrency(latest.price, latest.currency, locale)} / {latest.unit}</Text>
            <Text preset="caption" color={COLORS.slateGray}>
              {latest.market}{latest.city ? ` · ${latest.city}` : ''} · {formatDate(latest.observedAt, locale)} · {latest.sourceLabel ?? latest.source}
            </Text>
            {items.length > 1 ? (
              <View style={styles.history}>
                {items.slice(1, 12).map((price) => (
                  <View key={price.id} style={styles.historyRow}>
                    <Text preset="caption" color={COLORS.slateGray}>{price.market} · {formatDate(price.observedAt, locale)}</Text>
                    <Text preset="bodySm">{formatCurrency(price.price, price.currency, locale)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        )}
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, card: { gap: SPACING.xs }, history: { gap: SPACING.xs, marginTop: SPACING.md }, historyRow: { flexDirection: 'row', justifyContent: 'space-between' } });
