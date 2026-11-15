import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  ErrorState,
  FilterChip,
  Input,
  LoadingState,
  Reveal,
  Screen,
  Section,
  TextArea,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate, formatNumber } from '@/lib/format';
import { aiApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const STATUS_TONES: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = {
  PENDING: 'warning',
  COMPLETED: 'success',
  FAILED: 'error',
  ESCALATED: 'info',
};

/**
 * Assistant IA (AI-01 → AI-10).
 *
 * Consentement explicite avant chaque analyse, avertissement systématique,
 * escalade humaine possible et aucune décision automatique.
 */
export default function Ai() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [question, setQuestion] = useState('');
  const [consent, setConsent] = useState(false);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const analyses = useQuery({
    queryKey: queryKeys.ai.list({ filter, limit: 30 }),
    queryFn: () =>
      aiApi.list({ type: (filter || undefined) as 'CHAT' | 'PLANT_PHOTO' | 'DOCUMENT' | undefined, limit: 30 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  const ask = useMutation({
    mutationFn: () => aiApi.copilot({ question: question.trim() }),
    onSuccess: () => {
      setError(null);
      setNotice(t('ui.reponseGenereeElleResteIndicativeAucune'));
      setQuestion('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.ai.all });
    },
    onError: (caught) => {
      setNotice(null);
      setError(caught);
    },
  });

  const analyze = useMutation({
    mutationFn: () => aiApi.analyze({ type: 'CHAT', prompt: question.trim(), consentGiven: consent }),
    onSuccess: () => {
      setError(null);
      setNotice(t('ui.analyseEnregistree'));
      void queryClient.invalidateQueries({ queryKey: queryKeys.ai.all });
    },
    onError: (caught) => {
      setNotice(null);
      setError(caught);
    },
  });

  const escalate = useMutation({
    mutationFn: (id: string) => aiApi.escalate(id, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.ai.all }),
    onError: (caught) => setError(caught),
  });

  const items = analyses.data ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('ui.assistantAgronomique')} subtitle={t('ui.reponsesSourceesConsentementExpliciteEscaladeHum')} />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title={t('ui.connexionRequise_37a92')}
          description={t('ui.connectezVousPourInterrogerLAssistant')}
          icon="sparkles-outline"
        >
          <Card tone="pale" style={styles.warning}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.info} />
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>{t('ui.lAssistantProduitDesIndicationsPas')}</Text>
          </Card>

          <Card tone="white" style={styles.card}>
            <Text preset="overline" color={COLORS.forestGreen}>{t('ui.poserUneQuestion')}</Text>
            <TextArea
              label={t('ui.votreQuestion')}
              value={question}
              onChangeText={setQuestion}
              placeholder={t('ui.quelsSignesSurveillerSurDesFeuilles')}
              minHeight={90}
            />

            <View style={styles.consentRow}>
              <View style={styles.consentText}>
                <Text preset="caption" color={COLORS.textPrimary}>{t('ui.jAccepteQueMaQuestionEt')}</Text>
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.consentementEnregistreAvecChaqueAnalyseRevocable')}</Text>
              </View>
              <Switch
                value={consent}
                onValueChange={setConsent}
                trackColor={{ false: COLORS.lightBorder, true: COLORS.livingGreen }}
                thumbColor={COLORS.pureWhite}
                accessibilityLabel={t('ui.consentementAuTraitement')}
              />
            </View>

            {notice ? (
              <Text preset="caption" color={COLORS.success} style={styles.lineHeight}>
                {notice}
              </Text>
            ) : null}
            {error ? <ErrorState error={error} showRequestId /> : null}

            <View style={styles.actions}>
              <Button
                label={t('ui.interrogerLAssistant')}
                onPress={() => ask.mutate()}
                variant="primary"
                size="sm"
                icon="chatbubbles-outline"
                loading={ask.isPending}
                disabled={question.trim().length < 3}
              />
              <Button
                label={t('ui.analyseTracee')}
                onPress={() => analyze.mutate()}
                variant="outline"
                size="sm"
                icon="document-text-outline"
                loading={analyze.isPending}
                disabled={question.trim().length < 3 || !consent}
              />
            </View>
          </Card>

          <View style={styles.filters}>
            <ChipRow>
              {['', 'CHAT', 'PLANT_PHOTO', 'DOCUMENT'].map((type) => (
                <FilterChip key={type || 'all'} label={type || t('ui.toutes')} active={filter === type} onPress={() => setFilter(type)} />
              ))}
            </ChipRow>
          </View>

          {analyses.isLoading ? (
            <LoadingState count={2} height={120} />
          ) : analyses.isError ? (
            <ErrorState error={analyses.error} onRetry={() => void analyses.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title={t('ui.aucuneAnalyse')}
              description={t('ui.vosQuestionsEtAnalysesApparaitrontIci_075c0')}
              icon="sparkles-outline"
            />
          ) : (
            <View style={styles.list}>
              {items.map((item, index) => (
                <Reveal key={item.id} index={index} variant="up">
                  <Card tone="white" style={styles.card}>
                    <View style={styles.head}>
                      <View style={styles.headText}>
                        <Text preset="bodyMedium" color={COLORS.textPrimary} numberOfLines={2}>
                          {item.prompt ?? t('ui.analyse_211fa', { type: item.type })}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          {item.type} · {formatDate(item.createdAt, locale)}
                          {item.model ? ` · ${item.provider ?? ''} ${item.model}`.trim() : ''}
                          {item.tokensUsed !== null ? t('ui.jetons', { tokensUsed: formatNumber(item.tokensUsed, locale) }) : ''}
                        </Text>
                      </View>
                      <Chip label={item.status} tone={STATUS_TONES[item.status] ?? 'neutral'} size="sm" />
                    </View>

                    {item.output ? (
                      <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight} numberOfLines={6}>
                        {typeof item.output === 'string' ? item.output : JSON.stringify(item.output, null, 2).slice(0, 400)}
                      </Text>
                    ) : null}

                    {item.confidence !== null ? (
                      <Text preset="caption" color={COLORS.slateGray}>{t('ui.confianceIndiquee', { value: formatNumber(item.confidence * 100, locale, 0) })}</Text>
                    ) : null}

                    {item.disclaimer ? (
                      <Text preset="caption" color={COLORS.warning} style={styles.lineHeight}>
                        {item.disclaimer}
                      </Text>
                    ) : null}

                    {item.status === 'COMPLETED' ? (
                      <Button
                        label={item.escalatedAt ? t('ui.escaladeeAUnHumain') : t('ui.escaladerAUnAgronome')}
                        onPress={() => escalate.mutate(item.id)}
                        variant="ghost"
                        size="sm"
                        icon="person-outline"
                        disabled={Boolean(item.escalatedAt)}
                        loading={escalate.isPending && escalate.variables === item.id}
                      />
                    ) : null}
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
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  lineHeight: { lineHeight: 18 },
  warning: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  card: { gap: SPACING.md },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  consentText: { flex: 1, gap: 2 },
  filters: { gap: SPACING.sm },
  head: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  headText: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  list: { gap: SPACING.md },
});
