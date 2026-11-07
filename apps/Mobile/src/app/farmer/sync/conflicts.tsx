import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { syncApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * Conflits de synchronisation (SYNC-04).
 *
 * Aucun conflit n'est résolu en silence par la plateforme : ils restent ouverts
 * jusqu'à arbitrage explicite, et le motif renvoyé par le serveur est affiché tel
 * quel plutôt que reformulé.
 */
export default function FarmerSyncConflicts() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.sync.conflicts({ onlyConflicts: 'true' }),
    queryFn: () => syncApi.conflicts({ onlyConflicts: 'true', limit: 100 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data?.conflicts ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title="Conflits" subtitle="Conflits de synchronisation à arbitrer." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Conflits" icon="git-merge-outline">
          {query.isLoading ? <LoadingState count={2} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucun conflit" description="Tous vos enregistrements sont synchronisés." icon="checkmark-circle-outline" /> : (
            <>
              <Card tone="pale">
                <Text preset="caption" color={COLORS.slateGray}>{query.data?.policy}</Text>
              </Card>
              <View style={styles.list}>
                {items.map((conflict, index) => (
                  <Reveal key={conflict.opId} index={index} variant="up">
                    <Card tone="white" style={styles.row}>
                      <View style={styles.rowBody}>
                        <Text preset="bodyMedium">{conflict.collection}</Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          {conflict.operation} · {conflict.appliedAt ? formatDate(conflict.appliedAt, locale) : 'date inconnue'}
                        </Text>
                      </View>
                      <Chip label={conflict.result} tone="warning" size="sm" />
                    </Card>
                  </Reveal>
                ))}
              </View>
            </>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 } });
