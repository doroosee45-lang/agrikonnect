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
        title="Recommandations de semis"
        description="Quoi semer sur une période donnée, à partir de l'état réel du sol et du sous-sol."
        icon="🌱"
      >
        <div style={{ marginBottom: 24 }}>
          <Link to={`/farmer/plots/${plotId}`} style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>
            ← Retour à la parcelle
          </Link>
        </div>

        <Text preset="h1" style={{ marginBottom: 8 }}>
          Recommandations de semis
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 16 }}>
          Le classement est calculé sur la période demandée, à partir des mesures réellement disponibles sur la
          parcelle. Chaque culture classée indique ses sources et les critères qu'il n'a pas pu évaluer.
        </Text>

        <Card tone="pale" style={{ marginBottom: 24 }}>
          <Text preset="caption">
            Ces recommandations sont produites par un moteur de règles, pas par un agronome. Une recommandation
            calculée sur des plages agronomiques provisoires est étiquetée « indicative ». Sans données suffisantes,
            aucune recommandation n'est produite : le moteur le dit plutôt que de deviner.
          </Text>
        </Card>

        {/* ── Calcul ─────────────────────────────────────────────── */}
        <Card tone="white" style={{ marginBottom: 24 }}>
          <Text preset="h3" style={{ marginBottom: 12 }}>
            Calculer pour une période
          </Text>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
            <Input
              label="Début de période"
              type="date"
              value={period.start}
              onChange={(event) => setPeriod((current) => ({ ...current, start: event.target.value }))}
            />
            <Input
              label="Fin de période"
              type="date"
              value={period.end}
              onChange={(event) => setPeriod((current) => ({ ...current, end: event.target.value }))}
            />
          </div>
          {error ? <ErrorState error={error} /> : null}
          <Button
            label="Calculer la recommandation"
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
                <Text preset="h3">Résultat du calcul</Text>
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
                  title="Données insuffisantes"
                  description={
                    created.recommendation.insufficiencyReason ??
                    "Le moteur n'a pas assez de mesures fiables sur cette parcelle pour classer une culture. Aucune recommandation n'est proposée."
                  }
                />
              ) : (
                <>
                  <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 12 }}>
                    {created.counts.candidates} culture(s) examinée(s) · {created.counts.ranked} classée(s) ·{' '}
                    {created.counts.eliminated} écartée(s) · {created.counts.insufficientData} sans données ·{' '}
                    {created.counts.readingsUsed} mesure(s) utilisée(s)
                  </Text>
                  <RankedList recommendation={created.recommendation} />
                </>
              )}
            </Card>
          </motion.div>
        ) : null}

        {/* ── Historique ─────────────────────────────────────────── */}
        <Text preset="h3" style={{ marginBottom: 12 }}>
          Historique
        </Text>
        {history.isLoading ? <LoadingState count={2} /> : null}
        {history.isError ? <ErrorState error={history.error} /> : null}
        {history.data && items.length === 0 ? (
          <EmptyState
            title="Aucune recommandation"
            description="Aucun classement n'a encore été calculé pour cette parcelle."
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
                    <Text preset="caption" color={COLORS.slateGray}>
                      {recommendation.requestedDays} jour(s) · mode {recommendation.mode} · créée le{' '}
                      {formatDate(recommendation.createdAt, locale)}
                    </Text>
                  </div>
                  <Chip label={recommendation.status} tone={STATUS_TONE[recommendation.status]} size="sm" />
                </div>

                {recommendation.status === 'PENDING' ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <Button
                      label="Accepter"
                      size="sm"
                      variant="primary"
                      loading={decide.isPending}
                      onClick={() => decide.mutate({ recId: recommendation.id, decision: 'ACCEPTED' })}
                    />
                    <Button
                      label="Refuser"
                      size="sm"
                      variant="outline"
                      loading={decide.isPending}
                      onClick={() => decide.mutate({ recId: recommendation.id, decision: 'REJECTED' })}
                    />
                  </div>
                ) : null}

                {recommendation.status === 'INSUFFICIENT_DATA' ? (
                  <Text preset="caption" color={COLORS.warning}>
                    {recommendation.insufficiencyReason ?? 'Données insuffisantes pour classer une culture.'}
                  </Text>
                ) : (
                  <RankedList recommendation={recommendation} />
                )}
              </Card>
            </motion.div>
          ))}
        </div>

        {/* ── Compatibilité culturale (SOIL-04) ──────────────────── */}
        <Text preset="h3" style={{ marginBottom: 8 }}>
          Compatibilité culturale
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 16 }}>
          Évaluation culture/parcelle par un jeu de règles versionné. Elle ne dépend d'aucune période : c'est une
          autre question que le classement ci-dessus.
        </Text>

        {suitability.isLoading ? <LoadingState count={1} /> : null}
        {suitability.isError ? <ErrorState error={suitability.error} /> : null}
        {suitability.data && (suitability.data as SuitabilityList).items.length === 0 ? (
          <EmptyState
            title="Aucune évaluation"
            description="Aucune compatibilité n'a été calculée pour cette parcelle."
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
                  <Text preset="caption">
                    règles {suitability.ruleSetVersion} · confiance {suitability.confidence}
                  </Text>
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
                    <Text preset="caption">
                      attendu : {reason.expected} · observé : {reason.observed ?? 'absent'}
                    </Text>
                    <Chip
                      label={reason.met === null ? 'non évalué' : reason.met ? 'ok' : 'écart'}
                      tone={reason.met === null ? 'neutral' : reason.met ? 'success' : 'warning'}
                      size="sm"
                    />
                  </div>
                ))}
              </div>

              {suitability.missingData.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <Text preset="caption" style={{ marginBottom: 8 }}>
                    Données manquantes :
                  </Text>
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
  if (recommendation.scores.length === 0) {
    return <Text preset="caption" color={COLORS.slateGray}>Aucune culture classée.</Text>;
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
              {entry.cycleDays ? `cycle ${entry.cycleDays} j` : ''}
              {recommendation.sources.length > 0
                ? `${entry.cycleDays ? ' · ' : ''}sources : ${recommendation.sources.join(', ')}`
                : ''}
            </Text>
            {entry.notEvaluated.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                <Text preset="caption" color={COLORS.warning}>
                  {entry.notEvaluated.length} critère(s) non évalué(s) :
                </Text>
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
              label={`adéquation ${entry.score.toFixed(2)}`}
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
                {`moteur v${entry.engineVersion ?? recommendation.ruleSetVersion}`}
                {entry.combinationRuleLabel ? ` · ${entry.combinationRuleLabel}` : ''}
              </Text>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
