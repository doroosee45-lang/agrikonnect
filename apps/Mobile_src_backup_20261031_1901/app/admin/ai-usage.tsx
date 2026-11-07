import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { adminApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function AdminAiUsage() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: [...queryKeys.admin.dashboard, 'ai-usage'] as unknown[],
    queryFn: () => adminApi.dashboard().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = (query.data as unknown as Array<Record<string, unknown>>) ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Usage IA" subtitle="Consommation et escalades IA." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Usage IA" icon="analytics-outline">
          {query.isLoading ? <LoadingState count={3} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucune donnée" description="Aucune donnée d'usage IA." icon="analytics-outline" /> : (
            <View style={styles.list}>
              {items.map((item, index) => (
                <Reveal key={String(item.id ?? index)} index={index} variant="up">
                  <Card tone="white" style={styles.row}>
                    <Text preset="bodySm">{String(item.type ?? '—')}</Text>
                    <Chip label={String(item.status ?? '—')} tone="neutral" size="sm" />
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
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } });
