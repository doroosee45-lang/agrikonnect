import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Button, Card, Chip, ErrorState, LoadingState, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { projectApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function FarmerProjectDetail() {
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
  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title={String(project?.title ?? '—')} subtitle="Pilotage du projet." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Projet" icon="layers-outline">
          {query.isLoading ? <LoadingState count={1} height={140} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !project ? <Text preset="body">Projet introuvable.</Text> : (
            <>
              <Card tone="white" style={styles.card}>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Statut</Text>
                  <Chip label={String(project.status ?? '—')} tone="neutral" size="sm" />
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Créé le</Text>
                  <Text preset="bodySm">{project.createdAt ? formatDate(String(project.createdAt), locale) : '—'}</Text>
                </View>
              </Card>
              <Button label="Data room" variant="outline" onPress={() => router.push(`/farmer/projects/${id}/dataroom`)} />
              <Button label="Rapports" variant="outline" onPress={() => router.push(`/farmer/projects/${id}/reports`)} />
              <Button label="Journal d'accès" variant="ghost" onPress={() => router.push(`/farmer/projects/${id}/access-log`)} />
            </>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, card: { gap: SPACING.sm }, field: { gap: 4 } });
