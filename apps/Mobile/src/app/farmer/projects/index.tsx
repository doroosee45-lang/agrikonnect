import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Button, EmptyState, ErrorState, LoadingState, PressableCard, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { projectApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function FarmerProjects() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.projects.list({ limit: 100 }),
    queryFn: () => projectApi.list({ limit: 100 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title={t('ui.mesProjets')} subtitle={t('ui.projetsDInvestissementRattachesAVotre')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.mesProjets')} icon="layers-outline">
          <Button label={t('ui.proposerUnProjet')} variant="primary" onPress={() => router.push('/farmer/projects/new')} />
          {query.isLoading ? <LoadingState count={3} height={100} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title={t('ui.aucunProjet')} description={t('ui.proposezUnProjetPourRechercherUn')} icon="layers-outline" /> : (
            <View style={styles.list}>
              {items.map((row, index) => {
                const project = row as Record<string, unknown>;
                const projectId = String(project.id ?? index);
                const createdAt = typeof project.createdAt === 'string' ? project.createdAt : null;
                return (
                  <Reveal key={projectId} index={index} variant="up">
                    <PressableCard onPress={() => router.push(`/farmer/projects/${projectId}`)}>
                      <Text preset="bodyMedium">{String(project.title ?? t('ui.projetSansTitre'))}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>{String(project.status ?? '—')} · {createdAt ? formatDate(createdAt, locale) : t('ui.dateInconnue')}</Text>
                    </PressableCard>
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
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm } });
