import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Button, Card, Chip, ErrorState, LoadingState, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { syncApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * État de la synchronisation hors ligne (SYNC-01 → SYNC-04).
 *
 * Le backend ne renvoie pas de « statut » synthétique : on lit le contrat réel
 * (`/sync/collections`) et le dernier tirage (`/sync/pull`), dont le curseur
 * donne la date du dernier point de synchronisation connu.
 */
export default function FarmerSync() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const collections = useQuery({
    queryKey: queryKeys.sync.collections,
    queryFn: () => syncApi.collections().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const pull = useQuery({
    queryKey: queryKeys.sync.pull({ days: 7 }),
    queryFn: () => syncApi.pull({ days: 7, limit: 100 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const loading = collections.isLoading || pull.isLoading;
  const error = collections.error ?? pull.error;
  const items = collections.data?.collections ?? [];
  const changed = Object.values(pull.data?.counts ?? {}).reduce((sum, n) => sum + n, 0);

  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title="Synchronisation" subtitle="État de la synchronisation hors ligne." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Synchronisation" icon="sync-outline">
          {loading ? <LoadingState count={2} height={120} /> : error ? <ErrorState error={error} onRetry={() => { void collections.refetch(); void pull.refetch(); }} /> : (
            <>
              <Card tone="white" style={styles.card}>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Collections synchronisables</Text>
                  <Text preset="bodyMedium">{items.length}</Text>
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Changements sur 7 jours</Text>
                  <Text preset="bodyMedium">{changed}</Text>
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Curseur</Text>
                  <Text preset="bodySm">{pull.data?.cursor ? formatDate(pull.data.cursor, locale) : '—'}</Text>
                </View>
                {pull.data?.hasMore ? <Chip label="d'autres changements disponibles" tone="warning" size="sm" /> : null}
              </Card>
              <Card tone="pale">
                <Text preset="caption" color={COLORS.slateGray}>{collections.data?.policy ?? pull.data?.policy.conflictResolution}</Text>
              </Card>
              <Button label="Rafraîchir" variant="primary" onPress={() => { void collections.refetch(); void pull.refetch(); }} />
              <Button label="Voir les conflits" variant="outline" onPress={() => router.push('/farmer/sync/conflicts')} />
            </>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, card: { gap: SPACING.sm }, field: { gap: 4 } });
