import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Chip, EmptyState, ErrorState, LoadingState, PressableCard, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatCurrency, formatDate } from '@/lib/format';
import { orderApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function OrganizationOrders() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.orders.list({ limit: 100 }),
    queryFn: () => orderApi.list({ limit: 100 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Commandes" subtitle="Commandes de votre organisation." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Commandes" icon="receipt-outline">
          {query.isLoading ? <LoadingState count={3} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucune commande" description="Les commandes apparaîtront ici." icon="receipt-outline" /> : (
            <View style={styles.list}>
              {items.map((order, index) => (
                <Reveal key={order.id} index={index} variant="up">
                  <PressableCard onPress={() => router.push(`/farmer/orders/${order.id}`)}>
                    <View style={styles.row}>
                      <View style={styles.rowBody}>
                        <Text preset="bodyMedium" style={{ fontFamily: 'monospace' }}>{order.number}</Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          {formatDate(order.createdAt, locale)} · {order.totalAmount !== null ? formatCurrency(order.totalAmount, order.currency, locale) : 'montant non renseigné'}
                        </Text>
                      </View>
                      <View style={styles.right}>
                        <Chip label={order.status} tone={order.status === 'DISPUTED' ? 'error' : 'neutral'} size="sm" />
                        <Chip label={order.paymentStatus} tone={order.paymentStatus === 'PAID' ? 'success' : 'neutral'} size="sm" />
                      </View>
                    </View>
                  </PressableCard>
                </Reveal>
              ))}
            </View>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 }, right: { alignItems: 'flex-end', gap: 4 } });
