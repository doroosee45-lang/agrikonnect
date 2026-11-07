import { StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { anomalyApi, iotApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * ADMIN — anomalies de mesure et revue par agronome.
 *
 * Une anomalie NEW ou CONFIRMED écarte sa mesure du calcul des recommandations ;
 * DISMISSED la réhabilite immédiatement. Les seuils sont **provisoires** : à
 * recaler sur les données réelles du pilote.
 */
function AnomalyReviewPanel() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);

  const anomalies = useQuery({
    queryKey: queryKeys.anomalies.list({ limit: 30 }),
    queryFn: () => anomalyApi.list({ limit: 30 }).then((result) => result.data),
    retry: false,
  });
  const settings = useQuery({
    queryKey: queryKeys.anomalies.settings,
    queryFn: () => anomalyApi.settings().then((result) => result.data),
  });

  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'CONFIRMED' | 'DISMISSED' }) =>
      anomalyApi.review(id, { decision }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.anomalies.all });
    },
    onError: (caught) => setError(caught),
  });

  return (
    <Card tone="white" style={styles.card}>
      <Text preset="overline" color={COLORS.forestGreen}>
        Anomalies de mesure
      </Text>
      <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
        Une lecture écartée ne participe plus au calcul des recommandations. Rejeter une anomalie réhabilite sa
        mesure immédiatement.
      </Text>

      {settings.data && settings.data.enabled === false ? (
        <Text preset="caption" color={COLORS.warning} style={styles.lineHeight}>
          La détection d’anomalies est désactivée : aucune nouvelle anomalie ne sera produite.
        </Text>
      ) : null}

      {settings.data ? (
        <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
          Seuils provisoires, à recaler sur les données réelles du pilote :{' '}
          {settings.data.thresholds
            .map((threshold) => `${threshold.path} ${threshold.value ?? 'non défini'}${threshold.unit ?? ''}`)
            .join(' · ')}
        </Text>
      ) : null}

      {error ? <ErrorState error={error} showRequestId /> : null}
      {anomalies.isLoading ? <LoadingState count={2} height={72} /> : null}
      {anomalies.isError ? (
        <ErrorState error={anomalies.error} onRetry={() => void anomalies.refetch()} />
      ) : null}
      {anomalies.data && anomalies.data.length === 0 ? (
        <EmptyState
          title="Aucune anomalie"
          description="Aucune lecture suspecte détectée. Les seuils actuels sont provisoires."
          icon="shield-checkmark-outline"
        />
      ) : null}

      {(anomalies.data ?? []).map((anomaly) => (
        <Reveal key={anomaly.id}>
          <View style={styles.anomalyRow}>
            <View style={{ flex: 1 }}>
              <Text preset="bodySm" color={COLORS.textPrimary}>
                {anomaly.reason}
              </Text>
              <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                appareil {anomaly.deviceId} · {formatDate(anomaly.detectedAt, locale)}
              </Text>
            </View>
            <View style={styles.anomalyChips}>
              <Chip
                label={anomaly.severity}
                tone={anomaly.severity === 'CRITICAL' ? 'error' : 'warning'}
                size="sm"
              />
              <Chip
                label={anomaly.status}
                tone={
                  anomaly.status === 'CONFIRMED'
                    ? 'error'
                    : anomaly.status === 'DISMISSED'
                      ? 'success'
                      : 'warning'
                }
                size="sm"
              />
              {/* Une donnée simulée n'est jamais présentée comme une mesure physique. */}
              {anomaly.mode !== 'REAL' ? <Chip label={anomaly.mode} tone="neutral" size="sm" /> : null}
            </View>
          </View>

          {anomaly.status === 'NEW' ? (
            <View style={styles.anomalyActions}>
              <Button
                label="Confirmer"
                variant="primary"
                size="sm"
                loading={review.isPending}
                onPress={() => review.mutate({ id: anomaly.id, decision: 'CONFIRMED' })}
              />
              <Button
                label="Rejeter"
                variant="outline"
                size="sm"
                loading={review.isPending}
                onPress={() => review.mutate({ id: anomaly.id, decision: 'DISMISSED' })}
              />
            </View>
          ) : (
            <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
              {anomaly.status === 'CONFIRMED'
                ? 'Mesure écartée du calcul. Une anomalie revue n’est jamais rouverte.'
                : 'Anomalie rejetée : la mesure a réintégré le calcul.'}
            </Text>
          )}
        </Reveal>
      ))}
    </Card>
  );
}

export default function AdminDevices() {
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
      <AppHeader title="Capteurs" subtitle="Parc de capteurs IoT." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Capteurs" icon="radio-outline">
          <AnomalyReviewPanel />

          {query.isLoading ? <LoadingState count={3} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucun capteur" description="Aucun capteur enregistré." icon="radio-outline" /> : (
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
const styles = StyleSheet.create({
  card: { gap: SPACING.sm },
  lineHeight: { lineHeight: 18 },
  anomalyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.lightBorder,
  },
  anomalyChips: { gap: 4, alignItems: 'flex-end' },
  anomalyActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 }, rowAside: { alignItems: 'flex-end', gap: 4 } });
