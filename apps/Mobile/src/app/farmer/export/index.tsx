import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, PressableCard, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { exportApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * FARMER — dossiers d'exportation (EXP-01).
 *
 * Un dossier d'export n'est pas une commande : il porte l'incoterm, la
 * destination et le nombre de pièces rattachées sur les quatre obligatoires.
 */

const STATUS_TONE = {
  DRAFT: 'neutral',
  CONFIRMED: 'info',
  IN_CONTROL: 'warning',
  CERTIFIED: 'info',
  IN_TRANSIT: 'warning',
  DELIVERED: 'success',
  CLOSED: 'neutral',
  CANCELLED: 'error',
} as const;

export default function FarmerExport() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.exports.list({ limit: 100 }),
    queryFn: () => exportApi.list({ limit: 100 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data?.items ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title="Exportations" subtitle="Dossiers d'exportation et conformité documentaire." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Exportations" icon="boat-outline">
          {query.isLoading ? (
            <LoadingState count={3} height={90} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title="Aucun dossier d'exportation"
              description="Aucun dossier n'a été ouvert. Un dossier est distinct d'une commande."
              icon="boat-outline"
            />
          ) : (
            <View style={styles.list}>
              {items.map((order, index) => (
                <Reveal key={order.id} index={index} variant="up">
                  <PressableCard onPress={() => router.push(`/farmer/export/${order.id}`)}>
                    <View style={styles.row}>
                      <View style={styles.rowBody}>
                        <Text preset="bodyMedium" style={{ fontFamily: 'monospace' }}>
                          {order.reference}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          {order.destinationCountry}
                          {order.incoterm ? ` · ${order.incoterm}` : ''} · {formatDate(order.createdAt, locale)}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          {order.totalAmount !== null ? `${order.totalAmount} ${order.currency}` : 'montant non renseigné'} ·{' '}
                          pièces {order._count?.documents ?? 0}/4
                        </Text>
                      </View>
                      <Chip label={order.status} tone={STATUS_TONE[order.status]} size="sm" />
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

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  list: { gap: SPACING.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowBody: { flex: 1, gap: 2 },
});
