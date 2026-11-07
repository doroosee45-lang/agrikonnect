import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, PressableCard, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { aiApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function AiAnalyses() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.ai.list({ limit: 100 }),
    queryFn: () => aiApi.list({ limit: 100 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Analyses IA" subtitle="Historique de vos analyses." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Analyses IA" icon="sparkles-outline">
          <Card tone="pale" style={styles.notice}>
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
              Les réponses sont générées par une IA. Elles ne remplacent pas un avis agronomique et doivent être confrontées au terrain.
            </Text>
          </Card>
          {query.isLoading ? <LoadingState count={3} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucune analyse" description="Vos analyses apparaîtront ici." icon="sparkles-outline" /> : (
            <View style={styles.list}>
              {items.map((analysis, index) => (
                <Reveal key={analysis.id} index={index} variant="up">
                  <PressableCard onPress={() => router.push(`/ai/analyses/${analysis.id}`)}>
                    <View style={styles.row}>
                      <View style={styles.rowBody}>
                        <Text preset="bodyMedium">{analysis.type}</Text>
                        <Text preset="caption" color={COLORS.slateGray}>{formatDate(analysis.createdAt, locale)}</Text>
                      </View>
                      <Chip label={analysis.status} tone={analysis.status === 'ESCALATED' ? 'warning' : 'neutral'} size="sm" />
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
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, notice: { marginBottom: SPACING.sm }, lineHeight: { lineHeight: 18 }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 } });
