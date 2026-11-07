import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { dashboardApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * Enquêtes à compléter.
 *
 * Le backend n'expose pas de module d'enquêtes dédié : les questionnaires en
 * attente sont remontés par le tableau de bord producteur (`GET /dashboard`),
 * qui est la seule source réelle disponible.
 */
export default function FarmerSurveys() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: [...queryKeys.dashboard.farmer, 'surveys'] as unknown[],
    queryFn: () => dashboardApi.farmer().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const dashboard = query.data ?? {};
  const raw = (dashboard.pendingSurveys ?? dashboard.surveys ?? []) as unknown;
  const items = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title="Enquêtes" subtitle="Questionnaires à compléter." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Enquêtes" icon="clipboard-outline">
          {query.isLoading ? <LoadingState count={2} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucune enquête" description="Aucun questionnaire en attente." icon="clipboard-outline" /> : (
            <View style={styles.list}>
              {items.map((survey, index) => (
                <Reveal key={String(survey.id ?? index)} index={index} variant="up">
                  <Card tone="white" style={styles.row}>
                    <View style={styles.rowBody}>
                      <Text preset="bodySm">{String(survey.title ?? 'Enquête')}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>{String(survey.description ?? 'Questionnaire à compléter')}</Text>
                    </View>
                    <Chip label={String(survey.status ?? 'en attente')} tone="neutral" size="sm" />
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
