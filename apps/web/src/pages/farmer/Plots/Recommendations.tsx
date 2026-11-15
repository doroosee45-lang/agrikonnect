import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  AuthGate,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Section,
  Text,
} from '@/components/ui';
import { recommendationApi, soilApi } from '@/services/endpoints';
import { LigneMethodeCulture, MethodeDeCalcul } from './RecommendationMethod';
import { queryKeys } from '@/services/query';
import type { CropRecommendation, RecommendationCreated, SuitabilityList } from '@/services/types';
import { useAuthStore } from '@/store/auth';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

/**
 * FARMER — Recommandations de semis (cœur du produit).
 *
 * Répond à la question du cahier des charges : **quoi semer sur une durée
 * donnée**, à partir de l'état réel du sol et du sous-sol.
 *
 * Trois règles d'affichage en découlent :
 *  1. sans données suffisantes le serveur renvoie `INSUFFICIENT_DATA` et aucun
 *     classement — l'interface le dit au lieu de proposer autre chose ;
 *  2. chaque culture classée affiche ses sources et ses critères non évalués ;
 *  3. une recommandation calculée sur des plages provisoires est étiquetée
 *     « indicative », avec les raisons.
 *
 * La section « Compatibilité culturale » qui suit est l'évaluation
 * culture/parcelle (`SOIL-04`), distincte du classement de période : les deux
 * sont conservées parce qu'elles ne répondent pas à la même question.
 */

const STATUS_TONE = {
  ACTIVE: 'success',
  SUPERSEDED: 'neutral',
  REJECTED: 'error',
  COMPLETED: 'neutral',
  INSUFFICIENT_DATA: 'warning',
  PENDING: 'info',
} as const;

/** Période par défaut : 90 jours à partir d'aujourd'hui. */
function defaultPeriod() {
  const start = new Date();
  const end = new Date(start.getTime() + 90 * 86_400_000);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default function FarmerPlotRecommendations() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const plotId = id ?? '';
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const [period, setPeriod] = useState(defaultPeriod);
  const [created, setCreated] = useState<RecommendationCreated | null>(null);
  const [error, setError] = useState<unknown>(null);

  const history = useQuery({
    queryKey: queryKeys.recommendations.list(plotId, { limit: 20 }),
    queryFn: () => recommendationApi.list(plotId, { limit: 20 }).then((result) => result.data),
    enabled: isAuthenticated && Boolean(plotId),
    retry: false,
  });

  const suitability = useQuery({
    queryKey: queryKeys.soil.suitability(plotId),
    queryFn: () => soilApi.suitability(plotId).then((result) => result.data),
    enabled: isAuthenticated && Boolean(plotId),
    retry: false,
  });

  const compute = useMutation({
    mutationFn: () =>
      recommendationApi.create(plotId, {
        periodStart: new Date(period.start).toISOString(),
        periodEnd: new Date(period.end).toISOString(),
      }),
    onSuccess: (result) => {
      setError(null);
      setCreated(result.data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.list(plotId, { limit: 20 }) });
    },
    onError: (caught) => {
      setCreated(null);
      setError(caught);
    },
  });

  const decide = useMutation({
    mutationFn: ({ recId, decision }: { recId: string; decision: 'ACCEPTED' | 'REJECTED' }) =>
      recommendationApi.decide(recId, { decision }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.list(plotId, { limit: 20 }) });
    },
    onError: (caught) => setError(caught),
  });

  const items: CropRecommendation[] = history.data?.items ?? [];

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title={t('ui.recommandationsDeSemis')}
        description={t('ui.quoiSemerSurUnePeriodeDonnee')}
        icon="🌱"
      >
        <div style={{ marginBottom: 24 }}>
          <Link to={`/farmer/plots/${plotId}`} style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>{t('ui.retourALaParcelle')}</Link>
        </div>

        <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.recommandationsDeSemis')}</Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 16 }}>{t('ui.leClassementEstCalculeSurLa')}</Text>

        <Card tone="pale" style={{ marginBottom: 24 }}>
          <Text preset="caption">{t('ui.cesRecommandationsSontProduitesParUn')}</Text>
        </Card>

        {/* ── Calcul ─────────────────────────────────────────────── */}
        <Card tone="white" style={{ marginBottom: 24 }}>
          <Text preset="h3" style={{ marginBottom: 12 }}>{t('ui.calculerPourUnePeriode')}</Text>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
            <Input
              label={t('ui.debutDePeriode')}
              type="date"
              value={period.start}
              onChange={(event) => setPeriod((current) => ({ ...current, start: event.target.value }))}
            />
            <Input
              label={t('ui.finDePeriode')}
              type="date"
              value={period.end}
              onChange={(event) => setPeriod((current) => ({ ...current, end: event.target.value }))}
            />
          </div>
          {error ? <ErrorState error={error} /> : null}
          <Button
            label={t('ui.calculerLaRecommandation')}
            onClick={() => compute.mutate()}
            loading={compute.isPending}
            variant="primary"
          />
        </Card>

        {/* ── Résultat du dernier calcul ─────────────────────────── */}
        {created ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.base / 1000, ease: EASE.out }}
            style={{ marginBottom: 24 }}
          >
            <Card tone="white">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                <Text preset="h3">{t('ui.resultatDuCalcul')}</Text>
                <Chip label={created.recommendation.status} tone={STATUS_TONE[created.recommendation.status]} size="sm" />
              </div>

              {created.dataModeNotice ? (
                <Card tone="gold" style={{ marginBottom: 12 }}>
                  <Text preset="caption">{created.dataModeNotice}</Text>
                </Card>
              ) : null}

              {/*
                Méthode de calcul, statut indicatif et rappel sur la nature du
                score : tout est repris de la réponse de l'API. Le bloc
                « indicative » qui était ici a été déplacé dans le composant,
                pour que les raisons et le rappel voyagent ensemble.
              */}
              <MethodeDeCalcul data={created} />

              {created.recommendation.status === 'INSUFFICIENT_DATA' ? (
                <EmptyState
                  title={t('ui.donneesInsuffisantes')}
                  description={
                    created.recommendation.insufficiencyReason ??
                    t('ui.leMoteurNAPasAssez')
                  }
                />
              ) : (
                <>
                  <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 12 }}>{t('ui.cultureSExamineeSClasseeS', { candidates: created.counts.candidates, ranked: created.counts.ranked, eliminated: created.counts.eliminated, insufficientData: created.counts.insufficientData, readingsUsed: created.counts.readingsUsed })}</Text>
                  <RankedList recommendation={created.recommendation} />
                </>
              )}
            </Card>
          </motion.div>
        ) : null}

        {/* ── Historique ─────────────────────────────────────────── */}
        <Text preset="h3" style={{ marginBottom: 12 }}>{t('ui.historique')}</Text>
        {history.isLoading ? <LoadingState count={2} /> : null}
        {history.isError ? <ErrorState error={history.error} /> : null}
        {history.data && items.length === 0 ? (
          <EmptyState
            title={t('ui.aucuneRecommandation')}
            description={t('ui.aucunClassementNAEncoreEte')}
          />
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
          {items.map((recommendation, index) => (
            <motion.div
              key={recommendation.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 6) * 0.05, ease: EASE.out }}
            >
              <Card tone="white">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
                  <div>
                    <Text preset="h4" style={{ marginBottom: 4 }}>
                      {formatDate(recommendation.periodStart, locale)} → {formatDate(recommendation.periodEnd, locale)}
                    </Text>
                    <Text preset="caption" color={COLORS.slateGray}>{t('ui.jourSModeCreeeLe', { requestedDays: recommendation.requestedDays, mode: recommendation.mode, createdAt: formatDate(recommendation.createdAt, locale) })}</Text>
                  </div>
                  <Chip label={recommendation.status} tone={STATUS_TONE[recommendation.status]} size="sm" />
                </div>

                {recommendation.status === 'PENDING' ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <Button
                      label={t('ui.accepter')}
                      size="sm"
                      variant="primary"
                      loading={decide.isPending}
                      onClick={() => decide.mutate({ recId: recommendation.id, decision: 'ACCEPTED' })}
                    />
                    <Button
                      label={t('ui.refuser')}
                      size="sm"
                      variant="outline"
                      loading={decide.isPending}
                      onClick={() => decide.mutate({ recId: recommendation.id, decision: 'REJECTED' })}
                    />
                  </div>
                ) : null}

                {recommendation.status === 'INSUFFICIENT_DATA' ? (
                  <Text preset="caption" color={COLORS.warning}>
                    {recommendation.insufficiencyReason ?? t('ui.donneesInsuffisantesPourClasserUneCulture')}
                  </Text>
                ) : (
                  <RankedList recommendation={recommendation} />
                )}
              </Card>
            </motion.div>
          ))}
        </div>

        {/* ── Compatibilité culturale (SOIL-04) ──────────────────── */}
        <Text preset="h3" style={{ marginBottom: 8 }}>{t('ui.compatibiliteCulturale')}</Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 16 }}>{t('ui.evaluationCultureParcelleParUnJeu')}</Text>

        {suitability.isLoading ? <LoadingState count={1} /> : null}
        {suitability.isError ? <ErrorState error={suitability.error} /> : null}
        {suitability.data && (suitability.data as SuitabilityList).items.length === 0 ? (
          <EmptyState
            title={t('ui.aucuneEvaluation')}
            description={t('ui.aucuneCompatibiliteNAEteCalculee')}
          />
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(suitability.data?.items ?? []).map((suitability) => (
            <Card key={suitability.id} tone="white">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                <div>
                  <Text preset="h4" style={{ marginBottom: 4 }}>
                    {suitability.cropId}
                  </Text>
                  <Text preset="caption">{t('ui.reglesConfiance', { ruleSetVersion: suitability.ruleSetVersion, confidence: suitability.confidence })}</Text>
                </div>
                <Chip
                  label={suitability.levelLabel}
                  tone={suitability.level === 'HIGH' ? 'success' : suitability.level === 'LOW' ? 'error' : 'warning'}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {suitability.reasons.map((reason) => (
                  <div
                    key={reason.label}
                    style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto', gap: 12, alignItems: 'baseline' }}
                  >
                    <Text preset="caption">{reason.label}</Text>
                    <Text preset="caption">{t('ui.attenduObserve', { expected: reason.expected, value: reason.observed ?? 'absent' })}</Text>
                    <Chip
                      label={reason.met === null ? t('ui.nonEvalue') : reason.met ? 'ok' : t('ui.ecart')}
                      tone={reason.met === null ? 'neutral' : reason.met ? 'success' : 'warning'}
                      size="sm"
                    />
                  </div>
                ))}
              </div>

              {suitability.missingData.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <Text preset="caption" style={{ marginBottom: 8 }}>{t('ui.donneesManquantes')}</Text>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {suitability.missingData.map((missing) => (
                      <Chip key={missing.key} label={`${missing.key} (${missing.expected})`} tone="neutral" size="sm" />
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      </AuthGate>
    </Section>
  );
}

/** Classement d'une recommandation : score, couverture, sources, critères non évalués. */
function RankedList({ recommendation }: { recommendation: CropRecommendation }) {
  const { t } = useI18n();
  if (recommendation.scores.length === 0) {
    return <Text preset="caption" color={COLORS.slateGray}>{t('ui.aucuneCultureClassee')}</Text>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {recommendation.scores.map((entry, index) => (
        <div
          key={entry.cropSlug}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            paddingTop: index === 0 ? 0 : 12,
            borderTop: index === 0 ? 'none' : `1px solid ${COLORS.lightBorder}`,
          }}
        >
          <div style={{ minWidth: 200 }}>
            <Text preset="bodyMd" style={{ marginBottom: 4 }}>
              {index + 1}. {entry.label}
            </Text>
            {/*
              Couverture **et** nombre de critères évalués.
              *
              Avec la règle du facteur le plus limitant, un paramètre non mesuré
              est ignoré : sans le nombre de critères, une couverture de 100 %
              calculée sur un seul paramètre (le pH seul renseigné) se lit comme
              une évaluation complète.
            */}
            <LigneMethodeCulture
              coverage={entry.coverage}
              evaluatedCount={entry.evaluatedCount}
              tooFewCriteria={entry.tooFewCriteria}
            />
            <Text preset="caption" color={COLORS.slateGray}>
              {entry.cycleDays ? t('ui.cycleJ', { cycleDays: entry.cycleDays }) : ''}
              {recommendation.sources.length > 0
                ? `${entry.cycleDays ? ' · ' : ''}sources : ${recommendation.sources.join(', ')}`
                : ''}
            </Text>
            {entry.notEvaluated.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                <Text preset="caption" color={COLORS.warning}>{t('ui.critereSNonEvalueS', { length: entry.notEvaluated.length })}</Text>
                {entry.notEvaluated.map((criteres) => (
                  /*
                   * `notEvaluated` contient des **objets** `{ key, label,
                   * reason, cause }`. L'ancien code faisait
                   * `notEvaluated.join(', ')` : le type déclarait `string[]`,
                   * donc ça compilait — et affichait `[object Object]`.
                   * La clé est `key`, stable et unique par culture.
                   */
                  <Text key={criteres.key} preset="caption" color={COLORS.slateGray} style={{ paddingLeft: 10 }}>
                    {criteres.label} — {criteres.reason}
                  </Text>
                ))}
              </div>
            ) : null}
          </div>
          {/*
            Le score est une **adéquation**, pas un rendement ni une chance de
            réussite : l'étiquette le dit, pour qu'un 0,8 ne se lise pas comme
            « 80 % de chances ». La version est affichée avec, parce qu'un
            score sans sa règle de combinaison est ininterprétable.
          */}
          <div style={{ textAlign: 'right' }}>
            <Chip
              label={t('ui.adequation', { value: entry.score.toFixed(2) })}
              tone={index === 0 ? 'success' : 'neutral'}
              size="sm"
            />
            {/*
              Le libellé de la règle vient de l'API. L'ancien code comparait
              `entry.combinationRule` à deux constantes et n'affichait **rien**
              pour toute autre valeur : une règle nouvelle serait passée
              inaperçue au lieu d'être nommée.
            */}
            {recommendation.ruleSetVersion || entry.engineVersion ? (
              <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 4 }}>
                {t('ui.moteurV', { value: entry.engineVersion ?? recommendation.ruleSetVersion })}
                {entry.combinationRuleLabel ? ` · ${entry.combinationRuleLabel}` : ''}
              </Text>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
