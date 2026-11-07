import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, PressableCard, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { exportApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function InternationalDocuments() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.exports.list({ limit: 100 }),
    queryFn: () => exportApi.list({ limit: 100 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data?.items ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Documents d'export" subtitle="Vos dossiers d'exportation." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Documents d'export" icon="document-text-outline">
          {query.isLoading ? <LoadingState count={3} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucun dossier" description="Vos dossiers d'exportation apparaîtront ici." icon="document-text-outline" /> : (
            <View style={styles.list}>
              {items.map((item, index) => (
                <Reveal key={item.id} index={index} variant="up">
                  <PressableCard onPress={() => router.push(`/farmer/export/${item.id}`)}>
                    <View style={styles.row}>
                      <View style={styles.rowBody}>
                        <Text preset="bodyMedium" style={{ fontFamily: 'monospace' }}>{item.reference}</Text>
                        <Text preset="caption" color={COLORS.slateGray}>{item.destinationCountry} · {formatDate(item.createdAt, locale)} · {item._count?.documents ?? 0} document(s)</Text>
                      </View>
                      <Chip label={item.status} tone="neutral" size="sm" />
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
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 } });
