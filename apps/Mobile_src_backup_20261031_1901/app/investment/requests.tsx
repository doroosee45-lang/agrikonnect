import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { investApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function InvestmentRequests() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: [...queryKeys.invest.followed, 'requests'] as unknown[],
    queryFn: () => investApi.dashboard().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = (query.data?.requests ?? []) as Array<Record<string, unknown>>;
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Demandes de contact" subtitle="Demandes reçues des producteurs." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Demandes de contact" icon="mail-outline">
          {query.isLoading ? <LoadingState count={3} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucune demande" description="Les demandes de contact apparaîtront ici." icon="mail-outline" /> : (
            <View style={styles.list}>
              {items.map((request, index) => (
                <Reveal key={String(request.id ?? index)} index={index} variant="up">
                  <Card tone="white" style={styles.row}>
                    <View style={styles.rowBody}>
                      <Text preset="bodySm">{String(request.subject ?? 'Demande')}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>{request.createdAt ? formatDate(String(request.createdAt), locale) : '—'}</Text>
                    </View>
                    <Chip label={String(request.status ?? '—')} tone="neutral" size="sm" />
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
