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
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { agronomicRangeApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import type {
  AgronomicRangeImportResult,
  CropAgronomicRange,
  RangeParameterKey,
  RangeSourceType,
  RangeStatus,
} from '@/services/api/types';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * ADMIN / AGRONOME — gouvernance du référentiel agronomique.
 *
 * Une plage VALIDATED fait sortir les recommandations du régime « indicatif » :
 * la validation exige un validateur nommé et une source citable. Sans plage en
 * base, le moteur considère le critère comme **non évalué** — il n'invente
 * jamais de fourchette, d'où l'état vide « données insuffisantes ».
 */

const PARAMETER_LABELS: Record<RangeParameterKey, string> = {
  ph: 'pH du sol',
  airTemperatureC: "Température de l'AIR",
  moisture: 'Humidité du sol',
  ec: 'Salinité (CE)',
  depthCm: 'Profondeur racinaire',
};

const PARAMETER_UNITS: Record<RangeParameterKey, string> = {
  ph: 'pH',
  airTemperatureC: '°C',
  moisture: '%',
  ec: 'dS/m',
  depthCm: 'cm',
};

const PARAMETER_KEYS = Object.keys(PARAMETER_LABELS) as RangeParameterKey[];

/** Libellés du menu « Type de source », identiques à ceux du tableau. */
const SOURCE_TYPE_LABELS: Record<RangeSourceType, string> = {
  AGRONOMIST: 'Agronome',
  PUBLICATION: 'Publication',
  PILOT: 'Pilote',
};
const STATUS_FILTERS: Array<{ value: RangeStatus | ''; label: string }> = [
  { value: '', label: 'Tous' },
  { value: 'PROVISIONAL', label: 'Provisoires' },
  { value: 'VALIDATED', label: 'Validées' },
  { value: 'RETIRED', label: 'Retirées' },
];

export default function AdminAgronomicRanges() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const [status, setStatus] = useState<RangeStatus | ''>('');
  const [cropSlug, setCropSlug] = useState('');
  const [parameterKey, setParameterKey] = useState<RangeParameterKey>('ph');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [toleratedMin, setToleratedMin] = useState('');
  const [toleratedMax, setToleratedMax] = useState('');
  const [zone, setZone] = useState('');
  const [sourceReference, setSourceReference] = useState('');
  const [sourceNote, setSourceNote] = useState('');
  const [datasetLabel, setDatasetLabel] = useState('production');
  const [validating, setValidating] = useState<CropAgronomicRange | null>(null);
  const [validatedBy, setValidatedBy] = useState('');
  const [csv, setCsv] = useState('');
  const [importResult, setImportResult] = useState<AgronomicRangeImportResult | null>(null);
  const [error, setError] = useState<unknown>(null);

  const ranges = useQuery({
    queryKey: queryKeys.agronomicRanges.list({ status, cropSlug }),
    queryFn: () =>
      agronomicRangeApi
        .list({ status: status || undefined, cropSlug: cropSlug.trim() || undefined })
        .then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const template = useQuery({
    queryKey: queryKeys.agronomicRanges.template,
    queryFn: () => agronomicRangeApi.importTemplate().then((result) => result.data),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.agronomicRanges.all });
  };

  const create = useMutation({
    mutationFn: () =>
      agronomicRangeApi.create({
        cropSlug: cropSlug.trim(),
        parameterKey,
        minValue: Number(minValue),
        maxValue: Number(maxValue),
        // Une borne tolérée laissée vide part telle quelle : `null`, jamais une
        // valeur complétée. Un champ vide n'est pas un zéro.
        toleratedMin: toleratedMin.trim() === '' ? null : Number(toleratedMin),
        toleratedMax: toleratedMax.trim() === '' ? null : Number(toleratedMax),
        zone: zone.trim() || null,
        unit: PARAMETER_UNITS[parameterKey],
        sourceReference: sourceReference.trim() || undefined,
        sourceNote: sourceNote.trim() || undefined,
        datasetLabel: datasetLabel.trim() || 'production',
      }),
    onSuccess: () => {
      setError(null);
      setCropSlug('');
      setMinValue('');
      setMaxValue('');
      setSourceReference('');
      setSourceNote('');
      invalidate();
    },
    onError: (caught) => setError(caught),
  });

  const validateRange = useMutation({
    mutationFn: () => agronomicRangeApi.validate(validating?.id ?? '', { validatedBy: validatedBy.trim() }),
    onSuccess: () => {
      setError(null);
      setValidating(null);
      setValidatedBy('');
      invalidate();
    },
    onError: (caught) => setError(caught),
  });

  const retire = useMutation({
    mutationFn: (id: string) => agronomicRangeApi.retire(id),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (caught) => setError(caught),
  });

  const importCsv = useMutation({
    mutationFn: (dryRun: boolean) => agronomicRangeApi.importCsv({ csv, dryRun }),
    onSuccess: (result) => {
      setError(null);
      setImportResult(result.data);
      if (!result.data.summary.dryRun) invalidate();
    },
    onError: (caught) => {
      setImportResult(null);
      setError(caught);
    },
  });

  const items = ranges.data?.items ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Plages agronomiques" subtitle="Référentiel des fourchettes culturales." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Plages agronomiques" icon="leaf-outline">
          <Card tone="pale" style={styles.card}>
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
              Une plage provisoire rend les recommandations « indicatives ». La valider exige un
              validateur nommé et une source citable. Aucune valeur ne peut être enregistrée sans
              provenance, et modifier une plage validée annule sa validation.
            </Text>
          </Card>

          {error ? <ErrorState error={error} showRequestId /> : null}

          {/* ── Filtres ─────────────────────────────────────────── */}
          <Card tone="white" style={styles.card}>
            <Text preset="overline" color={COLORS.forestGreen}>
              Filtres
            </Text>
            <Input
              label="Culture (slug)"
              value={cropSlug}
              onChangeText={setCropSlug}
              placeholder="manioc"
              autoCapitalize="none"
            />
            <ChipRow>
              {STATUS_FILTERS.map((filter) => (
                <FilterChip
                  key={filter.value || 'all'}
                  label={filter.label}
                  active={status === filter.value}
                  onPress={() => setStatus(filter.value)}
                />
              ))}
            </ChipRow>
          </Card>

          {/* ── Création ────────────────────────────────────────── */}
          <Card tone="white" style={styles.card}>
            <Text preset="overline" color={COLORS.forestGreen}>
              Créer une plage
            </Text>
            <Input
              label="Culture (slug)"
              value={cropSlug}
              onChangeText={setCropSlug}
              autoCapitalize="none"
            />
            <ChipRow>
              {PARAMETER_KEYS.map((key) => (
                <FilterChip
                  key={key}
                  label={`${PARAMETER_LABELS[key]} (${PARAMETER_UNITS[key]})`}
                  active={parameterKey === key}
                  onPress={() => setParameterKey(key)}
                />
              ))}
            </ChipRow>
            <Input
              label={`Min (${PARAMETER_UNITS[parameterKey]})`}
              value={minValue}
              onChangeText={setMinValue}
              keyboardType="numeric"
            />
            <Input
              label={`Max (${PARAMETER_UNITS[parameterKey]})`}
              value={maxValue}
              onChangeText={setMaxValue}
              keyboardType="numeric"
            />
            <Input
              label={`Toléré min (${PARAMETER_UNITS[parameterKey]})`}
              value={toleratedMin}
              onChangeText={setToleratedMin}
              keyboardType="numeric"
              helper="Facultatif. Doit être ≤ à l'idéal min. Vide = aucune limite inventée."
            />
            <Input
              label={`Toléré max (${PARAMETER_UNITS[parameterKey]})`}
              value={toleratedMax}
              onChangeText={setToleratedMax}
              keyboardType="numeric"
              helper="Facultatif. Doit être ≥ à l'idéal max."
            />
            <Input
              label="Zone concernée"
              value={zone}
              onChangeText={setZone}
              placeholder="Équateur, bassin de la Ruki…"
              helper="Facultatif : laisse la fourchette non circonscrite."
            />
            <Input
              label="Source citable"
              value={sourceReference}
              onChangeText={setSourceReference}
              placeholder="Référentiel agronomique de test — Manihot esculenta"
              helper="Obligatoire pour pouvoir valider la plage ensuite."
            />
            <Input
              label="Note sur la nature de la valeur"
              value={sourceNote}
              onChangeText={setSourceNote}
              helper="À défaut de source, cette note est obligatoire."
            />
            <Input label="Lot" value={datasetLabel} onChangeText={setDatasetLabel} />
            <Button
              label="Créer la plage"
              variant="primary"
              fullWidth
              loading={create.isPending}
              onPress={() => create.mutate()}
            />
          </Card>

          {/* ── Liste ───────────────────────────────────────────── */}
          {ranges.isLoading ? <LoadingState count={3} height={80} /> : null}
          {ranges.isError ? (
            <ErrorState error={ranges.error} onRetry={() => void ranges.refetch()} />
          ) : null}
          {ranges.data && items.length === 0 ? (
            <EmptyState
              title="Données insuffisantes"
              description="Aucune plage agronomique pour ce filtre. Sans plage en base, le moteur considère le critère comme non évalué — il n'invente jamais de fourchette."
              icon="leaf-outline"
            />
          ) : null}

          {items.map((range, index) => (
            <Reveal key={range.id} index={index} variant="up">
              <Card tone="white" style={styles.card}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text preset="bodyMedium" color={COLORS.textPrimary}>
                      {range.cropSlug} · {PARAMETER_LABELS[range.parameterKey] ?? range.parameterKey}
                    </Text>
                    <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                      Idéal [{range.minValue} ; {range.maxValue}] {range.unit} · lot {range.datasetLabel} · v
                      {range.version}
                    </Text>
                    {/*
                      Les bornes tolérées encadrent l'idéal. Quand elles
                      manquent, on le dit : un vide silencieux laisserait croire
                      que le moteur dispose de quatre limites.
                    */}
                    <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                      {range.toleratedMin !== null && range.toleratedMax !== null
                        ? `Toléré [${range.toleratedMin} ; ${range.toleratedMax}] ${range.unit}`
                        : 'Toléré : non renseigné — verdict limité à la plage idéale'}
                    </Text>
                    <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                      {range.sourceType ? `Type : ${SOURCE_TYPE_LABELS[range.sourceType]} · ` : ''}
                      {range.sourceReference ?? 'Aucune source citable.'}
                      {range.sourceNote ? ` · ${range.sourceNote}` : ''}
                    </Text>
                    {range.status === 'VALIDATED' ? (
                      <Text preset="caption" color={COLORS.success} style={styles.lineHeight}>
                        Validée par {range.validatedBy}
                        {range.validatedAt ? ` le ${formatDate(range.validatedAt, locale)}` : ''}
                      </Text>
                    ) : null}
                  </View>
                  <Chip
                    label={range.status}
                    tone={
                      range.status === 'VALIDATED'
                        ? 'success'
                        : range.status === 'PROVISIONAL'
                          ? 'warning'
                          : 'neutral'
                    }
                    size="sm"
                  />
                </View>

                {range.status !== 'RETIRED' ? (
                  <View style={styles.actions}>
                    {range.status === 'PROVISIONAL' ? (
                      <Button
                        label="Valider"
                        variant="primary"
                        size="sm"
                        onPress={() => {
                          setValidating(range);
                          setError(null);
                        }}
                      />
                    ) : null}
                    <Button
                      label="Retirer"
                      variant="outline"
                      size="sm"
                      loading={retire.isPending}
                      onPress={() => retire.mutate(range.id)}
                    />
                  </View>
                ) : null}
              </Card>
            </Reveal>
          ))}

          {/* ── Validation ──────────────────────────────────────── */}
          {validating ? (
            <Card tone="white" style={styles.card}>
              <Text preset="overline" color={COLORS.forestGreen}>
                Valider {validating.cropSlug} · {PARAMETER_LABELS[validating.parameterKey] ?? validating.parameterKey}
              </Text>
              {!validating.sourceReference ? (
                <Text preset="caption" color={COLORS.error} style={styles.lineHeight}>
                  Cette plage n’a pas de source citable : le serveur refuse la validation (409).
                </Text>
              ) : (
                <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                  Source enregistrée : {validating.sourceReference}
                </Text>
              )}
              <Input
                label="Validée par"
                value={validatedBy}
                onChangeText={setValidatedBy}
                placeholder="Dr. Alice Muteba"
                helper="Le nom du validateur est conservé avec la plage et son horodatage."
              />
              <Button
                label="Confirmer la validation"
                variant="primary"
                fullWidth
                loading={validateRange.isPending}
                onPress={() => validateRange.mutate()}
              />
              <Button label="Annuler" variant="outline" fullWidth onPress={() => setValidating(null)} />
            </Card>
          ) : null}

          {/* ── Import CSV ──────────────────────────────────────── */}
          <Card tone="white" style={styles.card}>
            <Text preset="overline" color={COLORS.forestGreen}>
              Import CSV
            </Text>
            <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
              Une ligne par culture et par paramètre. Chaque ligne est validée individuellement :
              une ligne invalide est rapportée avec son numéro, les autres sont traitées. Une
              plage déjà validée n’est jamais écrasée.
            </Text>

            {template.data ? (
              <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                En-tête : {template.data.header.join(' ; ')}
                {'\n'}Exemple : {template.data.example.join(' ; ')}
              </Text>
            ) : null}

            <Input
              label="Contenu du fichier"
              value={csv}
              onChangeText={setCsv}
              multiline
              autoCapitalize="none"
              placeholder={'Culture;Nom scientifique;Paramètre;Unité;Idéal min;Idéal max;Toléré min;Toléré max;Type de source;Source précise;Zone concernée;Statut;Validé par;Date de validation;Remarques\nexemple;Exemplum fictivum;pH du sol;pH;5.5;7.0;4.5;8.0;Agronome;Exemple de format;;;PROVISIONAL;;;Ligne d\u2019exemple : valeurs fictives, à remplacer.'}
            />
            <Button
              label="Vérifier (sans écrire)"
              variant="outline"
              fullWidth
              loading={importCsv.isPending}
              onPress={() => importCsv.mutate(true)}
            />
            <Button
              label="Appliquer l'import"
              variant="primary"
              fullWidth
              loading={importCsv.isPending}
              onPress={() => importCsv.mutate(false)}
            />
            {template.data ? (
              <Button
                label="Charger le modèle"
                variant="outline"
                fullWidth
                onPress={() => setCsv(template.data.csv)}
              />
            ) : null}

            {importResult ? (
              <View style={styles.importResult}>
                <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
                  {importResult.summary.dryRun ? 'Vérification (rien n’a été écrit)' : 'Import appliqué'} —{' '}
                  {importResult.summary.totalLines} ligne(s) : {importResult.summary.created} créée(s),{' '}
                  {importResult.summary.updated} mise(s) à jour, {importResult.summary.skippedValidated}{' '}
                  ignorée(s) car validée(s), {importResult.summary.skippedEmpty} ignorée(s) faute de{' '}
                  valeurs idéales, {importResult.summary.errors} en erreur.
                </Text>
                {importResult.results.map((result) => (
                  <View key={`${result.line}-${result.parameterKey ?? 'none'}`} style={styles.importRow}>
                    <Chip
                      label={result.outcome}
                      tone={
                        result.outcome === 'ERROR'
                          ? 'error'
                          : result.outcome === 'SKIPPED_VALIDATED'
                            ? 'warning'
                            : 'success'
                      }
                      size="sm"
                    />
                    <Text preset="caption" color={COLORS.slateGray} style={{ flex: 1 }}>
                      ligne {result.line}
                      {result.cropSlug ? ` · ${result.cropSlug}` : ''}
                      {result.parameterKey ? ` · ${result.parameterKey}` : ''}
                      {result.reason ? ` — ${result.reason}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  card: { gap: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  importResult: { gap: SPACING.sm },
  importRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  lineHeight: { lineHeight: 18 },
});
