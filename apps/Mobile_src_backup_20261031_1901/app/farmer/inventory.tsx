import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { inventoryApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function FarmerInventory() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.inventory.all,
    queryFn: () => inventoryApi.list({ limit: 100 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title="Stock" subtitle="Inventaire de vos produits." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Stock" icon="cube-outline">
          {query.isLoading ? <LoadingState count={3} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Stock vide" description="Aucun produit en stock." icon="cube-outline" /> : (
            <View style={styles.list}>
              {items.map((item, index) => {
                const stock = item.stock ?? 0;
                const low = item.lowStockThreshold !== null && stock <= item.lowStockThreshold;
                return (
                  <Reveal key={item.id} index={index} variant="up">
                    <Card tone="white" style={styles.row}>
                      <View style={styles.rowBody}>
                        <Text preset="bodyMedium">{item.label}</Text>
                        <Text preset="caption" color={COLORS.slateGray}>{item.cropId ?? 'culture non renseignée'} · seuil bas {item.lowStockThreshold ?? '—'}</Text>
                      </View>
                      <Chip label={`${formatNumber(stock, locale)} ${item.unit}`} tone={low ? 'warning' : 'neutral'} size="sm" />
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
