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
      <FarmerHeader title="Mes projets" subtitle="Projets d'investissement rattachés à votre exploitation." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Mes projets" icon="layers-outline">
          <Button label="Proposer un projet" variant="primary" onPress={() => router.push('/farmer/projects/new')} />
          {query.isLoading ? <LoadingState count={3} height={100} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucun projet" description="Proposez un projet pour rechercher un financement." icon="layers-outline" /> : (
            <View style={styles.list}>
              {items.map((row, index) => {
                const project = row as Record<string, unknown>;
                const projectId = String(project.id ?? index);
                const createdAt = typeof project.createdAt === 'string' ? project.createdAt : null;
                return (
                  <Reveal key={projectId} index={index} variant="up">
                    <PressableCard onPress={() => router.push(`/farmer/projects/${projectId}`)}>
                      <Text preset="bodyMedium">{String(project.title ?? 'Projet sans titre')}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>{String(project.status ?? '—')} · {createdAt ? formatDate(createdAt, locale) : 'date inconnue'}</Text>
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
