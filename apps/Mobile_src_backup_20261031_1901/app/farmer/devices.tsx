import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { iotApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function FarmerDevices() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.iot.devices,
    queryFn: () => iotApi.devices().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data?.items ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title="Capteurs" subtitle="Capteurs rattachés à vos parcelles." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Capteurs" icon="radio-outline">
          {query.isLoading ? <LoadingState count={3} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucun capteur" description="Aucun capteur rattaché à vos parcelles." icon="radio-outline" /> : (
            <View style={styles.list}>
              {items.map((device, index) => (
                <Reveal key={device.id} index={index} variant="up">
                  <Card tone="white" style={styles.row}>
                    <View style={styles.rowBody}>
                      <Text preset="bodyMedium">{device.label}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {device.lastSeenAt ? `Dernière communication ${formatDate(device.lastSeenAt, locale)}` : 'Jamais vu'}
                      </Text>
                    </View>
                    <View style={styles.rowAside}>
                      <Chip label={device.status} tone={device.status === 'ONLINE' ? 'success' : device.status === 'OFFLINE' ? 'error' : 'neutral'} size="sm" />
                      {device.silent ? <Chip label="muet" tone="warning" size="sm" /> : null}
                    </View>
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
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 }, rowAside: { alignItems: 'flex-end', gap: 4 } });
