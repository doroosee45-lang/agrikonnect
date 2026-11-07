import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { transportApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * Transport.
 *
 * Le backend n'expose pas d'annuaire public de transporteurs : seules les
 * demandes de transport de l'organisation sont lisibles (`GET /transport`).
 * L'écran affiche donc ces demandes, et non une liste inventée de prestataires.
 */
export default function PublicSiteTransporters() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.transport.list({ limit: 100 }),
    queryFn: () => transportApi.requests({ limit: 100 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data ?? [];
  return (
    <PublicShell active="transporters">
      <PageHeader index="16" eyebrow="Logistique" title="Transport" subtitle="Demandes de transport et transporteurs assignés à vos commandes." />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Transport" icon="car-outline" description="Il n\u2019existe pas d\u2019annuaire public de transporteurs : seules vos demandes sont affichées.">
          {query.isLoading ? <LoadingState count={3} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucune demande" description="Aucune demande de transport enregistrée." icon="car-outline" /> : (
            <View style={styles.list}>
              {items.map((request, index) => (
                <Reveal key={request.id} index={index} variant="up">
                  <Card tone="white" style={styles.row}>
                    <View style={styles.rowBody}>
                      <Text preset="bodyMedium">Transport de commande</Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {formatDate(request.createdAt, locale)} · {request.transporterOrgId ? 'transporteur assigné' : 'en attente d\u2019assignation'}
                      </Text>
                    </View>
                    <Chip label={request.status} tone="neutral" size="sm" />
                  </Card>
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
