import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { AuthGate, Button, Chip, EmptyState, ErrorState, LoadingState, PressableCard, Reveal, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { projectApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function PublicSiteProjets() {
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
    <PublicShell active="projets">
      <PageHeader index="15" eyebrow="Investissement" title="Projets" subtitle="Projets publiés par des producteurs en recherche de financement." />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Projets" icon="layers-outline" description="Les projets d\u2019investissement sont réservés aux comptes connectés.">
          <Button label="Proposer un projet" variant="primary" onPress={() => router.push('/public-site/projets/proposer')} />
          {query.isLoading ? <LoadingState count={3} height={100} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucun projet" description="Aucun projet publié pour le moment." icon="layers-outline" /> : (
            <View style={styles.list}>
              {items.map((row, index) => {
                const project = row as Record<string, unknown>;
                const projectId = String(project.id ?? index);
                const createdAt = typeof project.createdAt === 'string' ? project.createdAt : null;
                return (
                  <Reveal key={projectId} index={index} variant="up">
                    <PressableCard onPress={() => router.push(`/public-site/projets/${projectId}` as never)}>
                      <View style={styles.row}>
                        <View style={styles.rowBody}>
                          <Text preset="bodyMedium">{String(project.title ?? 'Projet sans titre')}</Text>
                          <Text preset="caption" color={COLORS.slateGray}>
                            {String(project.countryCode ?? '—')}{createdAt ? ` · ${formatDate(createdAt, locale)}` : ''}
                          </Text>
                        </View>
                        <Chip label={String(project.status ?? '—')} tone="neutral" size="sm" />
                      </View>
                    </PressableCard>
                  </Reveal>
                );
              })}
            </View>
          )}
        </AuthGate>
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 } });
