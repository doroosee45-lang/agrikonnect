import { useState } from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button, Card, Chip, EmptyState, ErrorState, LoadingState, Text } from '@/components/ui';
import { alertApi, iotApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { DescribedAlert, IotDeviceList } from '@/services/types';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

import { PlotModule } from '@/components/pages';

const ALERT_TONE = { INFO: 'info', WARNING: 'warning', CRITICAL: 'error' } as const;
const ALERT_STATUS_TONE = { NEW: 'warning', READ: 'info', HANDLED: 'success' } as const;

/**
 * Alertes de seuil de la parcelle (`GET /alerts`).
 *
 * Trois sources possibles : `MEASUREMENT` (franchissement constaté),
 * `FORECAST` (franchissement anticipé) et `SENSOR_SILENCE` (capteur muet —
 * une **absence** de donnée, jamais une mauvaise mesure). Le canal SMS reste
 * primaire ; cet écran est le suivi, pas le déclencheur.
 */
function PlotAlertsPanel() {
  const { id } = useParams<{ id: string }>();
  const plotId = id ?? '';
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);

  const alerts = useQuery({
    queryKey: queryKeys.alerts.list({ plotId, limit: 20 }),
    queryFn: () => alertApi.list({ plotId, limit: 20 }).then((result) => result.data),
    enabled: Boolean(plotId),
    retry: false,
  });

  const mark = useMutation({
    mutationFn: ({ alertId, action }: { alertId: string; action: 'read' | 'handled' }) =>
      action === 'read' ? alertApi.markRead(alertId) : alertApi.markHandled(alertId),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all });
    },
    onError: (caught) => setError(caught),
  });

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        <Text preset="h3">Alertes de seuil</Text>
        {alerts.data ? (
          <Text preset="caption" color={COLORS.slateGray}>
            {alerts.data.openCount} ouverte(s) sur {alerts.data.total}
          </Text>
        ) : null}
      </div>

      {error ? <ErrorState error={error} /> : null}
      {alerts.isLoading ? <LoadingState count={1} /> : null}
      {alerts.isError ? <ErrorState error={alerts.error} /> : null}
      {alerts.data && alerts.data.items.length === 0 ? (
        <EmptyState
          title="Aucune alerte"
          description="Aucun seuil n'a été franchi sur cette parcelle. Un capteur muet déclenche également une alerte."
        />
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(alerts.data?.items ?? []).map((alert: DescribedAlert) => (
          <Card key={alert.id} tone="white">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
              <div>
                <Text preset="bodyMd" style={{ marginBottom: 4 }}>
                  {alert.parameterLabel}
                </Text>
                <Text preset="caption" color={COLORS.slateGray}>
                  seuil {alert.referenceLabel}
                  {alert.observedLabel ? ` · observé ${alert.observedLabel}` : ''}
                  {alert.deviation !== null ? ` · écart ${alert.deviation}` : ''} ·{' '}
                  {alert.observedAt ? formatDate(alert.observedAt, locale) : formatDate(alert.createdAt, locale)}
                </Text>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Chip label={alert.severityLabel} tone={ALERT_TONE[alert.severity]} size="sm" />
                <Chip label={alert.statusLabel} tone={ALERT_STATUS_TONE[alert.status]} size="sm" />
              </div>
            </div>

            <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 8 }}>
              {/*
                Le nom de la source vient de l'API (`describeAlert`) : ce panneau
                recopiait auparavant trois phrases françaises, et une source
                ajoutée côté serveur n'aurait été nommée nulle part.
              */}
              {alert.sourceTypeLabel}
              {alert.predictive && alert.predictedBreachAt
                ? ` — franchissement attendu vers le ${formatDate(alert.predictedBreachAt, locale)}`
                : ''}
              {alert.channelsSent.length > 0 ? ` · canaux : ${alert.channelsSent.join(', ')}` : ''}
              {alert.notificationCount > 1 ? ` · ${alert.notificationCount} notifications` : ''}
            </Text>

            {alert.status !== 'HANDLED' ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {alert.status === 'NEW' ? (
                  <Button
                    label="Marquer lue"
                    size="sm"
                    variant="outline"
                    loading={mark.isPending}
                    onClick={() => mark.mutate({ alertId: alert.id, action: 'read' })}
                  />
                ) : null}
                <Button
                  label="Traiter"
                  size="sm"
                  variant="primary"
                  loading={mark.isPending}
                  onClick={() => mark.mutate({ alertId: alert.id, action: 'handled' })}
                />
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}

/** FARMER — capteurs rattachés à la parcelle (IOT-01 → IOT-06) et alertes de seuil. */
export default function FarmerPlotSensors() {
  const { locale } = useI18n();

  return (
    <PlotModule<IotDeviceList>
      title="Capteurs"
      subtitle="Capteurs rattachés à cette parcelle. Un capteur hors ligne affiche ses dernières lectures avec la date, sans extrapolation."
      icon="📡"
      queryKey={() => queryKeys.iot.devices}
      fetch={() => iotApi.devices().then((result) => result.data)}
      emptyTitle="Aucun capteur"
      emptyDescription="Aucun capteur n'est rattaché à cette parcelle."
      isEmpty={(data) => data.items.length === 0}
      render={(data) => (
        <>
        <PlotAlertsPanel />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {data.items.map((device, index) => (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 8) * 0.04, ease: EASE.out }}
            >
              <Card tone="white" hover>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <div>
                    <Text preset="h4" style={{ marginBottom: 4 }}>
                      {device.label}
                    </Text>
                    <Text preset="caption">{device.plotId ?? '—'}</Text>
                  </div>
                  <Chip label={device.status} tone={device.status === 'ONLINE' ? 'success' : device.status === 'OFFLINE' ? 'error' : 'neutral'} size="sm" />
                </div>
                {device.lastSeenAt ? (
                  <Text preset="caption" style={{ marginTop: 8 }}>
                    Dernière communication : {formatDate(device.lastSeenAt, locale)}
                  </Text>
                ) : (
                  <Text preset="caption" style={{ marginTop: 8 }}>
                    Aucune communication enregistrée.
                  </Text>
                )}
                {device.silent ? (
                  <div style={{ marginTop: 8 }}>
                    <Chip label="muet depuis +24h" tone="warning" size="sm" />
                  </div>
                ) : null}
              </Card>
            </motion.div>
          ))}
        </div>
        </>
      )}
    />
  );
}