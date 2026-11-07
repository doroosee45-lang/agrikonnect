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
import { plotApi, soilApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

const MONTHS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

const monthLabel = (month: number) => MONTHS[Math.min(11, Math.max(0, month - 1))] ?? `M${month}`;

/**
 * Plan agricole (SOIL-07).
 *
 * Le calendrier est construit à partir des fenêtres culturales du jeu de règles
 * validé, année par année. Sans calendrier documenté, le serveur refuse : aucun
 * plan n'est inventé.
 */
export default function PlotFarmingPlan() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const [rotationPlanId, setRotationPlanId] = useState<string | null>(null);
  const [horizon, setHorizon] = useState('3');
  const [error, setError] = useState<unknown>(null);

  const plot = useQuery({
    queryKey: queryKeys.plots.one(id),
    queryFn: () => plotApi.get(id).then((result) => result.data),
    enabled: Boolean(id),
  });
  const rotations = useQuery({
    queryKey: queryKeys.soil.rotation(id),
    queryFn: () => soilApi.rotationPlans(id).then((result) => result.data),
    enabled: Boolean(id),
  });
  const plans = useQuery({
    queryKey: queryKeys.soil.farmingPlans(id),
    queryFn: () => soilApi.farmingPlans(id).then((result) => result.data),
    enabled: Boolean(id),
  });

  const propose = useMutation({
    mutationFn: () =>
      soilApi.proposeFarmingPlan(id, {
        rotationPlanId: rotationPlanId ?? undefined,
        horizonYears: horizon.trim() ? Number(horizon) : undefined,
      }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.soil.farmingPlans(id) });
    },
    onError: (caught) => setError(caught),
  });

  const items = plans.data?.items ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <PlotScreenHeader title="Plan agricole" plotName={plot.data?.name} plotId={id} />

      <Section bare contentStyle={styles.section}>
        <Card tone="pale" style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.info} />
          <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
            Calendrier indicatif construit sur les fenêtres culturales documentées. Les dates réelles dépendent
            de la météo et des conditions de la parcelle.
          </Text>
        </Card>

        <Card tone="white" style={styles.card}>
          <Text preset="overline" color={COLORS.forestGreen}>
            Construire un plan
          </Text>

          <Text preset="caption" color={COLORS.textPrimary}>
            Adosser à une rotation <Text preset="caption" color={COLORS.slateGray}>(facultatif)</Text>
          </Text>
          {(rotations.data?.items ?? []).length === 0 ? (
            <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
              Aucune rotation proposée pour cette parcelle. Un plan peut être construit sans rotation, à partir du
              calendrier du jeu de règles.
            </Text>
          ) : (
            <ChipRow>
              {(rotations.data?.items ?? []).slice(0, 6).map((plan) => (
                <FilterChip
                  key={plan.id}
                  label={`${plan.horizonYears} an(s) · ${plan.status}`}
                  active={rotationPlanId === plan.id}
                  onPress={() => setRotationPlanId(plan.id === rotationPlanId ? null : plan.id)}
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
            label="Construire le plan"
            onPress={() => propose.mutate()}
            variant="primary"
            fullWidth
            loading={propose.isPending}
          />
        </Card>

        {plans.isLoading ? (
          <LoadingState count={2} height={140} />
        ) : plans.isError ? (
          <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Aucun plan agricole"
            description="Construisez un plan pour obtenir le calendrier des opérations, année par année."
            icon="calendar-outline"
          />
        ) : (
          <View style={styles.list}>
            {items.map((plan, index) => {
              const byYear = new Map<number, typeof plan.calendar.entries>();
              for (const entry of plan.calendar?.entries ?? []) {
                const bucket = byYear.get(entry.year) ?? [];
                bucket.push(entry);
                byYear.set(entry.year, bucket);
              }

              return (
                <Reveal key={plan.id} index={index} variant="up">
                  <Card tone="white" style={styles.card}>
                    <View style={styles.head}>
                      <View style={styles.headText}>
                        <Text preset="h3" color={COLORS.textPrimary}>
                          Plan sur {plan.horizonYears} an(s)
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          jeu de règles {plan.calendar?.ruleSetVersion ?? '—'} · créé le {formatDate(plan.createdAt, locale)}
                          {plan.rotationPlanId ? ' · adossé à une rotation' : ''}
                        </Text>
                      </View>
                      <Chip label={`${(plan.calendar?.entries ?? []).length} opérations`} tone="neutral" size="sm" />
                    </View>

                    {[...byYear.keys()]
                      .sort((a, b) => a - b)
                      .map((year) => (
                        <View key={`${plan.id}-year-${year}`} style={styles.yearBlock}>
                          <Text preset="caption" color={COLORS.forestGreen}>
                            Année {year}
                          </Text>
                          <View style={styles.entries}>
                            {(byYear.get(year) ?? []).map((entry, entryIndex) => (
                              <View key={`${plan.id}-${year}-${entryIndex}`} style={styles.entry}>
                                <View style={styles.entryWindow}>
                                  <Text preset="caption" color={COLORS.livingGreen}>
                                    {monthLabel(entry.window.startMonth)} → {monthLabel(entry.window.endMonth)}
                                  </Text>
                                </View>
                                <View style={styles.entryBody}>
                                  <Text preset="bodySm" color={COLORS.textPrimary}>
                                    {entry.activity}
                                    {entry.cropSlug ? ` · ${entry.cropSlug}` : ''}
                                  </Text>
                                  {entry.rationale ? (
                                    <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                                      {entry.rationale}
                                    </Text>
                                  ) : null}
                                </View>
                              </View>
                            ))}
                          </View>
                        </View>
                      ))}

                    {(plan.checkpoints?.items ?? []).length > 0 ? (
                      <View style={styles.block}>
                        <Text preset="caption" color={COLORS.textPrimary}>
                          Points de contrôle
                        </Text>
                        {(plan.checkpoints?.items ?? []).map((checkpoint, checkpointIndex) => (
                          <Text key={`${plan.id}-cp-${checkpointIndex}`} preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                            • année {checkpoint.year} · {checkpoint.activity} · {monthLabel(checkpoint.window.startMonth)} →{' '}
                            {monthLabel(checkpoint.window.endMonth)}
                            {checkpoint.metric ? ` · ${checkpoint.metric}` : ''}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </Card>
                </Reveal>
              );
            })}
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
  yearBlock: { gap: SPACING.sm },
  entries: { gap: SPACING.sm },
  entry: { flexDirection: 'row', gap: SPACING.md },
  entryWindow: { width: 92 },
  entryBody: { flex: 1, gap: 2 },
  block: { gap: 4 },
  list: { gap: SPACING.md },
});
