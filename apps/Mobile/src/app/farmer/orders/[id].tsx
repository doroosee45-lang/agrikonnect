import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Card, Chip, ErrorState, LoadingState, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { orderApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function FarmerOrderDetail() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.orders.one(id ?? ''),
    queryFn: () => orderApi.get(id ?? '').then((r) => r.data),
    enabled: isAuthenticated && Boolean(id),
    retry: false,
  });
  const order = query.data;
  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title={order?.number ?? '—'} subtitle={t('ui.detailDeLaCommande')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.commande')} icon="receipt-outline">
          {query.isLoading ? <LoadingState count={1} height={120} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !order ? <Text preset="body">{t('ui.commandeIntrouvable')}</Text> : (
            <Card tone="white" style={styles.card}>
              <View style={styles.field}>
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.reference')}</Text>
                <Text preset="bodyMedium" style={{ fontFamily: 'monospace' }}>{order.number}</Text>
              </View>
              <View style={styles.field}>
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.statut')}</Text>
                <Chip label={order.status} tone={order.status === 'DISPUTED' ? 'error' : 'neutral'} size="sm" />
              </View>
              <View style={styles.field}>
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.montant')}</Text>
                <Text preset="bodySm">{order.totalAmount !== null ? `${order.totalAmount} ${order.currency}` : '—'}</Text>
              </View>
              <View style={styles.field}>
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.paiement')}</Text>
                <Chip label={order.paymentStatus} tone={order.paymentStatus === 'PAID' ? 'success' : 'neutral'} size="sm" />
              </View>
              <View style={styles.field}>
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.creeeLe')}</Text>
                <Text preset="bodySm">{formatDate(order.createdAt, locale)}</Text>
              </View>
            </Card>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, card: { gap: SPACING.sm }, field: { gap: 4 } });
