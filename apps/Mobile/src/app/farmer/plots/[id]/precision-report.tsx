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
  FilterChip,
  LoadingState,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate, formatNumber } from '@/lib/format';
import { plotApi, precisionApi, referenceApi, soilApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

/**
 * Rapport de précision (PRE-02 / PRE-03) et fourchettes de rendement (SOIL-14).
 *
 * Un rapport généré automatiquement reste « proposition non validée » tant
 * qu'aucun agronome identifié ne l'a validé. Les rendements sont toujours
 * donnés en fourchette, avec leurs hypothèses.
 */
export default function PlotPrecisionReport() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const [yieldCropId, setYieldCropId] = useState<string | null>(null);
  const [yieldError, setYieldError] = useState<unknown>(null);

  const plot = useQuery({
    queryKey: queryKeys.plots.one(id),
    queryFn: () => plotApi.get(id).then((result) => result.data),
    enabled: Boolean(id),
  });
  const reports = useQuery({
    queryKey: [...queryKeys.plots.one(id), 'precision-reports'],
    queryFn: () => precisionApi.reports(id).then((result) => result.data),
    enabled: Boolean(id),
  });
  const yields = useQuery({
    queryKey: [...queryKeys.plots.one(id), 'yield-estimates'],
    queryFn: () => soilApi.yieldEstimates(id).then((result) => result.data),
    enabled: Boolean(id),
  });
  const crops = useQuery({
    queryKey: queryKeys.crops.all,
    queryFn: () => referenceApi.crops().then((result) => result.data),
  });

  const createReport = useMutation({
    mutationFn: () => precisionApi.createReport(id, {}),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.plots.one(id), 'precision-reports'] });
    },
    onError: (caught) => setError(caught),
  });

  const validate = useMutation({
    mutationFn: (reportId: string) => precisionApi.validateReport(reportId, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [...queryKeys.plots.one(id), 'precision-reports'] }),
    onError: (caught) => setError(caught),
  });

  const estimate = useMutation({
    mutationFn: (cropId: string) => soilApi.estimateYield(id, { cropId }),
    onSuccess: () => {
      setYieldError(null);
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.plots.one(id), 'yield-estimates'] });
    },
    onError: (caught) => setYieldError(caught),
  });

  const items = reports.data?.reports ?? [];
  const selectedYieldCrop = yieldCropId ?? plot.data?.currentCropId ?? null;

  return (
    <Screen background={COLORS.naturalWhite}>
      <PlotScreenHeader title="Rapport de précision" plotName={plot.data?.name} plotId={id} />

      <Section bare contentStyle={styles.section}>
        <Card tone="pale" style={styles.disclaimer}>
          <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.info} />
          <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
            Un rapport généré automatiquement ne vaut pas recommandation agronomique tant qu’un agronome identifié
            ne l’a pas validé (PRE-03). Il ne constitue en aucun cas une certification.
          </Text>
        </Card>

        <Card tone="white" style={styles.card}>
          <Text preset="overline" color={COLORS.forestGreen}>
            Rapports
          </Text>
          {error ? <ErrorState error={error} showRequestId /> : null}
          <Button
            label="Générer un rapport"
            onPress={() => createReport.mutate()}
            variant="primary"
            fullWidth
            loading={createReport.isPending}
            icon="document-text-outline"
          />
          <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
            Chaque génération porte sa version de méthode. La validation par un agronome est une opération
            distincte, enregistrée avec l’identité de son auteur.
          </Text>
        </Card>

        {reports.isLoading ? (
          <LoadingState count={2} height={110} />
        ) : reports.isError ? (
          <ErrorState error={reports.error} onRetry={() => void reports.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Aucun rapport"
            description="Générez un rapport pour consolider les données de la parcelle dans un document versionné."
            icon="document-text-outline"
          />
        ) : (
          <View style={styles.list}>
            {items.map((report, index) => (
              <Reveal key={report.id} index={index} variant="up">
                <Card tone="white" style={styles.card}>
                  <View style={styles.head}>
                    <View style={styles.headText}>
                      <Text preset="bodyMedium" color={COLORS.textPrimary}>
                        Rapport du {formatDate(report.generatedAt, locale)}
                      </Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        méthode {report.methodVersion ?? '—'} · jeu de règles {report.ruleSetVersion ?? '—'}
                        {report.validatedAt ? ` · validé le ${formatDate(report.validatedAt, locale)}` : ''}
                      </Text>
                    </View>
                    <Chip
                      label={report.validated ? 'Validé par un agronome' : 'Proposition non validée'}
                      tone={report.validated ? 'success' : 'warning'}
                      size="sm"
                    />
                  </View>

                  {!report.validated ? (
                    <Button
                      label="Enregistrer ma validation"
                      onPress={() => validate.mutate(report.id)}
                      variant="outline"
                      size="sm"
                      icon="checkmark-done-outline"
                      loading={validate.isPending && validate.variables === report.id}
                    />
                  ) : null}

                  <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                    Export PDF : {precisionApi.pdfUrl(report.id)} — l’ouverture nécessite une session authentifiée.
                  </Text>
                </Card>
              </Reveal>
            ))}
          </View>
        )}

        <Text preset="overline" color={COLORS.forestGreen}>
          Rendement estimé (fourchette)
        </Text>

        <Card tone="white" style={styles.card}>
          {crops.isLoading ? (
            <LoadingState count={1} height={44} />
          ) : crops.isError ? (
            <ErrorState error={crops.error} onRetry={() => void crops.refetch()} />
          ) : (
            <ChipRow>
              {(crops.data ?? []).slice(0, 12).map((crop) => (
                <FilterChip
                  key={crop.id}
                  label={crop.names?.fr ?? crop.slug}
                  active={selectedYieldCrop === crop.id}
                  onPress={() => setYieldCropId(crop.id)}
                />
              ))}
            </ChipRow>
          )}

          {yieldError ? <ErrorState error={yieldError} showRequestId /> : null}

          <Button
            label="Estimer le rendement"
            onPress={() => selectedYieldCrop && estimate.mutate(selectedYieldCrop)}
            variant="outline"
            fullWidth
            loading={estimate.isPending}
            disabled={!selectedYieldCrop}
            icon="trending-up-outline"
          />
          <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
            Aucune référence documentée pour la culture, ou superficie inconnue : le serveur refuse l’estimation
            plutôt que d’inventer un chiffre.
          </Text>
        </Card>

        {yields.isLoading ? (
          <LoadingState count={1} height={110} />
        ) : yields.isError ? (
          <ErrorState error={yields.error} onRetry={() => void yields.refetch()} />
        ) : (yields.data?.items ?? []).length === 0 ? (
          <EmptyState
            title="Aucune estimation"
            description="Les rendements sont toujours exprimés en fourchette, jamais en valeur unique."
            icon="trending-up-outline"
          />
        ) : (
          <View style={styles.list}>
            {(yields.data?.items ?? []).map((item, index) => (
              <Reveal key={item.id} index={index} variant="up">
                <Card tone="white" style={styles.card}>
                  <View style={styles.head}>
                    <View style={styles.headText}>
                      <Text preset="h3" color={COLORS.textPrimary}>
                        {formatNumber(item.range.lowKg, locale, 0)} – {formatNumber(item.range.highKg, locale, 0)} kg
                      </Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        méthode {item.method} · jeu de règles {item.ruleSetVersion} · {formatDate(item.createdAt, locale)}
                      </Text>
                    </View>
                    <Chip label={`± ${formatNumber(item.range.uncertaintyPct, locale, 1)} %`} tone="warning" size="sm" />
                  </View>

                  <View style={styles.facts}>
                    <View style={styles.fact}>
                      <Text preset="caption" color={COLORS.slateGray}>
                        Valeur centrale
                      </Text>
                      <Text preset="bodySm" color={COLORS.textPrimary}>
                        {formatNumber(item.range.pointKg, locale, 0)} kg
                      </Text>
                    </View>
                    <View style={styles.fact}>
                      <Text preset="caption" color={COLORS.slateGray}>
                        Surface retenue
                      </Text>
                      <Text preset="bodySm" color={COLORS.textPrimary}>
                        {formatNumber(item.assumptions.areaHa, locale, 2)} ha
                      </Text>
                    </View>
                    <View style={styles.fact}>
                      <Text preset="caption" color={COLORS.slateGray}>
                        Références
                      </Text>
                      <Text preset="bodySm" color={COLORS.textPrimary}>
                        {formatNumber(item.assumptions.lowKgPerHa, locale, 0)} – {formatNumber(item.assumptions.highKgPerHa, locale, 0)} kg/ha
                      </Text>
                    </View>
                    <View style={styles.fact}>
                      <Text preset="caption" color={COLORS.slateGray}>
                        Analyses de sol
                      </Text>
                      <Text preset="bodySm" color={COLORS.textPrimary}>
                        {formatNumber(item.sources.assessmentCount, locale)}
                      </Text>
                    </View>
                  </View>

                  <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                    {item.assumptions.note} Sources de sol :{' '}
                    {item.sources.soilSources.length > 0 ? item.sources.soilSources.join(', ') : 'aucune'}.
                  </Text>
                  <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                    {item.disclaimer}
                  </Text>
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
  disclaimer: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  card: { gap: SPACING.md },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  headText: { flex: 1, gap: 2 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.lg },
  fact: { minWidth: 130, gap: 2 },
  list: { gap: SPACING.md },
});
