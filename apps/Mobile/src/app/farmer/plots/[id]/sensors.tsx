import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { PlotScreenHeader } from '@/components/farmer/PlotScreenHeader';
import {
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  ErrorState,
  FilterChip,
  Input,
  LoadingState,
  ProvenanceTag,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate, formatNumber, formatRelative } from '@/lib/format';
import { DURATION } from '@/theme/motion';
import { alertApi, iotApi, plotApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

const WINDOWS = [
  { hours: 24, label: '24 h' },
  { hours: 72, label: '3 jours' },
  { hours: 168, label: '7 jours' },
] as const;

/**
 * Capteurs de la parcelle (IOT-01 → IOT-04).
 *
 * La clé d'appareil n'est affichée qu'à la création ou à la rotation : elle
 * n'est jamais récupérable ensuite. Les relevés sont montrés tels qu'ingérés,
 * avec les trous de mesure signalés plutôt qu'interpolés.
 */
export default function PlotSensors() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const [registering, setRegistering] = useState(false);
  const [label, setLabel] = useState('');
  const [serial, setSerial] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [secret, setSecret] = useState<{ deviceId: string; deviceKey: string; warning?: string } | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [hours, setHours] = useState<number>(24);
  const [revokeReason, setRevokeReason] = useState('');

  const plot = useQuery({
    queryKey: queryKeys.plots.one(id),
    queryFn: () => plotApi.get(id).then((result) => result.data),
    enabled: Boolean(id),
  });
  const devices = useQuery({
    queryKey: queryKeys.iot.devices,
    queryFn: () => iotApi.devices().then((result) => result.data),
  });

  const deviceId = selectedDevice ?? devices.data?.items.find((device) => device.plotId === id)?.id ?? null;

  const readings = useQuery({
    queryKey: queryKeys.iot.readings(deviceId ?? 'none', { hours }),
    queryFn: () => iotApi.readings(deviceId as string, { hours, limit: 500 }).then((result) => result.data),
    enabled: Boolean(deviceId),
  });

  const register = useMutation({
    mutationFn: () =>
      iotApi.registerDevice({
        label: label.trim(),
        plotId: id,
        serialNumber: serial.trim() || undefined,
      }),
    onSuccess: (result) => {
      setRegistering(false);
      setError(null);
      setSecret({ deviceId: result.data.device.id, deviceKey: result.data.deviceKey });
      setSelectedDevice(result.data.device.id);
      setLabel('');
      setSerial('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.iot.devices });
    },
    onError: (caught) => setError(caught),
  });

  // ── Alertes de seuil ──────────────────────────────────────────────────────
  //
  // Trois sources : MEASUREMENT (franchissement constaté), FORECAST (anticipé)
  // et SENSOR_SILENCE (capteur muet — une **absence** de donnée, jamais une
  // mauvaise mesure). Le canal SMS reste primaire ; cet écran est le suivi.
  const plotAlerts = useQuery({
    queryKey: queryKeys.alerts.list({ plotId: id, limit: 20 }),
    queryFn: () => alertApi.list({ plotId: id, limit: 20 }).then((result) => result.data),
    enabled: Boolean(id),
    retry: false,
  });

  const markAlert = useMutation({
    mutationFn: ({ alertId, action }: { alertId: string; action: 'read' | 'handled' }) =>
      action === 'read' ? alertApi.markRead(alertId) : alertApi.markHandled(alertId),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all });
    },
    onError: (caught) => setError(caught),
  });

  const rotate = useMutation({
    mutationFn: (target: string) => iotApi.rotateKey(target),
    onSuccess: (result) => {
      setSecret({ deviceId: result.data.deviceId, deviceKey: result.data.deviceKey, warning: result.data.warning });
      void queryClient.invalidateQueries({ queryKey: queryKeys.iot.devices });
    },
    onError: (caught) => setError(caught),
  });

  const revoke = useMutation({
    mutationFn: ({ target, reason }: { target: string; reason: string }) => iotApi.revoke(target, reason),
    onSuccess: () => {
      setRevokeReason('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.iot.devices });
    },
    onError: (caught) => setError(caught),
  });

  const plotDevices = (devices.data?.items ?? []).filter((device) => device.plotId === id);
  const otherDevices = (devices.data?.items ?? []).filter((device) => device.plotId !== id);
  const rows = readings.data?.readings ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <PlotScreenHeader title="Capteurs" plotName={plot.data?.name} plotId={id} />

      <Section bare contentStyle={styles.section}>
        <Card tone="white" style={styles.card}>
          <View style={styles.alertHead}>
            <Text preset="overline" color={COLORS.forestGreen}>
              Alertes de seuil
            </Text>
            {plotAlerts.data ? (
              <Text preset="caption" color={COLORS.slateGray}>
                {plotAlerts.data.openCount} ouverte(s) / {plotAlerts.data.total}
              </Text>
            ) : null}
          </View>

          {plotAlerts.isLoading ? <LoadingState count={1} height={72} /> : null}
          {plotAlerts.isError ? (
            <ErrorState error={plotAlerts.error} onRetry={() => void plotAlerts.refetch()} />
          ) : null}
          {plotAlerts.data && plotAlerts.data.items.length === 0 ? (
            <EmptyState
              title="Aucune alerte"
              description="Aucun seuil franchi sur cette parcelle. Un capteur muet déclenche aussi une alerte."
              icon="notifications-off-outline"
            />
          ) : null}

          {(plotAlerts.data?.items ?? []).map((alert) => (
            <Reveal key={alert.id}>
              <View style={styles.alertRow}>
                <View style={{ flex: 1 }}>
                  <Text preset="bodySm" color={COLORS.textPrimary}>
                    {alert.parameterLabel}
                  </Text>
                  <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                    seuil {alert.referenceLabel}
                    {alert.observedLabel ? ` · observé ${alert.observedLabel}` : ''} ·{' '}
                    {alert.observedAt ? formatDate(alert.observedAt, locale) : formatDate(alert.createdAt, locale)}
                  </Text>
                  <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                    {/*
                      Le nom de la source vient de l'API (`describeAlert`) : cet
                      écran recopiait auparavant trois phrases françaises, et une
                      source ajoutée côté serveur n'aurait été nommée nulle part.
                    */}
                    {alert.sourceTypeLabel}
                    {alert.predictive && alert.predictedBreachAt
                      ? ` — franchissement attendu vers le ${formatDate(alert.predictedBreachAt, locale)}`
                      : ''}
                    {alert.channelsSent.length > 0 ? ` · canaux : ${alert.channelsSent.join(', ')}` : ''}
                  </Text>
                </View>
                <View style={styles.alertChips}>
                  <Chip
                    label={alert.severityLabel}
                    tone={alert.severity === 'CRITICAL' ? 'error' : alert.severity === 'WARNING' ? 'warning' : 'info'}
                    size="sm"
                  />
                  <Chip
                    label={alert.statusLabel}
                    tone={alert.status === 'HANDLED' ? 'success' : alert.status === 'READ' ? 'info' : 'warning'}
                    size="sm"
                  />
                </View>
              </View>

              {alert.status !== 'HANDLED' ? (
                <View style={styles.alertActions}>
                  {alert.status === 'NEW' ? (
                    <Button
                      label="Marquer lue"
                      variant="outline"
                      size="sm"
                      loading={markAlert.isPending}
                      onPress={() => markAlert.mutate({ alertId: alert.id, action: 'read' })}
                    />
                  ) : null}
                  <Button
                    label="Traiter"
                    variant="primary"
                    size="sm"
                    loading={markAlert.isPending}
                    onPress={() => markAlert.mutate({ alertId: alert.id, action: 'handled' })}
                  />
                </View>
              ) : null}
            </Reveal>
          ))}
        </Card>

        <Card tone="pale" style={styles.disclaimer}>
          <Ionicons name="key-outline" size={16} color={COLORS.info} />
          <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
            La clé d’appareil est affichée une seule fois, à la création ou à la rotation. Elle n’est pas
            stockée en clair côté serveur et ne peut pas être récupérée ensuite.
          </Text>
        </Card>

        {secret ? (
          <Card tone="gold" style={styles.secret}>
            <Text preset="overline" color={COLORS.forestGreen}>
              Clé d’appareil — à copier maintenant
            </Text>
            <Text preset="bodySm" color={COLORS.textPrimary} selectable style={styles.key}>
              {secret.deviceKey}
            </Text>
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
              {secret.warning ?? 'Cette clé ne sera plus affichée. L’ancienne clé est invalidée immédiatement.'}
            </Text>
            <Button label="Masquer" onPress={() => setSecret(null)} variant="outline" size="sm" icon="eye-off-outline" />
          </Card>
        ) : null}

        <View style={styles.toolbar}>
          <Button
            label={registering ? 'Fermer' : 'Enregistrer un appareil'}
            onPress={() => setRegistering((value) => !value)}
            variant={registering ? 'ghost' : 'primary'}
            size="sm"
            icon={registering ? 'close' : 'hardware-chip-outline'}
          />
        </View>

        {registering ? (
          <Animated.View entering={FadeInDown.duration(DURATION.slow)} exiting={FadeOutUp.duration(DURATION.fast)}>
            <Card tone="white" style={styles.form}>
              <Input label="Nom de l’appareil" value={label} onChangeText={setLabel} placeholder="Sonde humidité nord" icon="hardware-chip-outline" autoCapitalize="words" />
              <Input label="Numéro de série" value={serial} onChangeText={setSerial} placeholder="SN-0042" icon="pricetag-outline" optionalLabel="facultatif" autoCapitalize="characters" />
              {error ? <ErrorState error={error} showRequestId /> : null}
              <Button
                label="Enregistrer"
                onPress={() => register.mutate()}
                variant="primary"
                fullWidth
                loading={register.isPending}
                disabled={label.trim().length < 2}
              />
            </Card>
          </Animated.View>
        ) : null}

        {devices.isLoading ? (
          <LoadingState count={2} height={90} />
        ) : devices.isError ? (
          <ErrorState error={devices.error} onRetry={() => void devices.refetch()} />
        ) : plotDevices.length === 0 ? (
          <EmptyState
            title="Aucun capteur sur cette parcelle"
            description="Un capteur rattaché alimente le diagnostic de sol et les zones de gestion."
            icon="hardware-chip-outline"
            action={{ label: 'Enregistrer un appareil', onPress: () => setRegistering(true) }}
          />
        ) : (
          <View style={styles.list}>
            {plotDevices.map((device, index) => (
              <Reveal key={device.id} index={index} variant="up">
                <Card tone={deviceId === device.id ? 'pale' : 'white'} style={styles.card}>
                  <View style={styles.head}>
                    <View style={styles.headIcon}>
                      <Ionicons name="hardware-chip-outline" size={16} color={COLORS.forestGreen} />
                    </View>
                    <View style={styles.headText}>
                      <Text preset="bodyMedium" color={COLORS.textPrimary}>
                        {device.label}
                      </Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {device.lastSeenAt ? `dernier signal ${formatRelative(device.lastSeenAt, locale)}` : 'aucun signal reçu'}
                        {device.keyRotatedAt ? ` · clé tournée le ${formatDate(device.keyRotatedAt, locale)}` : ''}
                      </Text>
                    </View>
                    <Chip
                      label={device.status === 'ACTIVE' ? (device.silent ? 'Actif mais muet' : 'Actif') : device.status}
                      tone={device.status === 'ACTIVE' ? (device.silent ? 'warning' : 'success') : 'error'}
                      size="sm"
                    />
                  </View>

                  {device.lastReading ? (
                    <View style={styles.lastReading}>
                      <Text preset="caption" color={COLORS.slateGray}>
                        Dernière mesure
                      </Text>
                      <Text preset="bodySm" color={COLORS.textPrimary}>
                        {device.lastReading.metric} : {formatNumber(device.lastReading.value, locale, 2)}
                        {device.lastReading.unit ? ` ${device.lastReading.unit}` : ''} · {formatDate(device.lastReading.at, locale)}
                      </Text>
                      <ProvenanceTag kind="sensor" />
                    </View>
                  ) : null}

                  <View style={styles.actions}>
                    <Button
                      label="Voir les relevés"
                      onPress={() => setSelectedDevice(device.id)}
                      variant={deviceId === device.id ? 'ghost' : 'outline'}
                      size="sm"
                      icon="list-outline"
                    />
                    <Button
                      label="Tourner la clé"
                      onPress={() => rotate.mutate(device.id)}
                      variant="outline"
                      size="sm"
                      icon="key-outline"
                      loading={rotate.isPending && rotate.variables === device.id}
                    />
                  </View>

                  {deviceId === device.id && device.status === 'ACTIVE' ? (
                    <View style={styles.revoke}>
                      <Input
                        label="Motif de révocation"
                        value={revokeReason}
                        onChangeText={setRevokeReason}
                        placeholder="Appareil remplacé / perdu"
                        icon="alert-circle-outline"
                        optionalLabel="5 caractères minimum"
                      />
                      <Button
                        label="Révoquer l’appareil"
                        onPress={() => revoke.mutate({ target: device.id, reason: revokeReason.trim() })}
                        variant="ghost"
                        size="sm"
                        icon="close-circle-outline"
                        loading={revoke.isPending}
                        disabled={revokeReason.trim().length < 5}
                      />
                    </View>
                  ) : null}
                </Card>
              </Reveal>
            ))}
          </View>
        )}

        {deviceId ? (
          <>
            <Text preset="overline" color={COLORS.forestGreen}>
              Relevés
            </Text>

            <ChipRow>
              {WINDOWS.map((window) => (
                <FilterChip key={window.hours} label={window.label} active={hours === window.hours} onPress={() => setHours(window.hours)} />
              ))}
            </ChipRow>

            {readings.isLoading ? (
              <LoadingState count={2} height={90} />
            ) : readings.isError ? (
              <ErrorState error={readings.error} onRetry={() => void readings.refetch()} />
            ) : rows.length === 0 ? (
              <EmptyState
                title="Aucune mesure sur la période"
                description={`Fenêtre analysée : ${formatNumber(readings.data?.window.hours ?? hours, locale)} h depuis ${
                  readings.data ? formatDate(readings.data.window.since, locale) : '—'
                }.`}
                icon="pulse-outline"
              />
            ) : (
              <Card tone="white" style={styles.card}>
                <Text preset="caption" color={COLORS.slateGray}>
                  {formatNumber(rows.length, locale)} mesure(s) · fenêtre {formatNumber(readings.data?.window.hours ?? hours, locale)} h
                </Text>

                {(readings.data?.gaps ?? []).length > 0 ? (
                  <View style={styles.gaps}>
                    <Ionicons name="warning-outline" size={15} color={COLORS.warning} />
                    <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
                      {formatNumber(readings.data?.gaps.length ?? 0, locale)} trou(s) de mesure détecté(s) :{' '}
                      {(readings.data?.gaps ?? [])
                        .slice(0, 3)
                        .map((gap) => `${formatDate(gap.from, locale)} → ${formatDate(gap.to, locale)} (${formatNumber(gap.minutes, locale)} min)`)
                        .join(' · ')}
                      . Aucune valeur n’est interpolée.
                    </Text>
                  </View>
                ) : null}

                <View style={styles.readings}>
                  {rows
                    .slice(-25)
                    .reverse()
                    .map((reading) => (
                      <View key={reading.id} style={styles.readingRow}>
                        <Text preset="caption" color={COLORS.slateGray} style={styles.readingDate}>
                          {formatDate(reading.at, locale)}
                        </Text>
                        <Text preset="bodySm" color={COLORS.textPrimary} style={styles.readingMetric}>
                          {reading.metric}
                        </Text>
                        <Text preset="bodySm" color={COLORS.textPrimary} style={styles.readingValue}>
                          {formatNumber(reading.value, locale, 2)}
                          {reading.unit ? ` ${reading.unit}` : ''}
                        </Text>
                        {reading.quality ? <Chip label={reading.quality} tone="neutral" size="sm" /> : null}
                      </View>
                    ))}
                </View>
              </Card>
            )}
          </>
        ) : null}

        {otherDevices.length > 0 ? (
          <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
            {formatNumber(otherDevices.length, locale)} autre(s) appareil(s) rattaché(s) à d’autres parcelles de
            votre organisation.
          </Text>
        ) : null}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  alertHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.lightBorder,
  },
  alertChips: { gap: 4, alignItems: 'flex-end' },
  alertActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  lineHeight: { lineHeight: 18 },
  disclaimer: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  secret: { gap: SPACING.sm },
  key: { fontFamily: 'monospace', fontSize: 13 },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end' },
  form: { gap: SPACING.md },
  card: { gap: SPACING.md },
  head: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center' },
  headIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    backgroundColor: TINTS.forestGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { flex: 1, gap: 2 },
  lastReading: { gap: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  revoke: { gap: SPACING.sm },
  gaps: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  readings: { gap: SPACING.sm },
  readingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  readingDate: { width: 150 },
  readingMetric: { flex: 1 },
  readingValue: { minWidth: 90, textAlign: 'right' },
  list: { gap: SPACING.md },
});
