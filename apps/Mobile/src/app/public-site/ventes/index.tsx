import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { AuthGate, Chip, EmptyState, ErrorState, LoadingState, PressableCard, Reveal, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatCurrency, formatDate } from '@/lib/format';
import { orderApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** Commandes — le prix est figé à la commande (instantané), il ne varie plus. */
export default function PublicSiteVentes() {
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
    <PublicShell active="ventes">
      <PageHeader index="17" eyebrow="Ventes" title="Commandes" subtitle="Prix et quantités figés à la commande : l\u2019instantané ne varie plus." />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Commandes" icon="cart-outline" description="Les commandes sont réservées aux comptes connectés.">
          {query.isLoading ? <LoadingState count={3} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucune commande" description="Aucune commande enregistrée." icon="cart-outline" /> : (
            <View style={styles.list}>
              {items.map((order, index) => (
                <Reveal key={order.id} index={index} variant="up">
                  <PressableCard onPress={() => router.push(`/public-site/ventes/${order.id}` as never)}>
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
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 }, right: { alignItems: 'flex-end', gap: 4 } });
