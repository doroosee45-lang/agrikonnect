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
      setNotice(result.data.disclaimer ?? 'Diagnostic calculé.');
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
          ? 'Scène satellite acquise.'
          : `Acquisition refusée : ${result.data.reason ?? 'raison non précisée'}.`,
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
      <PlotScreenHeader title="Satellite & diagnostic" plotName={plot.data?.name} plotId={id} />

      <Section bare contentStyle={styles.section}>
        <Card tone={health.data?.ready ? 'pale' : 'gold'} style={styles.engine}>
          <Ionicons
            name={health.data?.ready ? 'checkmark-circle-outline' : 'cloud-offline-outline'}
            size={16}
            color={health.data?.ready ? COLORS.success : COLORS.warning}
          />
          <View style={styles.engineBody}>
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
              {health.data?.note ?? 'État du moteur géospatial inconnu.'}
            </Text>
            {health.data ? (
              <Text preset="caption" color={COLORS.slateGray}>
                {health.data.engine.engine}
                {health.data.engine.version ? ` ${health.data.engine.version}` : ''} · méthode {health.data.methodVersion} ·{' '}
                latence {formatNumber(health.data.engine.latencyMs, locale, 0)} ms
                {health.data.engine.error ? ` · ${health.data.engine.error}` : ''}
              </Text>
            ) : null}
          </View>
        </Card>

        <Card tone="white" style={styles.card}>
          <Text preset="overline" color={COLORS.forestGreen}>
            Séries satellite
          </Text>

          {settings.data ? (
            <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
              Source {settings.data.provider} · rafraîchissement {settings.data.refreshHours} h · scènes rejetées au-delà
              de {settings.data.cloudCoverRejectPct} % de couverture nuageuse
            </Text>
          ) : null}

          {settings.data?.enabled === false ? (
            <Text preset="caption" color={COLORS.warning} style={styles.lineHeight}>
              L’acquisition satellite est désactivée : les séries ci-dessous sont historiques et ne se renouvellent pas.
            </Text>
          ) : null}

          {/* Le rappel vient du serveur : un satellite ne mesure jamais le sous-sol. */}
          <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
            {settings.data?.subsoilCaveat ??
              'Ces valeurs décrivent la surface (humidité, température, végétation), jamais le sous-sol. Le sous-sol ne vient que des sondes.'}
          </Text>

          <Button
            label="Acquérir une scène"
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
              title="Aucune observation satellite"
              description="Aucune scène exploitable n'a été acquise pour cette parcelle. Une acquisition refusée n'est pas une erreur : la raison est indiquée."
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
                  <Text preset="caption" color={COLORS.slateGray}>
                    {observation.provider} · {formatDate(observation.observedAt, locale)} · nuages{' '}
                    {observation.cloudCover === null ? 'inconnu' : `${observation.cloudCover} %`}
                  </Text>
                </View>
                <Chip
                  label={observation.mode === 'SIMULATED' ? 'SIMULÉ' : observation.confidence}
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
          <Text preset="overline" color={COLORS.forestGreen}>
            Lancer un diagnostic
          </Text>
          {notice ? (
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
              {notice}
            </Text>
          ) : null}
          {error ? <ErrorState error={error} showRequestId /> : null}
          <Button
            label="Calculer le diagnostic"
            onPress={() => run.mutate()}
            variant="primary"
            fullWidth
            loading={run.isPending}
            icon="planet-outline"
          />
          <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
            Le calcul fusionne les analyses de sol, les relevés de capteurs et les séries satellite disponibles sur
            la parcelle. Le moteur peut mettre jusqu’à 20 secondes à répondre.
          </Text>
        </Card>

        {latest.isLoading ? (
          <LoadingState count={1} height={140} />
        ) : latest.isError ? (
          <EmptyState
            title="Aucun diagnostic enregistré"
            description="Lancez un calcul : sans donnée exploitable, le serveur refusera plutôt que d’inventer un résultat."
            icon="planet-outline"
          />
        ) : diagnosis ? (
          <Card tone="white" style={styles.card}>
            <View style={styles.head}>
              <View style={styles.headText}>
                <Text preset="h3" color={COLORS.textPrimary}>
                  Diagnostic du {formatDate(diagnosis.createdAt, locale)}
                </Text>
                <Text preset="caption" color={COLORS.slateGray}>
                  moteur {diagnosis.engine} {diagnosis.engineVersion} · méthode {diagnosis.methodVersion}
                </Text>
              </View>
              <ProvenanceTag kind="satellite" />
            </View>

            <View style={styles.confidence}>
              <Text preset="caption" color={COLORS.slateGray}>
                Confiance globale {diagnosis.confidenceLevel ? `(${diagnosis.confidenceLevel})` : ''}
              </Text>
              <Progress value={diagnosis.confidence !== null ? Math.round(diagnosis.confidence * 100) : 0} tone="gold" />
              <Text preset="caption" color={COLORS.textPrimary}>
                {diagnosis.confidence !== null ? `${formatNumber(diagnosis.confidence * 100, locale, 1)} %` : 'non publiée'}
              </Text>
            </View>

            <View style={styles.block}>
              <Text preset="caption" color={COLORS.textPrimary}>
                Sources fusionnées
              </Text>
              {diagnosis.sourcesUsed.length > 0 ? (
                <ChipRow>
                  {diagnosis.sourcesUsed.map((source) => (
                    <Chip key={source} label={source} tone="success" size="sm" />
                  ))}
                </ChipRow>
              ) : (
                <Text preset="caption" color={COLORS.slateGray}>
                  aucune source listée
                </Text>
              )}
            </View>

            <View style={styles.block}>
              <Text preset="caption" color={COLORS.textPrimary}>
                Entrées prises en compte
              </Text>
              <View style={styles.facts}>
                <View style={styles.fact}>
                  <Text preset="caption" color={COLORS.slateGray}>
                    Échantillons de sol
                  </Text>
                  <Text preset="bodySm" color={COLORS.textPrimary}>
                    {formatNumber(Number(inputs.samples ?? 0), locale)}
                  </Text>
                </View>
                <View style={styles.fact}>
                  <Text preset="caption" color={COLORS.slateGray}>
                    Relevés capteurs
                  </Text>
                  <Text preset="bodySm" color={COLORS.textPrimary}>
                    {formatNumber(Number(inputs.sensorReadings ?? 0), locale)}
                  </Text>
                </View>
                <View style={styles.fact}>
                  <Text preset="caption" color={COLORS.slateGray}>
                    Séries satellite
                  </Text>
                  <Text preset="bodySm" color={COLORS.textPrimary}>
                    {formatNumber(Number(inputs.satelliteSeries ?? 0), locale)}
                  </Text>
                </View>
                <View style={styles.fact}>
                  <Text preset="caption" color={COLORS.slateGray}>
                    Recommandations
                  </Text>
                  <Text preset="bodySm" color={COLORS.textPrimary}>
                    {inputs.allowRecommendations === true ? 'autorisées' : 'désactivées'}
                  </Text>
                </View>
              </View>
            </View>

            <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
              Les matrices de pixels ne sont jamais stockées : seul le compte des entrées est conservé, avec la
              version de méthode utilisée.
            </Text>
          </Card>
        ) : null}

        <Text preset="overline" color={COLORS.forestGreen}>
          Historique des calculs
        </Text>

        {history.isLoading ? (
          <LoadingState count={2} height={80} />
        ) : history.isError ? (
          <ErrorState error={history.error} onRetry={() => void history.refetch()} />
        ) : (history.data?.items ?? []).length === 0 ? (
          <EmptyState title="Aucun calcul" description="Chaque diagnostic crée une entrée horodatée, jamais réécrite." icon="time-outline" />
        ) : (
          <View style={styles.list}>
            {(history.data?.items ?? []).map((item, index) => (
              <Reveal key={item.id} index={index} variant="up">
                <Card tone="white" style={styles.historyCard}>
                  <View style={styles.historyBody}>
                    <Text preset="bodySm" color={COLORS.textPrimary}>
                      {formatDate(item.createdAt, locale)}
                    </Text>
                    <Text preset="caption" color={COLORS.slateGray}>
                      {item.engine} {item.engineVersion} · méthode {item.methodVersion} · confiance{' '}
                      {item.confidence !== null ? `${formatNumber(item.confidence * 100, locale, 0)} %` : '—'}
                      {item.confidenceLevel ? ` (${item.confidenceLevel})` : ''}
                    </Text>
                  </View>
                  {item.sourcesUsed.length > 0 ? (
                    <Chip label={`${item.sourcesUsed.length} source(s)`} tone="neutral" size="sm" />
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
