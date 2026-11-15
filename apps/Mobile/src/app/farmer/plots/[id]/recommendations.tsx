import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

import { PlotScreenHeader } from '@/components/farmer/PlotScreenHeader';
import {
  LigneMethodeCulture,
  MethodeDeCalcul,
} from '@/components/farmer/RecommendationMethod';
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
  Progress,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import type { CropRecommendation, RecommendationCreated } from '@/services/api/types';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { plotApi, recommendationApi, referenceApi, soilApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

const LEVEL_TONES: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
  HIGH: 'success',
  MEDIUM: 'warning',
  LOW: 'info',
  INSUFFICIENTLY_DOCUMENTED: 'neutral',
};

/**
 * Compatibilité culture / parcelle (SOIL-04 → SOIL-08).
 *
 * Chaque niveau provient d'un jeu de règles validé, versionné, et expose ses
 * critères satisfaits, non satisfaits et manquants. Si les données manquent,
 * le niveau est « insuffisamment documenté » : rien n'est conclu.
 */
export default function PlotRecommendations() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const [cropId, setCropId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const plot = useQuery({
    queryKey: queryKeys.plots.one(id),
    queryFn: () => plotApi.get(id).then((result) => result.data),
    enabled: Boolean(id),
  });
  const crops = useQuery({
    queryKey: queryKeys.crops.all,
    queryFn: () => referenceApi.crops().then((result) => result.data),
  });
  const suitability = useQuery({
    queryKey: queryKeys.soil.suitability(id),
    queryFn: () => soilApi.suitability(id).then((result) => result.data),
    enabled: Boolean(id),
  });

  const compute = useMutation({
    mutationFn: (selectedCrop: string) => soilApi.computeSuitability(id, { cropId: selectedCrop }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.soil.suitability(id) });
    },
    onError: (caught) => setError(caught),
  });

  // ── Moteur de recommandation (quoi semer sur une période donnée) ─────────
  //
  // Distinct de la compatibilité ci-dessous : celle-ci ne dépend d'aucune
  // période. Sans données suffisantes le serveur renvoie INSUFFICIENT_DATA et
  // aucun classement — rien n'est deviné.
  const [periodStart, setPeriodStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(() =>
    new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10),
  );
  const [created, setCreated] = useState<RecommendationCreated | null>(null);

  const recommendationHistory = useQuery({
    queryKey: queryKeys.recommendations.list(id, { limit: 10 }),
    queryFn: () => recommendationApi.list(id, { limit: 10 }).then((result) => result.data),
    enabled: Boolean(id),
  });

  const computePlan = useMutation({
    mutationFn: () =>
      recommendationApi.create(id, {
        periodStart: new Date(periodStart).toISOString(),
        periodEnd: new Date(periodEnd).toISOString(),
      }),
    onSuccess: (result) => {
      setError(null);
      setCreated(result.data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.list(id, { limit: 10 }) });
    },
    onError: (caught) => {
      setCreated(null);
      setError(caught);
    },
  });

  const decidePlan = useMutation({
    mutationFn: ({ recId, decision }: { recId: string; decision: 'ACCEPTED' | 'REJECTED' }) =>
      recommendationApi.decide(recId, { decision }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.list(id, { limit: 10 }) });
    },
    onError: (caught) => setError(caught),
  });

  const selected = cropId ?? plot.data?.currentCropId ?? null;
  const items = suitability.data?.items ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <PlotScreenHeader title={t('ui.semisCompatibilite')} plotName={plot.data?.name} plotId={id} />

      <Section bare contentStyle={styles.section}>
        {/* ── Quoi semer sur une période donnée ─────────────────────────── */}
        <Card tone="white" style={styles.card}>
          <Text preset="overline" color={COLORS.forestGreen}>{t('ui.recommandationsDeSemis')}</Text>
          <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.classementCalculeSurLaPeriodeDemandee')}</Text>

          <Input
            label={t('ui.debutDePeriode')}
            value={periodStart}
            onChangeText={setPeriodStart}
            placeholder={t('ui.aaaaMmJj')}
            autoCapitalize="none"
          />
          <Input
            label={t('ui.finDePeriode')}
            value={periodEnd}
            onChangeText={setPeriodEnd}
            placeholder={t('ui.aaaaMmJj')}
            autoCapitalize="none"
          />

          <Button
            label={t('ui.calculer')}
            variant="primary"
            fullWidth
            loading={computePlan.isPending}
            onPress={() => computePlan.mutate()}
            icon="leaf-outline"
          />

          {error ? <ErrorState error={error} showRequestId /> : null}

          {created ? (
            <>
              {created.dataModeNotice ? (
                <Text preset="caption" color={COLORS.warning} style={styles.lineHeight}>
                  {created.dataModeNotice}
                </Text>
              ) : null}
              {/*
                Méthode de calcul, statut indicatif et rappel sur la nature du
                score : tout vient de la réponse de l'API. Le bloc « indicative »
                qui était ici a été déplacé dans le composant.
              */}
              <MethodeDeCalcul data={created} />

              {created.recommendation.status === 'INSUFFICIENT_DATA' ? (
                <EmptyState
                  title={t('ui.donneesInsuffisantes')}
                  description={
                    created.recommendation.insufficiencyReason ??
                    t('ui.leMoteurNAPasAssez_77e12')
                  }
                  icon="alert-circle-outline"
                />
              ) : (
                <>
                  <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.cultureSExamineeSClasseeS_4647f', { candidates: created.counts.candidates, ranked: created.counts.ranked, eliminated: created.counts.eliminated, readingsUsed: created.counts.readingsUsed })}</Text>
                  <RankedBlock recommendation={created.recommendation} />
                </>
              )}
            </>
          ) : null}
        </Card>

        <Card tone="white" style={styles.card}>
          <Text preset="overline" color={COLORS.forestGreen}>{t('ui.historiqueDesRecommandations')}</Text>
          {recommendationHistory.isLoading ? <LoadingState count={1} height={64} /> : null}
          {recommendationHistory.isError ? (
            <ErrorState error={recommendationHistory.error} onRetry={() => void recommendationHistory.refetch()} />
          ) : null}
          {recommendationHistory.data && recommendationHistory.data.items.length === 0 ? (
            <EmptyState
              title={t('ui.aucuneRecommandation')}
              description={t('ui.aucunClassementNAEncoreEte')}
              icon="leaf-outline"
            />
          ) : null}
          {(recommendationHistory.data?.items ?? []).map((recommendation) => (
            <Reveal key={recommendation.id}>
              <View style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text preset="bodySm" color={COLORS.textPrimary}>
                    {formatDate(recommendation.periodStart, locale)} →{' '}
                    {formatDate(recommendation.periodEnd, locale)}
                  </Text>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.jCultureSClasseeS', { requestedDays: recommendation.requestedDays, mode: recommendation.mode, length: recommendation.scores.length })}</Text>
                </View>
                <Chip
                  label={recommendation.status}
                  tone={
                    recommendation.status === 'ACTIVE'
                      ? 'success'
                      : recommendation.status === 'INSUFFICIENT_DATA'
                        ? 'warning'
                        : 'neutral'
                  }
                  size="sm"
                />
              </View>

              {recommendation.status === 'PENDING' ? (
                <View style={styles.decisionRow}>
                  <Button
                    label={t('ui.accepter')}
                    variant="primary"
                    size="sm"
                    loading={decidePlan.isPending}
                    onPress={() => decidePlan.mutate({ recId: recommendation.id, decision: 'ACCEPTED' })}
                  />
                  <Button
                    label={t('ui.refuser')}
                    variant="outline"
                    size="sm"
                    loading={decidePlan.isPending}
                    onPress={() => decidePlan.mutate({ recId: recommendation.id, decision: 'REJECTED' })}
                  />
                </View>
              ) : null}

              {recommendation.status === 'INSUFFICIENT_DATA' ? (
                <Text preset="caption" color={COLORS.warning} style={styles.lineHeight}>
                  {recommendation.insufficiencyReason ?? t('ui.donneesInsuffisantesPourClasserUneCulture')}
                </Text>
              ) : (
                <RankedBlock recommendation={recommendation} />
              )}
            </Reveal>
          ))}
        </Card>

        <Card tone="pale" style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.info} />
          <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>{t('ui.evaluationProduiteParUnJeuDe')}</Text>
        </Card>

        <Card tone="white" style={styles.card}>
          <Text preset="overline" color={COLORS.forestGreen}>{t('ui.evaluerUneCulture')}</Text>
          {crops.isLoading ? (
            <LoadingState count={1} height={44} />
          ) : crops.isError ? (
            <ErrorState error={crops.error} onRetry={() => void crops.refetch()} />
          ) : (
            <>
              <ChipRow>
                {(crops.data ?? []).slice(0, 12).map((crop) => (
                  <FilterChip
                    key={crop.id}
                    label={crop.names?.fr ?? crop.slug}
                    active={selected === crop.id}
                    onPress={() => setCropId(crop.id)}
                  />
                ))}
              </ChipRow>
              {error ? <ErrorState error={error} showRequestId /> : null}
              <Button
                label={t('ui.evaluerLaCompatibilite')}
                onPress={() => selected && compute.mutate(selected)}
                variant="primary"
                fullWidth
                loading={compute.isPending}
                disabled={!selected}
              />
              {!selected ? (
                <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.selectionnezUneCultureSansCultureCourante')}</Text>
              ) : null}
            </>
          )}
        </Card>

        {suitability.isLoading ? (
          <LoadingState count={2} height={140} />
        ) : suitability.isError ? (
          <ErrorState error={suitability.error} onRetry={() => void suitability.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title={t('ui.aucuneEvaluation')}
            description={t('ui.lancezUneEvaluationPourComparerLa')}
            icon="leaf-outline"
          />
        ) : (
          <View style={styles.list}>
            {items.map((item, index) => (
              <Reveal key={item.id} index={index} variant="up">
                <Card tone="white" style={styles.card}>
                  <View style={styles.head}>
                    <View style={styles.headText}>
                      <Text preset="h3" color={COLORS.textPrimary}>
                        {item.levelLabel}
                      </Text>
                      <Text preset="caption" color={COLORS.slateGray}>{t('ui.jeuDeReglesConfiance', { ruleSetVersion: item.ruleSetVersion, generatedAt: formatDate(item.generatedAt, locale), confidence: item.confidence })}</Text>
                    </View>
                    <Chip label={item.level} tone={LEVEL_TONES[item.level] ?? 'neutral'} size="sm" />
                  </View>

                  {item.coverage !== null ? (
                    <View style={styles.coverage}>
                      <Text preset="caption" color={COLORS.slateGray}>{t('ui.criteresCouvertsParDesDonneesDisponibles')}</Text>
                      <Progress value={Math.round(item.coverage * 100)} />
                    </View>
                  ) : null}

                  <Text preset="bodySm" color={COLORS.textPrimary} style={styles.lineHeight}>
                    {item.explanation.summary}
                  </Text>

                  {item.explanation.satisfied.length > 0 ? (
                    <View style={styles.block}>
                      <Text preset="caption" color={COLORS.success}>{t('ui.criteresSatisfaits')}</Text>
                      {item.explanation.satisfied.map((line) => (
                        <Text key={line} preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                          • {line}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  {item.explanation.unsatisfied.length > 0 ? (
                    <View style={styles.block}>
                      <Text preset="caption" color={COLORS.warning}>{t('ui.criteresNonSatisfaits')}</Text>
                      {item.explanation.unsatisfied.map((line) => (
                        <Text key={line} preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                          • {line}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  {item.explanation.missing.length > 0 ? (
                    <View style={styles.block}>
                      <Text preset="caption" color={COLORS.slateGray}>{t('ui.donneesManquantes_7bb32')}</Text>
                      {item.explanation.missing.map((line) => (
                        <Text key={line} preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                          • {line}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  {item.usedData ? (
                    <Text preset="caption" color={COLORS.slateGray}>{t('ui.sourcesUtiliseesParametreSDuProfil', { value: item.usedData.sources.length > 0 ? item.usedData.sources.join(', ') : 'aucune', parameterCount: item.usedData.parameterCount })}</Text>
                  ) : null}

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

/** Classement : score, couverture, sources, critères non évalués. */
function RankedBlock({ recommendation }: { recommendation: CropRecommendation }) {
  const { t } = useI18n();
  if (recommendation.scores.length === 0) {
    return (
      <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.aucuneCultureClassee')}</Text>
    );
  }
  return (
    <View style={styles.ranked}>
      {recommendation.scores.map((entry, index) => (
        <View key={entry.cropSlug} style={styles.rankedRow}>
          <View style={{ flex: 1 }}>
            <Text preset="bodySm" color={COLORS.textPrimary}>
              {index + 1}. {entry.label}
            </Text>
            <LigneMethodeCulture
              coverage={entry.coverage}
              evaluatedCount={entry.evaluatedCount}
              tooFewCriteria={entry.tooFewCriteria}
            />
            <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
              {entry.cycleDays ? t('ui.cycleJ', { cycleDays: entry.cycleDays }) : ''}
              {recommendation.sources.length > 0
                ? `${entry.cycleDays ? ' · ' : ''}sources : ${recommendation.sources.join(', ')}`
                : ''}
            </Text>
            {entry.notEvaluated.length > 0 ? (
              <View style={styles.nonEvalues}>
                <Text preset="caption" color={COLORS.warning} style={styles.lineHeight}>{t('ui.critereSNonEvalueS', { length: entry.notEvaluated.length })}</Text>
                {entry.notEvaluated.map((critere) => (
                  /*
                   * `notEvaluated` contient des **objets** `{ key, label,
                   * reason, cause }`. L'ancien `notEvaluated.join(', ')`
                   * compilait parce que le type déclarait `string[]` — et
                   * affichait `[object Object]`.
                   */
                  <Text key={critere.key} preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                    {critere.label} — {critere.reason}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
          {/*
            Le score est une **adéquation**, pas un rendement ni une chance de
            réussite : l'étiquette le dit. La version est affichée avec, parce
            qu'un score sans sa règle de combinaison est ininterprétable.
          */}
          <View style={{ alignItems: 'flex-end' }}>
            <Chip
              label={t('ui.adequation', { value: entry.score.toFixed(2) })}
              tone={index === 0 ? 'success' : 'neutral'}
              size="sm"
            />
            {/*
              Le libellé vient de l'API. L'ancien code comparait à deux
              constantes et n'affichait **rien** pour toute autre règle.
            */}
            {recommendation.ruleSetVersion || entry.engineVersion ? (
              <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 4 }}>
                {t('ui.moteurV', { value: entry.engineVersion ?? recommendation.ruleSetVersion })}
                {entry.combinationRuleLabel ? ` · ${entry.combinationRuleLabel}` : ''}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  ranked: { gap: SPACING.sm },
  rankedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.lightBorder,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.lightBorder,
  },
  decisionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  lineHeight: { lineHeight: 18 },
  disclaimer: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  card: { gap: SPACING.md },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  headText: { flex: 1, gap: 2 },
  nonEvalues: { gap: 2, marginTop: 4, paddingLeft: SPACING.xs },
  coverage: { gap: SPACING.xs },
  block: { gap: 4 },
  list: { gap: SPACING.md },
});
