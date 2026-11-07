import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
  Screen,
  Section,
  Text,
  TextArea,
} from '@/components/ui';
import { plotApi, referenceApi, seasonApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import type { SeasonFeedback } from '@/services/api/types';

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Rappel affiché à côté de tout rapprochement.
 *
 * Le backend renvoie le même texte dans `scoreNote`. Il est répété ici pour que
 * l'écran reste honnête même si la réponse ne le porte pas.
 */
const SCORE_NOTE =
  'Le score d’une recommandation mesure l’adéquation d’un sol à une culture, pas un '
  + 'rendement attendu. Un rendement faible sur une culture bien classée peut venir du '
  + 'climat, des ravageurs ou de la récolte, qui ne sont pas mesurés ici.';

const formatKg = (value: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);

const emptyForm = () => ({
  plotId: '',
  cropId: '',
  season: '',
  year: String(CURRENT_YEAR),
  periodStart: '',
  periodEnd: '',
  actualYieldKg: '',
  areaHa: '',
  observations: '',
});

/**
 * Saisie du rendement réellement obtenu.
 *
 * C'est la seule entrée de vérité « ce qui s'est passé ». Sans elle, aucune
 * comparaison entre le moteur de règles et un modèle appris n'est possible.
 *
 * Deux règles d'affichage en découlent :
 *
 * - **rien n'est estimé ici.** Aucun rendement par hectare pré-rempli, aucune
 *   valeur par défaut : ce que l'agriculteur ne saisit pas reste absent ;
 * - **le rendement par hectare est montré comme un calcul**, pas comme une
 *   donnée saisie, et il disparaît quand la surface est inconnue.
 */
export default function SeasonFeedbackScreen() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [form, setForm] = useState(emptyForm);
  const [saved, setSaved] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.seasons.all });

  const plots = useQuery({
    queryKey: queryKeys.plots.list({ limit: 50 }),
    queryFn: () => plotApi.list({ limit: 50 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  const crops = useQuery({
    queryKey: queryKeys.crops.list({}),
    queryFn: () => referenceApi.crops().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const feedbacks = useQuery({
    queryKey: queryKeys.seasons.list({}),
    queryFn: () => seasonApi.list({ limit: 50 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  const comparison = useQuery({
    queryKey: queryKeys.seasons.compare(compareId ?? ''),
    queryFn: () => seasonApi.compare(compareId as string).then((result) => result.data),
    enabled: isAuthenticated && Boolean(compareId),
  });

  const create = useMutation({
    mutationFn: () =>
      seasonApi.create({
        plotId: form.plotId,
        cropId: form.cropId,
        season: form.season,
        year: Number(form.year),
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        actualYieldKg: Number(form.actualYieldKg),
        // Une surface absente reste absente : envoyer 0 ferait croire à une
        // parcelle de superficie nulle.
        ...(form.areaHa ? { areaHa: Number(form.areaHa) } : {}),
        ...(form.observations ? { observations: form.observations } : {}),
      }),
    onSuccess: (response) => {
      setSaved(
        `Rendement enregistré : ${formatKg(response.data.seasonFeedback.actualYieldKg)} kg. `
        + 'Merci — c’est cette donnée qui permet d’améliorer les recommandations.',
      );
      setForm(emptyForm);
      invalidate();
    },
  });

  const items = feedbacks.data ?? [];
  const set = (key: keyof ReturnType<typeof emptyForm>) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  /** Rendement par hectare montré en direct, comme un calcul et non une saisie. */
  const previewPerHa =
    form.actualYieldKg && form.areaHa && Number(form.areaHa) > 0
      ? Math.round((Number(form.actualYieldKg) / Number(form.areaHa)) * 100) / 100
      : null;

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader
        title="Rendements réels"
        subtitle="Déclarez ce que vous avez réellement récolté."
      />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          title="Connexion requise"
          description="Connectez-vous pour déclarer vos rendements."
          isAuthenticated={isAuthenticated}
          icon="leaf-outline"
        >
          {/* ── Formulaire ───────────────────────────────────── */}
          <Card tone="white" style={styles.card}>
            <Text preset="bodyMedium" color={COLORS.textPrimary}>
              Déclarer un rendement
            </Text>
            <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
              Toutes les valeurs sont déclaratives. Rien n'est estimé à votre place : un champ
              laissé vide reste vide.
            </Text>

            <Text preset="caption" color={COLORS.forestGreen}>
              Parcelle
            </Text>
            <ChipRow>
              {(plots.data ?? []).map((plot) => (
                <FilterChip
                  key={plot.id}
                  label={plot.name}
                  active={form.plotId === plot.id}
                  onPress={() => set('plotId')(plot.id)}
                />
              ))}
            </ChipRow>

            <Text preset="caption" color={COLORS.forestGreen}>
              Culture
            </Text>
            <ChipRow>
              {(crops.data ?? []).map((crop) => (
                <FilterChip
                  key={crop.id}
                  label={crop.slug ?? crop.id}
                  active={form.cropId === (crop.slug ?? crop.id)}
                  onPress={() => set('cropId')(crop.slug ?? crop.id)}
                />
              ))}
            </ChipRow>

            <Input
              label="Saison"
              value={form.season}
              onChangeText={set('season')}
              placeholder="Saison A"
            />
            <Input
              label="Année"
              value={form.year}
              onChangeText={set('year')}
              keyboardType="number-pad"
            />
            <Input
              label="Début de période"
              value={form.periodStart}
              onChangeText={set('periodStart')}
              placeholder="2026-03-01"
              icon="calendar-outline"
            />
            <Input
              label="Fin de période"
              value={form.periodEnd}
              onChangeText={set('periodEnd')}
              placeholder="2026-06-30"
              icon="calendar-outline"
            />
            <Input
              label="Rendement total récolté (kg)"
              value={form.actualYieldKg}
              onChangeText={set('actualYieldKg')}
              keyboardType="numeric"
              placeholder="4200"
              helper="Le total de la récolte, pas un rendement à l'hectare."
            />
            <Input
              label="Surface récoltée (ha)"
              value={form.areaHa}
              onChangeText={set('areaHa')}
              keyboardType="numeric"
              placeholder="1.5"
              optionalLabel="facultatif"
              helper="Sans surface, aucun rendement à l'hectare ne sera calculé."
            />
            <TextArea
              label="Observations"
              value={form.observations}
              onChangeText={set('observations')}
              optionalLabel="facultatif"
              minHeight={80}
            />

            {/*
              Le rendement à l'hectare est montré comme un **calcul en direct**,
              jamais comme une valeur à saisir. S'il est absent, on l'écrit :
              un champ vide ne veut pas dire « zéro ».
            */}
            <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
              {previewPerHa !== null
                ? `Soit ${previewPerHa.toLocaleString('fr-FR')} kg/ha (calculé à partir de vos deux valeurs).`
                : 'Rendement par hectare : non calculé — la surface n’est pas renseignée.'}
            </Text>

            <Button
              label="Enregistrer le rendement"
              onPress={() => create.mutate()}
              variant="primary"
              fullWidth
              loading={create.isPending}
              disabled={!form.plotId || !form.cropId || !form.season || !form.actualYieldKg}
            />

            {create.isError ? <ErrorState error={create.error} showRequestId /> : null}
            {saved ? (
              <Text preset="caption" color={COLORS.success} style={styles.lineHeight}>
                {saved}
              </Text>
            ) : null}
          </Card>

          {/* ── Rendements déclarés ──────────────────────────── */}
          <Card tone="white" style={styles.card}>
            <Text preset="bodyMedium" color={COLORS.textPrimary}>
              Rendements déclarés
            </Text>

            {feedbacks.isLoading ? (
              <LoadingState count={3} height={80} />
            ) : feedbacks.isError ? (
              <ErrorState error={feedbacks.error} onRetry={() => void feedbacks.refetch()} />
            ) : items.length === 0 ? (
              <EmptyState
                title="Aucun rendement déclaré"
                description="Les rendements apparaîtront ici après votre première récolte."
              />
            ) : (
              items.map((item: SeasonFeedback) => (
                <View key={item.id} style={styles.row}>
                  <Text preset="caption" color={COLORS.textPrimary}>
                    {item.plot?.name ?? 'Parcelle'} — {item.crop?.slug ?? item.cropId}
                  </Text>
                  <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                    {item.season} {item.year} · {formatKg(item.actualYieldKg)} kg
                    {item.areaHa ? ` sur ${item.areaHa} ha` : ''}
                    {item.yieldPerHa !== null
                      ? ` · ${item.yieldPerHa.toLocaleString('fr-FR')} kg/ha`
                      : ' · surface inconnue'}
                  </Text>
                  <View style={styles.rowActions}>
                    <Chip
                      label={item.source === 'declared' ? 'Déclaré' : item.source}
                      tone="neutral"
                      size="sm"
                    />
                    {item.version > 1 ? <Chip label={`v${item.version}`} tone="info" size="sm" /> : null}
                    <Button
                      label={compareId === item.id ? 'Masquer' : 'Comparer'}
                      onPress={() => setCompareId(compareId === item.id ? null : item.id)}
                      variant="ghost"
                      size="sm"
                    />
                  </View>
                </View>
              ))
            )}
          </Card>

          {/* ── Rapprochement, sans verdict ──────────────────── */}
          {compareId ? (
            <Card tone="pale" style={styles.card}>
              {comparison.isLoading ? (
                <LoadingState count={1} height={80} />
              ) : comparison.isError ? (
                <ErrorState error={comparison.error} />
              ) : (
                <>
                  <Text preset="bodyMedium" color={COLORS.textPrimary}>
                    Comparaison avec la recommandation
                  </Text>

                  {comparison.data?.comparable && comparison.data.recommendation ? (
                    <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
                      {comparison.data.recommendation.cultureRank
                        ? `Cette culture était classée ${comparison.data.recommendation.cultureRank.rank}ᵉ `
                          + `sur ${comparison.data.recommendation.culturesClassified} avec un score de `
                          + `${comparison.data.recommendation.cultureRank.score ?? '—'}.`
                        : 'Cette culture ne figurait pas dans le classement de la recommandation.'}
                    </Text>
                  ) : (
                    <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                      {comparison.data?.reason ?? 'Rapprochement indisponible.'}
                    </Text>
                  )}

                  {/*
                    Le rappel est affiché **quoi qu'il arrive** : c'est lui qui
                    empêche de lire cette comparaison comme une validation ou un
                    désaveu de la recommandation.
                  */}
                  <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                    {comparison.data?.scoreNote ?? SCORE_NOTE}
                  </Text>
                </>
              )}
            </Card>
          ) : null}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  card: { gap: SPACING.sm },
  lineHeight: { lineHeight: 18 },
  row: { gap: 4, paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.lightBorder },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
});
