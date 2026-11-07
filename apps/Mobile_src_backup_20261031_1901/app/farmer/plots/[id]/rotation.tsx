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
  Input,
  LoadingState,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { plotApi, referenceApi, soilApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

const STATUS_TONES: Record<string, 'neutral' | 'info' | 'success' | 'error'> = {
  PROPOSED: 'neutral',
  ACCEPTED: 'success',
  REJECTED: 'error',
};

/**
 * Rotation culturale (SOIL-06).
 *
 * Une rotation n'est proposée que si le jeu de règles validé en documente une
 * pour la culture demandée ; sinon le serveur répond 409 et rien n'est inventé.
 * La décision (acceptée / rejetée) est humaine et tracée.
 */
export default function PlotRotation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const [cropId, setCropId] = useState<string | null>(null);
  const [horizon, setHorizon] = useState('3');
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
  const plans = useQuery({
    queryKey: queryKeys.soil.rotation(id),
    queryFn: () => soilApi.rotationPlans(id).then((result) => result.data),
    enabled: Boolean(id),
  });

  const propose = useMutation({
    mutationFn: () =>
      soilApi.proposeRotation(id, {
        cropId: cropId ?? undefined,
        horizonYears: horizon.trim() ? Number(horizon) : undefined,
      }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.soil.rotation(id) });
    },
    onError: (caught) => setError(caught),
  });

  const decide = useMutation({
    mutationFn: ({ planId, decision }: { planId: string; decision: 'ACCEPTED' | 'REJECTED' }) =>
      soilApi.decideRotation(id, planId, { decision }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.soil.rotation(id) }),
  });

  const items = plans.data?.items ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <PlotScreenHeader title="Rotation" plotName={plot.data?.name} plotId={id} />

      <Section bare contentStyle={styles.section}>
        <Card tone="pale" style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.info} />
          <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
            Rotation issue de règles agronomiques validées et versionnées. Elle doit être confirmée par un
            agronome avant application : le statut reste « proposé » tant qu’aucune décision n’est enregistrée.
          </Text>
        </Card>

        <Card tone="white" style={styles.card}>
          <Text preset="overline" color={COLORS.forestGreen}>
            Proposer une rotation
          </Text>

          <Text preset="caption" color={COLORS.textPrimary}>
            Culture de départ <Text preset="caption" color={COLORS.slateGray}>(facultatif)</Text>
          </Text>
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
                  active={cropId === crop.id}
                  onPress={() => setCropId(crop.id === cropId ? null : crop.id)}
                />
              ))}
            </ChipRow>
          )}

          <Input
            label="Horizon (années)"
            value={horizon}
            onChangeText={setHorizon}
            placeholder="3"
            icon="calendar-outline"
            keyboardType="number-pad"
            optionalLabel="1 à 10"
          />

          {error ? <ErrorState error={error} showRequestId /> : null}

          <Button
            label="Proposer une rotation"
            onPress={() => propose.mutate()}
            variant="primary"
            fullWidth
            loading={propose.isPending}
          />
          <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
            Si aucune rotation n’est documentée pour cette culture dans le jeu de règles applicable, le serveur
            refuse la demande : aucune séquence n’est improvisée.
          </Text>
        </Card>

        {plans.isLoading ? (
          <LoadingState count={2} height={140} />
        ) : plans.isError ? (
          <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Aucune rotation proposée"
            description="Proposez une rotation pour obtenir une séquence sourcée, année par année."
            icon="repeat-outline"
          />
        ) : (
          <View style={styles.list}>
            {items.map((plan, index) => (
              <Reveal key={plan.id} index={index} variant="up">
                <Card tone="white" style={styles.card}>
                  <View style={styles.head}>
                    <View style={styles.headText}>
                      <Text preset="h3" color={COLORS.textPrimary}>
                        Rotation sur {plan.horizonYears} an(s)
                      </Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        jeu de règles {plan.ruleSetVersion} · zone {plan.steps?.zone ?? '—'} · proposée le{' '}
                        {formatDate(plan.createdAt, locale)}
                      </Text>
                    </View>
                    <Chip label={plan.status} tone={STATUS_TONES[plan.status] ?? 'neutral'} size="sm" />
                  </View>

                  <View style={styles.sequence}>
                    {(plan.steps?.sequence ?? []).map((step) => (
                      <View key={`${plan.id}-${step.year}`} style={styles.step}>
                        <View style={styles.stepYear}>
                          <Text preset="caption" color={COLORS.forestGreen}>
                            Année {step.year}
                          </Text>
                        </View>
                        <View style={styles.stepBody}>
                          <Text preset="bodyMedium" color={COLORS.textPrimary}>
                            {step.cropSlug}
                          </Text>
                          {step.family ? (
                            <Text preset="caption" color={COLORS.slateGray}>
                              famille : {step.family}
                            </Text>
                          ) : null}
                          {step.rationale ? (
                            <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                              {step.rationale}
                            </Text>
                          ) : null}
                          {step.checks.length > 0 ? (
                            <ChipRow>
                              {step.checks.map((check) => (
                                <Chip key={check} label={check} tone="neutral" size="sm" />
                              ))}
                            </ChipRow>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>

                  {(plan.steps?.assumptions ?? []).length > 0 ? (
                    <View style={styles.block}>
                      <Text preset="caption" color={COLORS.textPrimary}>
                        Hypothèses
                      </Text>
                      {(plan.steps?.assumptions ?? []).map((assumption) => (
                        <Text key={assumption} preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                          • {assumption}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  {(plan.alternatives?.options ?? []).length > 0 ? (
                    <Text preset="caption" color={COLORS.slateGray}>
                      Autres rotations documentées : {(plan.alternatives?.options ?? []).join(', ')}
                    </Text>
                  ) : null}

                  {plan.status === 'PROPOSED' ? (
                    <View style={styles.actions}>
                      <Button
                        label="Accepter"
                        onPress={() => decide.mutate({ planId: plan.id, decision: 'ACCEPTED' })}
                        variant="primary"
                        size="sm"
                        icon="checkmark-outline"
                        loading={decide.isPending && decide.variables?.planId === plan.id}
                      />
                      <Button
                        label="Rejeter"
                        onPress={() => decide.mutate({ planId: plan.id, decision: 'REJECTED' })}
                        variant="outline"
                        size="sm"
                        icon="close-outline"
                        loading={decide.isPending && decide.variables?.planId === plan.id}
                      />
                    </View>
                  ) : null}

                  <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                    {plan.disclaimer}
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
  sequence: { gap: SPACING.md },
  step: { flexDirection: 'row', gap: SPACING.md },
  stepYear: { width: 68 },
  stepBody: { flex: 1, gap: 4 },
  block: { gap: 4 },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  list: { gap: SPACING.md },
});
