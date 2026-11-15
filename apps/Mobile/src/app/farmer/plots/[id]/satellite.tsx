import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

import { PlotScreenHeader } from '@/components/farmer/PlotScreenHeader';
import {
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  ErrorState,
  LoadingState,
  Progress,
  ProvenanceTag,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate, formatNumber } from '@/lib/format';
import { geoApi, plotApi, satelliteApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

/**
 * Diagnostic géospatial (S4 §9).
 *
 * Le moteur Python fusionne les sources réellement disponibles (analyses de sol,
 * capteurs, séries satellite, valeurs déclarées). Sans donnée exploitable il
 * répond 422, et 503 tant qu'il n'est pas démarré : aucun diagnostic de
 * substitution n'est fabriqué.
 */
export default function PlotSatellite() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const plot = useQuery({
    queryKey: queryKeys.plots.one(id),
    queryFn: () => plotApi.get(id).then((result) => result.data),
    enabled: Boolean(id),
  });
  const health = useQuery({
    queryKey: queryKeys.geoEngine.health,
    queryFn: () => geoApi.health().then((result) => result.data),
  });
  const latest = useQuery({
    queryKey: queryKeys.soil.diagnosisLatest(id),
    queryFn: () => geoApi.latest(id).then((result) => result.data),
    enabled: Boolean(id),
    /** 404 = aucun diagnostic enregistré. */
    retry: false,
  });
  const history = useQuery({
    queryKey: queryKeys.soil.diagnosisHistory(id),
    queryFn: () => geoApi.history(id, { limit: 10 }).then((result) => result.data),
    enabled: Boolean(id),
  });

  const run = useMutation({
    mutationFn: () => geoApi.diagnose(id, {}),
    onSuccess: (result) => {
      setError(null);
      setNotice(result.data.disclaimer ?? t('ui.diagnosticCalcule'));
      void queryClient.invalidateQueries({ queryKey: queryKeys.soil.diagnosisLatest(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.soil.diagnosisHistory(id) });
    },
    onError: (caught) => {
      setNotice(null);
      setError(caught);
    },
  });

  // ── Séries satellite ──────────────────────────────────────────────
  //
  // Le titre de cet écran promet du satellite : sans cet appel il n'affichait
  // que le diagnostic. Un satellite mesure la surface, jamais le sous-sol — le
  // rappel `measuresSubsurface: false` vient du serveur et est repris ici.
  const observations = useQuery({
    queryKey: queryKeys.satellite.observations(id, { limit: 20 }),
    queryFn: () => satelliteApi.observations(id, { limit: 20 }).then((result) => result.data),
    enabled: Boolean(id),
  });
  const settings = useQuery({
    queryKey: queryKeys.satellite.settings,
    queryFn: () => satelliteApi.settings().then((result) => result.data),
  });

  const acquire = useMutation({
    mutationFn: () => satelliteApi.acquire(id),
    onSuccess: (result) => {
      setError(null);
      /** 200 = scène refusée (nuages, acquisition désactivée) : ce n'est pas une erreur. */
      setNotice(
        result.data.acquired
          ? t('ui.sceneSatelliteAcquise')
          : t('ui.acquisitionRefusedReason', { reason: result.data.reason ?? t('ui.reasonNotSpecified') }),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.satellite.observations(id, { limit: 20 }) });
    },
    onError: (caught) => {
      setNotice(null);
      setError(caught);
    },
  });

  const diagnosis = latest.data?.diagnosis ?? null;
  const inputs = (diagnosis?.inputs ?? {}) as Record<string, unknown>;

  return (
    <Screen background={COLORS.naturalWhite}>
      <PlotScreenHeader title={t('ui.satelliteDiagnostic')} plotName={plot.data?.name} plotId={id} />

      <Section bare contentStyle={styles.section}>
        <Card tone={health.data?.ready ? 'pale' : 'gold'} style={styles.engine}>
          <Ionicons
            name={health.data?.ready ? 'checkmark-circle-outline' : 'cloud-offline-outline'}
            size={16}
            color={health.data?.ready ? COLORS.success : COLORS.warning}
          />
          <View style={styles.engineBody}>
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
              {health.data?.note ?? t('ui.etatDuMoteurGeospatialInconnu')}
            </Text>
            {health.data ? (
              <Text preset="caption" color={COLORS.slateGray}>{t('ui.methodeLatenceMs', { engine: health.data.engine.engine, value: health.data.engine.version ? ` ${health.data.engine.version}` : '', methodVersion: health.data.methodVersion, latencyMs: formatNumber(health.data.engine.latencyMs, locale, 0), value2: health.data.engine.error ? ` · ${health.data.engine.error}` : '' })}</Text>
            ) : null}
          </View>
        </Card>

        <Card tone="white" style={styles.card}>
          <Text preset="overline" color={COLORS.forestGreen}>{t('ui.seriesSatellite')}</Text>

          {settings.data ? (
            <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.sourceRafraichissementHScenesRejeteesAu', { provider: settings.data.provider, refreshHours: settings.data.refreshHours, cloudCoverRejectPct: settings.data.cloudCoverRejectPct })}</Text>
          ) : null}

          {settings.data?.enabled === false ? (
            <Text preset="caption" color={COLORS.warning} style={styles.lineHeight}>{t('ui.lAcquisitionSatelliteEstDesactiveeLes')}</Text>
          ) : null}

          {/* Le rappel vient du serveur : un satellite ne mesure jamais le sous-sol. */}
          <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
            {settings.data?.subsoilCaveat ??
              t('ui.cesValeursDecriventLaSurfaceHumidite')}
          </Text>

          <Button
            label={t('ui.acquerirUneScene')}
            onPress={() => acquire.mutate()}
            variant="outline"
            fullWidth
            loading={acquire.isPending}
            icon="cloud-download-outline"
            disabled={settings.data?.enabled === false}
          />

          {observations.isLoading ? <LoadingState count={2} height={64} /> : null}

          {observations.data && observations.data.items.length === 0 ? (
            <EmptyState
              title={t('ui.aucuneObservationSatellite')}
              description={t('ui.aucuneSceneExploitableNAEte')}
              icon="cloud-outline"
            />
          ) : null}

          {observations.data?.items.map((observation) => (
            <Reveal key={observation.id}>
              <View style={styles.obsRow}>
                <View style={{ flex: 1 }}>
                  <Text preset="bodySm" color={COLORS.textPrimary}>
                    {observation.index} · {formatNumber(observation.value, locale, 2)}
                  </Text>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.nuages', { provider: observation.provider, observedAt: formatDate(observation.observedAt, locale), value: observation.cloudCover === null ? 'inconnu' : `${observation.cloudCover} %` })}</Text>
                </View>
                <Chip
                  label={observation.mode === 'SIMULATED' ? t('ui.simule') : observation.confidence}
                  tone={observation.mode === 'SIMULATED' ? 'warning' : 'neutral'}
                  size="sm"
                />
              </View>
              {/* Une observation satellite est de la télédétection, pas une mesure de terrain. */}
              <ProvenanceTag kind="satellite" />
            </Reveal>
          ))}
        </Card>

        <Card tone="white" style={styles.card}>
          <Text preset="overline" color={COLORS.forestGreen}>{t('ui.lancerUnDiagnostic')}</Text>
          {notice ? (
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
              {notice}
            </Text>
          ) : null}
          {error ? <ErrorState error={error} showRequestId /> : null}
          <Button
            label={t('ui.calculerLeDiagnostic')}
            onPress={() => run.mutate()}
            variant="primary"
            fullWidth
            loading={run.isPending}
            icon="planet-outline"
          />
          <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.leCalculFusionneLesAnalysesDe')}</Text>
        </Card>

        {latest.isLoading ? (
          <LoadingState count={1} height={140} />
        ) : latest.isError ? (
          <EmptyState
            title={t('ui.aucunDiagnosticEnregistre')}
            description={t('ui.lancezUnCalculSansDonneeExploitable')}
            icon="planet-outline"
          />
        ) : diagnosis ? (
          <Card tone="white" style={styles.card}>
            <View style={styles.head}>
              <View style={styles.headText}>
                <Text preset="h3" color={COLORS.textPrimary}>{t('ui.diagnosticDu', { createdAt: formatDate(diagnosis.createdAt, locale) })}</Text>
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.moteurMethode', { engine: diagnosis.engine, engineVersion: diagnosis.engineVersion, methodVersion: diagnosis.methodVersion })}</Text>
              </View>
              <ProvenanceTag kind="satellite" />
            </View>

            <View style={styles.confidence}>
              <Text preset="caption" color={COLORS.slateGray}>{t('ui.confianceGlobale', { value: diagnosis.confidenceLevel ? `(${diagnosis.confidenceLevel})` : '' })}</Text>
              <Progress value={diagnosis.confidence !== null ? Math.round(diagnosis.confidence * 100) : 0} tone="gold" />
              <Text preset="caption" color={COLORS.textPrimary}>
                {diagnosis.confidence !== null ? `${formatNumber(diagnosis.confidence * 100, locale, 1)} %` : t('ui.nonPubliee')}
              </Text>
            </View>

            <View style={styles.block}>
              <Text preset="caption" color={COLORS.textPrimary}>{t('ui.sourcesFusionnees')}</Text>
              {diagnosis.sourcesUsed.length > 0 ? (
                <ChipRow>
                  {diagnosis.sourcesUsed.map((source) => (
                    <Chip key={source} label={source} tone="success" size="sm" />
                  ))}
                </ChipRow>
              ) : (
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.aucuneSourceListee')}</Text>
              )}
            </View>

            <View style={styles.block}>
              <Text preset="caption" color={COLORS.textPrimary}>{t('ui.entreesPrisesEnCompte')}</Text>
              <View style={styles.facts}>
                <View style={styles.fact}>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.echantillonsDeSol')}</Text>
                  <Text preset="bodySm" color={COLORS.textPrimary}>
                    {formatNumber(Number(inputs.samples ?? 0), locale)}
                  </Text>
                </View>
                <View style={styles.fact}>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.relevesCapteurs')}</Text>
                  <Text preset="bodySm" color={COLORS.textPrimary}>
                    {formatNumber(Number(inputs.sensorReadings ?? 0), locale)}
                  </Text>
                </View>
                <View style={styles.fact}>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.seriesSatellite')}</Text>
                  <Text preset="bodySm" color={COLORS.textPrimary}>
                    {formatNumber(Number(inputs.satelliteSeries ?? 0), locale)}
                  </Text>
                </View>
                <View style={styles.fact}>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.recommandations')}</Text>
                  <Text preset="bodySm" color={COLORS.textPrimary}>
                    {inputs.allowRecommendations === true ? t('ui.autorisees') : t('ui.desactivees')}
                  </Text>
                </View>
              </View>
            </View>

            <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.lesMatricesDePixelsNeSont')}</Text>
          </Card>
        ) : null}

        <Text preset="overline" color={COLORS.forestGreen}>{t('ui.historiqueDesCalculs')}</Text>

        {history.isLoading ? (
          <LoadingState count={2} height={80} />
        ) : history.isError ? (
          <ErrorState error={history.error} onRetry={() => void history.refetch()} />
        ) : (history.data?.items ?? []).length === 0 ? (
          <EmptyState title={t('ui.aucunCalcul')} description={t('ui.chaqueDiagnosticCreeUneEntreeHorodatee')} icon="time-outline" />
        ) : (
          <View style={styles.list}>
            {(history.data?.items ?? []).map((item, index) => (
              <Reveal key={item.id} index={index} variant="up">
                <Card tone="white" style={styles.historyCard}>
                  <View style={styles.historyBody}>
                    <Text preset="bodySm" color={COLORS.textPrimary}>
                      {formatDate(item.createdAt, locale)}
                    </Text>
                    <Text preset="caption" color={COLORS.slateGray}>{t('ui.methodeConfiance', { engine: item.engine, engineVersion: item.engineVersion, methodVersion: item.methodVersion, value: item.confidence !== null ? `${formatNumber(item.confidence * 100, locale, 0)} %` : '—', value2: item.confidenceLevel ? ` (${item.confidenceLevel})` : '' })}</Text>
                  </View>
                  {item.sourcesUsed.length > 0 ? (
                    <Chip label={t('ui.sourceS', { length: item.sourcesUsed.length })} tone="neutral" size="sm" />
                  ) : null}
                </Card>
              </Reveal>
            ))}
          </View>
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  lineHeight: { lineHeight: 18 },
  engine: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  obsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.lightBorder,
  },
  engineBody: { flex: 1, gap: 2 },
  card: { gap: SPACING.md },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  headText: { flex: 1, gap: 2 },
  confidence: { gap: SPACING.xs },
  block: { gap: SPACING.sm },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.lg },
  fact: { minWidth: 130, gap: 2 },
  historyCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  historyBody: { flex: 1, gap: 2 },
  list: { gap: SPACING.sm },
});
