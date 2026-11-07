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

export default function FarmerProjectAccessLog() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: [...queryKeys.projects.one(id ?? ''), 'access-log'] as unknown[],
    queryFn: () => projectDataApi.accessLog(id ?? '').then((r) => r.data),
    enabled: isAuthenticated && Boolean(id),
    retry: false,
  });
  const items = query.data ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title="Journal d'accès" subtitle="Qui a consulté votre data room." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Journal d'accès" icon="eye-outline">
          {query.isLoading ? <LoadingState count={3} height={80} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucun accès" description="Les consultations apparaîtront ici." icon="eye-outline" /> : (
            <View style={styles.list}>
              {items.map((entry, index) => (
                <Reveal key={String(entry.id ?? index)} index={index} variant="up">
                  <Card tone="white">
                    <Text preset="bodySm">{String(entry.actorLabel ?? entry.actorId ?? '—')}</Text>
                    <Text preset="caption" color={COLORS.slateGray}>{entry.at ? formatDate(String(entry.at), locale) : '—'} · {String(entry.action ?? 'consultation')}</Text>
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
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm } });
