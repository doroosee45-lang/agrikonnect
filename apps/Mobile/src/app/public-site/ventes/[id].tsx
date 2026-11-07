import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { AuthGate, Card, Chip, ErrorState, LoadingState, Reveal, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatCurrency, formatDate } from '@/lib/format';
import { orderApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function PublicSiteVenteDetail() {
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
    <PublicShell active="ventes">
      <PageHeader index="17" eyebrow="Commande" title={order?.number ?? 'Fiche commande'} subtitle="Instantané figé à la commande." />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Commande" icon="cart-outline">
          {query.isLoading ? <LoadingState count={1} height={150} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !order ? <Text preset="body">Commande introuvable.</Text> : (
            <Reveal index={0} variant="up">
              <Card tone="white" style={styles.card}>
                <Text preset="h3" style={{ fontFamily: 'monospace' }}>{order.number}</Text>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Statut</Text>
                  <Chip label={order.status} tone={order.status === 'DISPUTED' ? 'error' : 'neutral'} size="sm" />
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Paiement</Text>
                  <Chip label={order.paymentStatus} tone={order.paymentStatus === 'PAID' ? 'success' : 'neutral'} size="sm" />
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Montant</Text>
                  <Text preset="bodySm">{order.totalAmount !== null ? formatCurrency(order.totalAmount, order.currency, locale) : 'non renseigné'}</Text>
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Passée le</Text>
                  <Text preset="bodySm">{formatDate(order.createdAt, locale)}</Text>
                </View>
              </Card>
            </Reveal>
          )}
        </AuthGate>
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, card: { gap: SPACING.sm }, field: { gap: 4 } });
