import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { transportApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function OrganizationTransport() {
  const { t } = useI18n();
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
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('ui.transport')} subtitle={t('ui.demandesLogistiquesDeLOrganisation')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.transport')} icon="car-outline">
          {query.isLoading ? <LoadingState count={3} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title={t('ui.aucuneDemande')} description={t('ui.lesDemandesDeTransportApparaitrontIci')} icon="car-outline" /> : (
            <View style={styles.list}>
              {items.map((request, index) => (
                <Reveal key={request.id} index={index} variant="up">
                  <Card tone="white" style={styles.row}>
                    <View style={styles.rowBody}>
                      <Text preset="bodyMedium">{t('ui.transportRattacheAUneCommande')}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {formatDate(request.createdAt, locale)} · {request.transporterOrgId ? t('ui.transporteurAssigne') : t('ui.enAttenteDAssignation')}
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
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 } });
