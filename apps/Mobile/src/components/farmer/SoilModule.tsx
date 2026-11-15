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
import { useI18n, tr } from '@/i18n';
import { formatDate, formatNumber } from '@/lib/format';
import { DURATION } from '@/theme/motion';
import { soilApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

/** Clés autorisées par POST /plots/:id/soil-assessments (SOIL-01). */
const PARAMETER_KEYS = [
  { key: 'ph', label: 'pH', unit: '' },
  { key: 'organicMatter', get label() { return tr('ui.matiereOrganique'); }, unit: '%' },
  { key: 'texture', get label() { return tr('ui.texture'); }, unit: '' },
  { key: 'n', get label() { return tr('ui.azoteN'); }, unit: 'mg/kg' },
  { key: 'p', get label() { return tr('ui.phosphoreP'); }, unit: 'mg/kg' },
  { key: 'k', get label() { return tr('ui.potassiumK'); }, unit: 'mg/kg' },
  { key: 'ec', get label() { return tr('ui.conductivite'); }, unit: 'dS/m' },
  { key: 'moisture', get label() { return tr('ui.humidite'); }, unit: '%' },
  { key: 'erosionRisk', get label() { return tr('ui.risqueDErosion'); }, unit: '' },
  { key: 'sand', get label() { return tr('ui.sable'); }, unit: '%' },
  { key: 'silt', get label() { return tr('ui.limon'); }, unit: '%' },
  { key: 'clay', get label() { return tr('ui.argile'); }, unit: '%' },
  { key: 'depthCm', get label() { return tr('ui.profondeur'); }, unit: 'cm' },
] as const;

const SOURCES = [
  { key: 'declared', get label() { return tr('common.declared'); } },
  { key: 'estimated', get label() { return tr('ui.estime'); } },
  { key: 'measured_lab', get label() { return tr('ui.laboratoire'); } },
  { key: 'measured_sensor', get label() { return tr('ui.capteur'); } },
  { key: 'third_party_verified', get label() { return tr('ui.verifieParUnTiers'); } },
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
  const { t } = useI18n();
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
      if (rows.length === 0) throw new Error(t('ui.ajoutezAuMoinsUnParametreAvec'));
      if (!assessedAt.trim()) throw new Error(t('ui.indiquezLaDateDeLAnalyse'));

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
            t('ui.evaluationIndicativeAucuneRecommandationDeCultur')}
        </Text>
      </Card>

      <View style={styles.toolbar}>
        <Button
          label={creating ? t('common.close') : t('ui.ajouterUneAnalyse')}
          onPress={() => setCreating((value) => !value)}
          variant={creating ? 'ghost' : 'primary'}
          size="sm"
          icon={creating ? 'close' : 'flask-outline'}
        />
      </View>

      {creating ? (
        <Animated.View entering={FadeInDown.duration(DURATION.slow)} exiting={FadeOutUp.duration(DURATION.fast)}>
          <Card tone="white" style={styles.form}>
            <Input label={t('ui.dateDeLAnalyse')} value={assessedAt} onChangeText={setAssessedAt} placeholder="2026-04-12" icon="calendar-outline" />
            <TextArea label={t('ui.notes')} value={notes} onChangeText={setNotes} placeholder={t('ui.contexteProtocoleLaboratoire')} minHeight={84} optionalLabel={t('common.optional')} />

            {parameters.map((row, index) => (
              <View key={`row-${index}`} style={styles.paramRow}>
                <View style={styles.paramHead}>
                  <Text preset="caption" color={COLORS.forestGreen}>{t('ui.parametre_70aa1', { value: index + 1 })}</Text>
                  {parameters.length > 1 ? (
                    <Button
                      label={t('ui.retirer')}
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
                  <Input label={t('ui.valeur')} value={row.value} onChangeText={(v) => updateRow(index, { value: v })} placeholder="6,4" icon="thermometer-outline" />
                  <Input
                    label={t('ui.valeurNumerique')}
                    value={row.numericValue}
                    onChangeText={(v) => updateRow(index, { numericValue: v })}
                    placeholder="6.4"
                    icon="calculator-outline"
                    keyboardType="decimal-pad"
                    optionalLabel={t('common.optional')}
                  />
                </View>
                <Input label={t('ui.unite')} value={row.unit} onChangeText={(v) => updateRow(index, { unit: v })} placeholder="mg/kg" icon="resize-outline" optionalLabel={t('common.optional')} />

                <ChipRow>
                  {SOURCES.map((item) => (
                    <FilterChip key={item.key} label={item.label} active={row.source === item.key} onPress={() => updateRow(index, { source: item.key })} />
                  ))}
                </ChipRow>

                <ChipRow>
                  {(['low', 'medium', 'high'] as const).map((level) => (
                    <FilterChip
                      key={level}
                      label={level === 'low' ? t('ui.confianceFaible') : level === 'medium' ? t('ui.confianceMoyenne') : t('ui.confianceElevee')}
                      active={row.confidence === level}
                      onPress={() => updateRow(index, { confidence: level })}
                    />
                  ))}
                </ChipRow>
              </View>
            ))}

            <Button
              label={t('ui.ajouterUnParametre')}
              onPress={() => setParameters((rows) => [...rows, emptyParameter()])}
              variant="outline"
              size="sm"
              icon="add"
              disabled={parameters.length >= 30}
            />

            {error ? <ErrorState error={error} showRequestId /> : null}

            <Button
              label={t('ui.enregistrerLAnalyse')}
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
            <Text preset="overline" color={COLORS.forestGreen}>{t('ui.profilFusionne')}</Text>
            {fused.length === 0 ? (
              <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                {assessments.data?.emptyMessage ?? t('ui.aucuneDonneeDeSolEnregistreePour')}
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
                      <Text preset="caption" color={COLORS.gold}>{t('ui.autreSSourceSEcarteeS', { length: parameter.alternatives.length })}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}

            {profile.data && profile.data.missingParameters.length > 0 ? (
              <View style={styles.missing}>
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.parametresAttendusManquants')}</Text>
                <ChipRow>
                  {profile.data.missingParameters.map((key) => (
                    <Chip key={key} label={PARAMETER_KEYS.find((item) => item.key === key)?.label ?? key} tone="warning" size="sm" />
                  ))}
                </ChipRow>
              </View>
            ) : null}

            {profile.data && profile.data.sourcesUsed.length > 0 ? (
              <Text preset="caption" color={COLORS.slateGray}>{t('ui.sourcesUtiliseesPriorite', { value: profile.data.sourcesUsed.join(', '), value2: profile.data.sourcePriority.map((item) => item.source).join(' → ') })}</Text>
            ) : null}
          </Card>

          <Text preset="h3" color={COLORS.textPrimary}>{t('ui.historiqueDesAnalyses')}</Text>

          {(assessments.data?.items ?? []).length === 0 ? (
            <EmptyState
              title={t('ui.aucuneAnalyse')}
              description={
                assessments.data?.emptyMessage ??
                t('ui.enregistrezUneAnalyseDeLaboratoirePour')
              }
              icon="flask-outline"
              action={{ label: t('ui.ajouterUneAnalyse'), onPress: () => setCreating(true) }}
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
                        <Text preset="bodyMedium" color={COLORS.textPrimary}>{t('ui.analyseDu', { assessedAt: formatDate(assessment.assessedAt, locale) })}</Text>
                        <Text preset="caption" color={COLORS.slateGray}>{t('ui.versionParametreS', { version: assessment.version, length: assessment.parameters.length, source: assessment.source })}</Text>
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
                          <Text preset="caption" color={COLORS.slateGray}>{t('ui.confiance_cc395', { sourceLabel: parameter.sourceLabel, confidence: parameter.confidence })}</Text>
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
