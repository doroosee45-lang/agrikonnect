import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  ErrorState,
  FilterChip,
  LoadingState,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatCurrency, formatDate } from '@/lib/format';
import { orderApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const FILTERS = [
  { key: '', label: 'Toutes' },
  { key: 'PENDING', label: 'En attente' },
  { key: 'CONFIRMED', label: 'Confirmées' },
  { key: 'DELIVERED', label: 'Livrées' },
  { key: 'CANCELLED', label: 'Annulées' },
] as const;

const STATUS_TONES: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  PAID: 'success',
  SHIPPED: 'info',
  DELIVERED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'error',
  DISPUTED: 'error',
};

/** Commandes : statut, paiement et suivi d'exécution. */
export default function Marketplace() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [status, setStatus] = useState('');

  const orders = useQuery({
    queryKey: queryKeys.orders.list({ status, limit: 50 }),
    queryFn: () => orderApi.list({ status: status || undefined, limit: 50 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  const items = orders.data ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Commandes" subtitle="Suivi d'exécution : statut, paiement, litiges." />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title="Connexion requise"
          description="Connectez-vous pour suivre vos commandes, qu'elles soient acheteur ou vendeur."
          icon="receipt-outline"
        >
          <View style={styles.filters}>
            <ChipRow>
              {FILTERS.map((item) => (
                <FilterChip key={item.key || 'all'} label={item.label} active={status === item.key} onPress={() => setStatus(item.key)} />
              ))}
            </ChipRow>
            <Button label="Stock & mouvements" onPress={() => router.push('/marketplace/inventory')} variant="ghost" size="sm" icon="cube-outline" />
          </View>

          {orders.isLoading ? (
            <LoadingState count={3} height={110} />
          ) : orders.isError ? (
            <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title="Aucune commande"
              description="Une commande naît d'une offre acceptée : le prix et les quantités sont figés dans un instantané."
              icon="receipt-outline"
            />
          ) : (
            <View style={styles.list}>
              {items.map((order, index) => (
                <Reveal key={order.id} index={index} variant="up">
                  <Card tone="white" style={styles.card}>
                    <View style={styles.head}>
                      <View style={styles.headText}>
                        <Text preset="bodyMedium" color={COLORS.textPrimary}>
                          {order.number}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          passée le {formatDate(order.createdAt, locale)} · version {order.version}
                        </Text>
                      </View>
                      <View style={styles.chips}>
                        <Chip label={order.status} tone={STATUS_TONES[order.status] ?? 'neutral'} size="sm" />
                        <Chip label={order.paymentStatus} tone={order.paymentStatus === 'PAID' ? 'success' : 'warning'} size="sm" />
                      </View>
                    </View>

                    <View style={styles.amountRow}>
                      <Text preset="numeric" color={COLORS.forestGreen} style={styles.amount}>
                        {order.totalAmount !== null ? formatCurrency(order.totalAmount, order.currency, locale) : 'Montant à confirmer'}
                      </Text>
                      <Button label="Suivre" onPress={() => router.push(`/marketplace/${order.id}` as never)} variant="outline" size="sm" icon="arrow-forward-outline" />
                    </View>

                    <View style={styles.meta}>
                      <Ionicons name="swap-horizontal-outline" size={12} color={COLORS.slateGray} />
                      <Text preset="caption" color={COLORS.slateGray}>
                        acheteur {order.buyerOrgId} · vendeur {order.sellerOrgId}
                      </Text>
                    </View>
                  </Card>
                </Reveal>
              ))}
            </View>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  filters: { gap: SPACING.sm },
  list: { gap: SPACING.md },
  card: { gap: SPACING.md },
  head: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  headText: { flex: 1, gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  amount: { fontSize: 20 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
