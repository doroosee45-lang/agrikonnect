import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { lotApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function AdminLots() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.lots.list({ limit: 100 }),
    queryFn: () => lotApi.list({ limit: 100 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Lots" subtitle="Lots de traçabilité." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Lots" icon="pricetag-outline">
          {query.isLoading ? <LoadingState count={3} height={80} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucun lot" description="Aucun lot enregistré." icon="pricetag-outline" /> : (
            <View style={styles.list}>
              {items.map((row, index) => {
                const lot = row as Record<string, unknown>;
                return (
                  <Reveal key={String(lot.id ?? index)} index={index} variant="up">
                    <Card tone="white" style={styles.row}>
                      <Text preset="bodyMedium" style={{ fontFamily: 'monospace' }}>{String(lot.code ?? '—')}</Text>
                      <Chip label={String(lot.status ?? '—')} tone="neutral" size="sm" />
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
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } });
