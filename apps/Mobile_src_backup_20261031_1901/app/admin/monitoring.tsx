import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, EmptyState, ErrorState, LoadingState, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { adminApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function AdminMonitoring() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.admin.dashboard,
    queryFn: () => adminApi.dashboard().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const data = (query.data ?? {}) as Record<string, unknown>;
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Monitoring" subtitle="Santé du système et métriques." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Monitoring" icon="pulse-outline">
          {query.isLoading ? <LoadingState count={2} height={110} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : Object.keys(data).length === 0 ? <EmptyState title="Aucune métrique" description="Aucune métrique disponible." icon="pulse-outline" /> : (
            <Card tone="ink">
              <Text preset="overline" color={COLORS.gold} style={styles.mb}>Métriques système</Text>
              <View style={styles.grid}>
                {Object.entries(data).map(([key, value]) => (
                  <View key={key} style={styles.stat}>
                    <Text preset="caption" color="rgba(246, 247, 242, 0.7)">{key}</Text>
                    <Text preset="numeric" color={COLORS.pureWhite}>
                      {typeof value === 'number' ? formatNumber(value, locale) : typeof value === 'string' ? value : JSON.stringify(value)}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, mb: { marginBottom: SPACING.md }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.lg }, stat: { minWidth: 140, gap: 2 } });
