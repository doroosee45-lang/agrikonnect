import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { AuthGate, Card, Chip, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { projectApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function PublicSiteProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.projects.one(id ?? ''),
    queryFn: () => projectApi.get(id ?? '').then((r) => r.data),
    enabled: isAuthenticated && Boolean(id),
    retry: false,
  });
  const project = query.data as Record<string, unknown> | undefined;
  const createdAt = typeof project?.createdAt === 'string' ? project.createdAt : null;
  return (
    <PublicShell active="projets">
      <PageHeader index="15" eyebrow="Projet" title={String(project?.title ?? 'Fiche projet')} subtitle="Les pièces détaillées sont partagées via la data room, sur accès accordé." />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Projet" icon="layers-outline">
          {query.isLoading ? <LoadingState count={1} height={150} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !project ? <Text preset="body">Projet introuvable.</Text> : (
            <Card tone="white" style={styles.card}>
              <Text preset="h2">{String(project.title ?? '—')}</Text>
              {typeof project.summary === 'string' ? <Text preset="bodySm">{project.summary}</Text> : null}
              <View style={styles.field}>
                <Text preset="caption" color={COLORS.slateGray}>Statut</Text>
                <Chip label={String(project.status ?? '—')} tone="neutral" size="sm" />
              </View>
              <View style={styles.field}>
                <Text preset="caption" color={COLORS.slateGray}>Pays</Text>
                <Text preset="bodySm">{String(project.countryCode ?? '—')}</Text>
              </View>
              <View style={styles.field}>
                <Text preset="caption" color={COLORS.slateGray}>Publié le</Text>
                <Text preset="bodySm">{createdAt ? formatDate(createdAt, locale) : '—'}</Text>
              </View>
            </Card>
          )}
        </AuthGate>
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, card: { gap: SPACING.sm }, field: { gap: 4 } });
