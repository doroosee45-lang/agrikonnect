import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

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
  ProvenanceTag,
  Reveal,
  TextArea,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate, formatNumber } from '@/lib/format';
import { DURATION } from '@/theme/motion';
import { soilApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

/** Clés autorisées par POST /plots/:id/soil-assessments (SOIL-01). */
const PARAMETER_KEYS = [
  { key: 'ph', label: 'pH', unit: '' },
  { key: 'organicMatter', label: 'Matière organique', unit: '%' },
  { key: 'texture', label: 'Texture', unit: '' },
  { key: 'n', label: 'Azote (N)', unit: 'mg/kg' },
  { key: 'p', label: 'Phosphore (P)', unit: 'mg/kg' },
  { key: 'k', label: 'Potassium (K)', unit: 'mg/kg' },
  { key: 'ec', label: 'Conductivité', unit: 'dS/m' },
  { key: 'moisture', label: 'Humidité', unit: '%' },
  { key: 'erosionRisk', label: 'Risque d’érosion', unit: '' },
  { key: 'sand', label: 'Sable', unit: '%' },
  { key: 'silt', label: 'Limon', unit: '%' },
  { key: 'clay', label: 'Argile', unit: '%' },
  { key: 'depthCm', label: 'Profondeur', unit: 'cm' },
] as const;

const SOURCES = [
  { key: 'declared', label: 'Déclaré' },
  { key: 'estimated', label: 'Estimé' },
  { key: 'measured_lab', label: 'Laboratoire' },
  { key: 'measured_sensor', label: 'Capteur' },
  { key: 'third_party_verified', label: 'Vérifié par un tiers' },
] as const;

type DraftParameter = {
  key: string;
  value: string;
  numericValue: string;
  unit: string;
  source: string;
  confidence: 'low' | 'medium' | 'high';
};

const emptyParameter = (): DraftParameter => ({
  key: 'ph',
  value: '',
  numericValue: '',
  unit: '',
  source: 'declared',
  confidence: 'low',
});

/**
 * Module sol d'une parcelle (SOIL-01 → SOIL-13) : profil fusionné, paramètres
 * manquants, historique des analyses et saisie d'une nouvelle analyse.
 * Aucune recommandation n'est produite en V1.
 */
export function SoilModule({ plotId }: { plotId: string }) {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [assessedAt, setAssessedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [parameters, setParameters] = useState<DraftParameter[]>([emptyParameter()]);
  const [error, setError] = useState<unknown>(null);

  const profile = useQuery({
    queryKey: queryKeys.soil.profile(plotId),
    queryFn: () => soilApi.profile(plotId).then((result) => result.data),
    enabled: Boolean(plotId),
  });
  const assessments = useQuery({
    queryKey: queryKeys.soil.assessments(plotId),
    queryFn: () => soilApi.assessments(plotId).then((result) => result.data),
    enabled: Boolean(plotId),
  });

  const create = useMutation({
    mutationFn: () => {
      const rows = parameters
        .filter((row) => row.value.trim().length > 0)
        .map((row) => ({
          key: row.key,
          value: row.value.trim(),
          numericValue: row.numericValue.trim() ? Number(row.numericValue.replace(',', '.')) : undefined,
          unit: row.unit.trim() || undefined,
          source: row.source,
          confidence: row.confidence,
        }));
      if (rows.length === 0) throw new Error('Ajoutez au moins un paramètre avec une valeur.');
      if (!assessedAt.trim()) throw new Error('Indiquez la date de l’analyse.');

      return soilApi.createAssessment(plotId, {
        assessedAt: assessedAt.trim(),
        notes: notes.trim() || undefined,
        parameters: rows,
      });
    },
    onSuccess: () => {
      setCreating(false);
      setError(null);
      setNotes('');
      setAssessedAt('');
      setParameters([emptyParameter()]);
      void queryClient.invalidateQueries({ queryKey: queryKeys.soil.profile(plotId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.soil.assessments(plotId) });
    },
    onError: (caught) => setError(caught),
  });

  const fused = useMemo(() => Object.entries(profile.data?.fusedProfile ?? {}), [profile.data]);

  const updateRow = (index: number, patch: Partial<DraftParameter>) => {
    setParameters((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <View style={styles.wrapper}>
      <Card tone="pale" style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={16} color={COLORS.info} />
        <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
          {profile.data?.disclaimer ??
            'Évaluation indicative : aucune recommandation de culture n’est produite en V1. Une analyse en laboratoire est recommandée avant toute décision importante.'}
        </Text>
      </Card>

      <View style={styles.toolbar}>
        <Button
          label={creating ? 'Fermer' : 'Ajouter une analyse'}
          onPress={() => setCreating((value) => !value)}
          variant={creating ? 'ghost' : 'primary'}
          size="sm"
          icon={creating ? 'close' : 'flask-outline'}
        />
      </View>

      {creating ? (
        <Animated.View entering={FadeInDown.duration(DURATION.slow)} exiting={FadeOutUp.duration(DURATION.fast)}>
          <Card tone="white" style={styles.form}>
            <Input label="Date de l’analyse" value={assessedAt} onChangeText={setAssessedAt} placeholder="2026-04-12" icon="calendar-outline" />
            <TextArea label="Notes" value={notes} onChangeText={setNotes} placeholder="Contexte, protocole, laboratoire…" minHeight={84} optionalLabel="facultatif" />

            {parameters.map((row, index) => (
              <View key={`row-${index}`} style={styles.paramRow}>
                <View style={styles.paramHead}>
                  <Text preset="caption" color={COLORS.forestGreen}>
                    Paramètre {index + 1}
                  </Text>
                  {parameters.length > 1 ? (
                    <Button
                      label="Retirer"
                      onPress={() => setParameters((rows) => rows.filter((_, i) => i !== index))}
                      variant="ghost"
                      size="sm"
                      icon="trash-outline"
                    />
                  ) : null}
                </View>

                <ChipRow>
                  {PARAMETER_KEYS.map((item) => (
                    <FilterChip
                      key={item.key}
                      label={item.label}
                      active={row.key === item.key}
                      onPress={() => updateRow(index, { key: item.key, unit: item.unit || row.unit })}
                    />
                  ))}
                </ChipRow>

                <View style={styles.row}>
                  <Input label="Valeur" value={row.value} onChangeText={(v) => updateRow(index, { value: v })} placeholder="6,4" icon="thermometer-outline" />
                  <Input
                    label="Valeur numérique"
                    value={row.numericValue}
                    onChangeText={(v) => updateRow(index, { numericValue: v })}
                    placeholder="6.4"
                    icon="calculator-outline"
                    keyboardType="decimal-pad"
                    optionalLabel="facultatif"
                  />
                </View>
                <Input label="Unité" value={row.unit} onChangeText={(v) => updateRow(index, { unit: v })} placeholder="mg/kg" icon="resize-outline" optionalLabel="facultatif" />

                <ChipRow>
                  {SOURCES.map((item) => (
                    <FilterChip key={item.key} label={item.label} active={row.source === item.key} onPress={() => updateRow(index, { source: item.key })} />
                  ))}
                </ChipRow>

                <ChipRow>
                  {(['low', 'medium', 'high'] as const).map((level) => (
                    <FilterChip
                      key={level}
                      label={level === 'low' ? 'Confiance faible' : level === 'medium' ? 'Confiance moyenne' : 'Confiance élevée'}
                      active={row.confidence === level}
                      onPress={() => updateRow(index, { confidence: level })}
                    />
                  ))}
                </ChipRow>
              </View>
            ))}

            <Button
              label="Ajouter un paramètre"
              onPress={() => setParameters((rows) => [...rows, emptyParameter()])}
              variant="outline"
              size="sm"
              icon="add"
              disabled={parameters.length >= 30}
            />

            {error ? <ErrorState error={error} showRequestId /> : null}

            <Button
              label="Enregistrer l’analyse"
              onPress={() => create.mutate()}
              variant="primary"
              fullWidth
              loading={create.isPending}
            />
          </Card>
        </Animated.View>
      ) : null}

      {profile.isLoading || assessments.isLoading ? (
        <LoadingState count={2} height={120} />
      ) : profile.isError || assessments.isError ? (
        <ErrorState error={profile.error ?? assessments.error} onRetry={() => void profile.refetch()} />
      ) : (
        <>
          <Card tone="white" style={styles.card}>
            <Text preset="overline" color={COLORS.forestGreen}>
              Profil fusionné
            </Text>
            {fused.length === 0 ? (
              <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                {assessments.data?.emptyMessage ?? 'Aucune donnée de sol enregistrée pour cette parcelle.'}
              </Text>
            ) : (
              <View style={styles.grid}>
                {fused.map(([key, parameter]) => (
                  <View key={key} style={styles.gridItem}>
                    <View style={styles.gridHead}>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {PARAMETER_KEYS.find((item) => item.key === key)?.label ?? key}
                      </Text>
                      <ProvenanceTag kind={parameter.source.startsWith('measured') ? 'measured' : 'declared'} />
                    </View>
                    <Text preset="bodyMedium" color={COLORS.textPrimary}>
                      {parameter.numericValue !== null
                        ? `${formatNumber(parameter.numericValue, locale, 2)}${parameter.unit ? ` ${parameter.unit}` : ''}`
                        : parameter.value}
                    </Text>
                    <Text preset="caption" color={COLORS.slateGray}>
                      {parameter.source} · {formatDate(parameter.measuredAt, locale)}
                    </Text>
                    {parameter.alternatives.length > 0 ? (
                      <Text preset="caption" color={COLORS.gold}>
                        {parameter.alternatives.length} autre(s) source(s) écartée(s)
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}

            {profile.data && profile.data.missingParameters.length > 0 ? (
              <View style={styles.missing}>
                <Text preset="caption" color={COLORS.slateGray}>
                  Paramètres attendus manquants :
                </Text>
                <ChipRow>
                  {profile.data.missingParameters.map((key) => (
                    <Chip key={key} label={PARAMETER_KEYS.find((item) => item.key === key)?.label ?? key} tone="warning" size="sm" />
                  ))}
                </ChipRow>
              </View>
            ) : null}

            {profile.data && profile.data.sourcesUsed.length > 0 ? (
              <Text preset="caption" color={COLORS.slateGray}>
                Sources utilisées : {profile.data.sourcesUsed.join(', ')} · priorité{' '}
                {profile.data.sourcePriority.map((item) => item.source).join(' → ')}
              </Text>
            ) : null}
          </Card>

          <Text preset="h3" color={COLORS.textPrimary}>
            Historique des analyses
          </Text>

          {(assessments.data?.items ?? []).length === 0 ? (
            <EmptyState
              title="Aucune analyse"
              description={
                assessments.data?.emptyMessage ??
                'Enregistrez une analyse de laboratoire pour fiabiliser les futurs diagnostics.'
              }
              icon="flask-outline"
              action={{ label: 'Ajouter une analyse', onPress: () => setCreating(true) }}
            />
          ) : (
            <View style={styles.list}>
              {(assessments.data?.items ?? []).map((assessment, index) => (
                <Reveal key={assessment.id} index={index} variant="up">
                  <Card tone="white" style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardIcon}>
                        <Ionicons name="flask-outline" size={15} color={COLORS.forestGreen} />
                      </View>
                      <View style={styles.cardTitle}>
                        <Text preset="bodyMedium" color={COLORS.textPrimary}>
                          Analyse du {formatDate(assessment.assessedAt, locale)}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          version {assessment.version} · {assessment.parameters.length} paramètre(s) · {assessment.source}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.grid}>
                      {assessment.parameters.map((parameter) => (
                        <View key={parameter.key} style={styles.gridItem}>
                          <View style={styles.gridHead}>
                            <Text preset="caption" color={COLORS.slateGray}>
                              {PARAMETER_KEYS.find((item) => item.key === parameter.key)?.label ?? parameter.key}
                            </Text>
                            <ProvenanceTag kind={parameter.flag === 'measured' ? 'measured' : 'declared'} />
                          </View>
                          <Text preset="bodySm" color={COLORS.textPrimary}>
                            {parameter.numericValue !== null && parameter.unit
                              ? `${formatNumber(parameter.numericValue, locale, 2)} ${parameter.unit}`
                              : parameter.value}
                          </Text>
                          <Text preset="caption" color={COLORS.slateGray}>
                            {parameter.sourceLabel} · confiance {parameter.confidence}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {assessment.notes ? (
                      <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                        {assessment.notes}
                      </Text>
                    ) : null}
                  </Card>
                </Reveal>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: SPACING.md },
  lineHeight: { lineHeight: 18 },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end' },
  disclaimer: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  form: { gap: SPACING.md },
  row: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
  paramRow: { gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.naturalWhite },
  paramHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { gap: SPACING.md },
  cardHeader: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center' },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    backgroundColor: TINTS.forestGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { flex: 1, gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  gridItem: { minWidth: 150, gap: 2 },
  gridHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  missing: { gap: SPACING.sm },
  list: { gap: SPACING.md },
});
