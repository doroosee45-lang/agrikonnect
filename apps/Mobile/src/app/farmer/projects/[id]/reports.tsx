import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Card, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { projectDataApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function FarmerProjectReports() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: [...queryKeys.projects.one(id ?? ''), 'reports'] as unknown[],
    queryFn: () => projectDataApi.reports(id ?? '').then((r) => r.data),
    enabled: isAuthenticated && Boolean(id),
    retry: false,
  });
  const progress = query.data?.progress ?? [];
  const impact = query.data?.impact ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title="Rapports" subtitle="Rapports d'avancement et d'impact." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Rapports" icon="bar-chart-outline">
          {query.isLoading ? <LoadingState count={3} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : progress.length === 0 && impact.length === 0 ? <EmptyState title="Aucun rapport" description="Les rapports d'avancement et d'impact apparaîtront ici." icon="bar-chart-outline" /> : (
            <>
              <Text preset="h3">Avancement</Text>
              {progress.length === 0 ? <Text preset="caption" color={COLORS.slateGray}>Aucun rapport d'avancement.</Text> : (
                <View style={styles.list}>
                  {progress.map((report, index) => (
                    <Reveal key={report.id} index={index} variant="up">
                      <Card tone="white">
                        <Text preset="bodyMedium">Période {report.period}</Text>
                        <Text preset="caption" color={COLORS.slateGray}>{formatDate(report.publishedAt, locale)} · {report.photos.length} photo(s)</Text>
                      </Card>
                    </Reveal>
                  ))}
                </View>
              )}
              <Text preset="h3" style={styles.mt}>Impact</Text>
              {impact.length === 0 ? <Text preset="caption" color={COLORS.slateGray}>Aucun rapport d'impact.</Text> : (
                <View style={styles.list}>
                  {impact.map((report, index) => (
                    <Reveal key={report.id} index={index} variant="up">
                      <Card tone="white">
                        <Text preset="bodyMedium">Période {report.period}</Text>
                        <Text preset="caption" color={COLORS.slateGray}>{formatDate(report.publishedAt, locale)}</Text>
                      </Card>
                    </Reveal>
                  ))}
                </View>
              )}
            </>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, mt: { marginTop: SPACING.md } });
