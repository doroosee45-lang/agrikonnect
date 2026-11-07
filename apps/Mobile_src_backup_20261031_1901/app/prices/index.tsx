import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import { Card, EmptyState, ErrorState, LoadingState, PressableCard, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatCurrency, formatDate } from '@/lib/format';
import { priceApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * PRC — prix de marché sourcés.
 *
 * Le backend peut répondre `available: false` avec un motif explicite
 * (référentiel vide, source indisponible) : ce motif est affiché tel quel,
 * jamais remplacé par une valeur inventée.
 */
export default function PricesIndex() {
  const { locale } = useI18n();
  const query = useQuery({
    queryKey: queryKeys.prices.list({ limit: 100 }),
    queryFn: () => priceApi.list({ limit: 100 }).then((r) => r.data),
    retry: false,
  });
  const items = query.data?.items ?? [];
  const available = query.data?.available ?? true;
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Prix des cultures" subtitle="Prix de marché sourcés et datés." />
      <Section bare contentStyle={styles.section}>
        {query.isLoading ? <LoadingState count={5} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !available ? (
          <Card tone="pale">
            <Text preset="bodySm" color={COLORS.slateGray}>{query.data?.message ?? 'Prix indisponibles pour le moment.'}</Text>
          </Card>
        ) : items.length === 0 ? <EmptyState title="Aucun prix" description="Les prix de marché apparaîtront ici." icon="trending-up-outline" /> : (
          <View style={styles.list}>
            {items.map((price, index) => (
              <Reveal key={price.id} index={index} variant="up">
                <PressableCard onPress={() => router.push(`/prices/${encodeURIComponent(price.cropId)}`)}>
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
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 } });
