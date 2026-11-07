import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthGate, Button, Card, Chip, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { anomalyApi, iotApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

const ANOMALY_TONE = { NEW: 'warning', CONFIRMED: 'error', DISMISSED: 'success' } as const;

/**
 * ADMIN — anomalies de mesure et revue par agronome.
 *
 * Une anomalie `NEW` ou `CONFIRMED` écarte sa mesure du calcul des
 * recommandations ; `DISMISSED` la réhabilite immédiatement. Les seuils de
 * détection sont **provisoires** : ils sont à recaler sur les données réelles
 * du pilote, et l'écran le dit.
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
    <div style={{ marginBottom: 32 }}>
      <Text preset="h2" style={{ marginBottom: 8 }}>
        Anomalies de mesure
      </Text>
      <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 16 }}>
        Une lecture écartée ne participe plus au calcul des recommandations. Rejeter une anomalie réhabilite sa
        mesure immédiatement.
      </Text>

      {settings.data && settings.data.enabled === false ? (
        <Card tone="gold" style={{ marginBottom: 16 }}>
          <Text preset="caption">
            La détection d’anomalies est désactivée : aucune nouvelle anomalie ne sera produite.
          </Text>
        </Card>
      ) : null}

      {settings.data ? (
        <Card tone="pale" style={{ marginBottom: 16 }}>
          <Text preset="caption" style={{ marginBottom: 8 }}>
            Seuils de détection — <strong>provisoires</strong>, à recaler sur les données réelles du pilote :
          </Text>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {settings.data.thresholds.map((threshold) => (
              <Chip
                key={threshold.path}
                label={`${threshold.path} : ${threshold.value ?? 'non défini'}${threshold.unit ? ` ${threshold.unit}` : ''}`}
                tone="neutral"
                size="sm"
              />
            ))}
          </div>
        </Card>
      ) : null}

      {error ? <ErrorState error={error} /> : null}
      {anomalies.isLoading ? <LoadingState count={2} height={72} /> : null}
      {anomalies.isError ? <ErrorState error={anomalies.error} showRequestId /> : null}
      {anomalies.data && anomalies.data.length === 0 ? (
        <EmptyState
          title="Aucune anomalie"
          description="Aucune lecture suspecte n'a été détectée. Les seuils actuels sont provisoires."
          icon="📡"
        />
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(anomalies.data ?? []).map((anomaly) => (
          <Card key={anomaly.id} tone="white">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
              <div>
                <Text preset="bodyMd" style={{ marginBottom: 4 }}>
                  {anomaly.reason}
                </Text>
                <Text preset="caption" color={COLORS.slateGray}>
                  appareil {anomaly.deviceId} · détectée le {formatDate(anomaly.detectedAt, locale)}
                  {anomaly.readingId ? ` · lecture ${anomaly.readingId}` : ''}
                </Text>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Chip label={anomaly.severity} tone={anomaly.severity === 'CRITICAL' ? 'error' : 'warning'} size="sm" />
                <Chip label={anomaly.status} tone={ANOMALY_TONE[anomaly.status]} size="sm" />
                {/* Une donnée simulée n'est jamais présentée comme une mesure physique. */}
                {anomaly.mode !== 'REAL' ? <Chip label={anomaly.mode} tone="neutral" size="sm" /> : null}
              </div>
            </div>

            {anomaly.status === 'NEW' ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button
                  label="Confirmer (écarter la mesure)"
                  size="sm"
                  variant="primary"
                  loading={review.isPending}
                  onClick={() => review.mutate({ id: anomaly.id, decision: 'CONFIRMED' })}
                />
                <Button
                  label="Rejeter (réhabiliter)"
                  size="sm"
                  variant="outline"
                  loading={review.isPending}
                  onClick={() => review.mutate({ id: anomaly.id, decision: 'DISMISSED' })}
                />
              </div>
            ) : (
              <Text preset="caption" color={COLORS.slateGray}>
                {anomaly.status === 'CONFIRMED'
                  ? 'Mesure écartée du calcul. Une anomalie revue n’est jamais rouverte.'
                  : 'Anomalie rejetée : la mesure a réintégré le calcul.'}
                {anomaly.reviewedAt ? ` · revue le ${formatDate(anomaly.reviewedAt, locale)}` : ''}
              </Text>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

/** ADMIN — appareils IoT enregistrés, avec l'état « muet » calculé côté serveur. */
export default function AdminDevices() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const devices = useQuery({
    queryKey: queryKeys.iot.devices,
    queryFn: () => iotApi.devices().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const items = devices.data?.items ?? [];

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Appareils IoT" description="Capteurs enregistrés." icon="📡">
        <Text preset="h1" style={{ marginBottom: 8 }}>
          Appareils IoT
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 24 }}>
          L'état « muet » est calculé côté serveur à partir du dernier relevé reçu.
        </Text>

        <AnomalyReviewPanel />

        <Text preset="h2" style={{ marginBottom: 16 }}>
          Appareils enregistrés
        </Text>

        {devices.isLoading ? (
          <LoadingState count={3} height={80} />
        ) : devices.isError ? (
          <ErrorState error={devices.error} onRetry={() => void devices.refetch()} showRequestId />
        ) : items.length === 0 ? (
          <EmptyState title="Aucun appareil" description="Aucun capteur n'est enregistré." icon="📡" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((device, index) => (
              <motion.div
                key={device.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 8) * 0.03, ease: EASE.out }}
              >
                <Card tone="white" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <Text preset="bodyMd" color={COLORS.textPrimary} style={{ fontWeight: 600 }}>
                      {device.label}
                    </Text>
                    <Text preset="caption" color={COLORS.slateGray}>
                      {device.lastSeenAt ? `dernier relevé ${formatDate(device.lastSeenAt, locale)}` : 'aucun relevé'}
                      {device.keyRotatedAt ? ` · clé rotée le ${formatDate(device.keyRotatedAt, locale)}` : ''}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Chip label={device.status} tone={device.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm" />
                    {device.silent ? <Chip label="muet" tone="warning" size="sm" /> : null}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </AuthGate>
    </Section>
  );
}
