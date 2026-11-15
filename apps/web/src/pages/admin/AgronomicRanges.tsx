import { useState } from 'react';
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
  TextArea,
} from '@/components/ui';
import { agronomicRangeApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type {
  AgronomicRangeImportResult,
  CropAgronomicRange,
  RangeParameterKey,
  RangeSourceType,
  RangeStatus,
} from '@/services/types';
import { useAuthStore } from '@/store/auth';
import { formatDate } from '@/lib/format';
import { useI18n, tr } from '@/i18n';
import { COLORS } from '@/theme';

/**
 * ADMIN / AGRONOME — gouvernance du référentiel agronomique.
 *
 * Une plage `VALIDATED` fait sortir les recommandations du régime « indicatif » :
 * la validation est donc un acte engageant, qui exige un validateur nommé et une
 * source citable. Deux règles du serveur sont reprises telles quelles ici :
 *
 *  - **aucune valeur sans provenance** : `source` ou `note` est obligatoire ;
 *  - **modifier une plage validée annule sa validation** : elle portait sur les
 *    anciennes bornes.
 *
 * L'import CSV valide chaque ligne individuellement : une ligne invalide est
 * rapportée avec son numéro et sa raison, les autres sont traitées. Le mode
 * `dryRun` permet de contrôler un fichier avant de l'appliquer.
 */

const STATUS_TONE: Record<RangeStatus, 'success' | 'warning' | 'neutral'> = {
  PROVISIONAL: 'warning',
  VALIDATED: 'success',
  RETIRED: 'neutral',
};

const PARAMETER_LABELS: Record<RangeParameterKey, string> = {
  get ph() { return tr('ui.phDuSol'); },
  get airTemperatureC() { return tr('ui.temperatureDeLAir'); },
  get moisture() { return tr('ui.humiditeVolumiqueDuSol'); },
  get ec() { return tr('ui.saliniteCe'); },
  get depthCm() { return tr('ui.profondeurRacinaireUtile'); },
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
  get AGRONOMIST() { return tr('ui.agronome'); },
  get PUBLICATION() { return tr('ui.publication'); },
  get PILOT() { return tr('ui.pilote'); },
};

/** Le menu reprend le libellé du tableau : « A choisir » signifie non renseigné. */
const SOURCE_TYPE_OPTIONS: Array<{ value: RangeSourceType | ''; label: string }> = [
  { value: '', get label() { return tr('ui.aChoisir'); } },
  { value: 'AGRONOMIST', get label() { return tr('ui.agronome'); } },
  { value: 'PUBLICATION', get label() { return tr('ui.publication'); } },
  { value: 'PILOT', get label() { return tr('ui.pilote'); } },
];

interface FormState {
  cropSlug: string;
  parameterKey: RangeParameterKey;
  minValue: string;
  maxValue: string;
  toleratedMin: string;
  toleratedMax: string;
  sourceType: RangeSourceType | '';
  zone: string;
  sourceReference: string;
  sourceNote: string;
  datasetLabel: string;
}

const EMPTY_FORM: FormState = {
  cropSlug: '',
  parameterKey: 'ph',
  minValue: '',
  maxValue: '',
  toleratedMin: '',
  toleratedMax: '',
  sourceType: '',
  zone: '',
  sourceReference: '',
  sourceNote: '',
  datasetLabel: 'production',
};

export default function AdminAgronomicRanges() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const [filters, setFilters] = useState<{ cropSlug: string; status: RangeStatus | '' }>({
    cropSlug: '',
    status: '',
  });
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [validating, setValidating] = useState<CropAgronomicRange | null>(null);
  const [validatedBy, setValidatedBy] = useState('');
  const [csv, setCsv] = useState('');
  const [importResult, setImportResult] = useState<AgronomicRangeImportResult | null>(null);
  const [error, setError] = useState<unknown>(null);

  const ranges = useQuery({
    queryKey: queryKeys.agronomicRanges.list(filters),
    queryFn: () =>
      agronomicRangeApi
        .list({
          cropSlug: filters.cropSlug || undefined,
          status: filters.status || undefined,
        })
        .then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const meta = useQuery({
    queryKey: queryKeys.agronomicRanges.meta,
    queryFn: () => agronomicRangeApi.meta().then((result) => result.data),
  });

  const template = useQuery({
    queryKey: queryKeys.agronomicRanges.template,
    queryFn: () => agronomicRangeApi.importTemplate().then((result) => result.data),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.agronomicRanges.all });
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        cropSlug: form.cropSlug.trim(),
        parameterKey: form.parameterKey,
        minValue: Number(form.minValue),
        maxValue: Number(form.maxValue),
        // Une borne tolérée laissée vide est envoyée telle quelle : `null`, et
        // jamais une valeur complétée. Un champ vide n'est pas un zéro.
        toleratedMin: form.toleratedMin.trim() === '' ? null : Number(form.toleratedMin),
        toleratedMax: form.toleratedMax.trim() === '' ? null : Number(form.toleratedMax),
        sourceType: form.sourceType === '' ? null : form.sourceType,
        zone: form.zone.trim() || null,
        unit: PARAMETER_UNITS[form.parameterKey],
        sourceReference: form.sourceReference.trim() || undefined,
        sourceNote: form.sourceNote.trim() || undefined,
        datasetLabel: form.datasetLabel.trim() || 'production',
      };
      return editingId
        ? agronomicRangeApi.update(editingId, {
            minValue: payload.minValue,
            maxValue: payload.maxValue,
            toleratedMin: payload.toleratedMin,
            toleratedMax: payload.toleratedMax,
            sourceType: payload.sourceType,
            zone: payload.zone,
            unit: payload.unit,
            sourceReference: payload.sourceReference ?? null,
            sourceNote: payload.sourceNote ?? null,
          })
        : agronomicRangeApi.create(payload);
    },
    onSuccess: () => {
      setError(null);
      setForm(EMPTY_FORM);
      setEditingId(null);
      invalidate();
    },
    onError: (caught) => setError(caught),
  });

  const validateRange = useMutation({
    mutationFn: () =>
      agronomicRangeApi.validate(validating?.id ?? '', { validatedBy: validatedBy.trim() }),
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
  const bounds = (key: string) => meta.data?.physicalBounds?.[key];

  const startEdit = (range: CropAgronomicRange) => {
    setEditingId(range.id);
    setForm({
      cropSlug: range.cropSlug,
      parameterKey: range.parameterKey,
      minValue: String(range.minValue),
      maxValue: String(range.maxValue),
      toleratedMin: range.toleratedMin === null ? '' : String(range.toleratedMin),
      toleratedMax: range.toleratedMax === null ? '' : String(range.toleratedMax),
      sourceType: range.sourceType ?? '',
      zone: range.zone ?? '',
      sourceReference: range.sourceReference ?? '',
      sourceNote: range.sourceNote ?? '',
      datasetLabel: range.datasetLabel,
    });
  };

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title={t('ui.plagesAgronomiques')}
        description={t('ui.referentielDesFourchettesCulturales')}
        icon="🌾"
      >
        <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.plagesAgronomiques')}</Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 16 }}>{t('ui.unePlageProvisoireRendLesRecommandations')}</Text>

        <Card tone="pale" style={{ marginBottom: 24 }}>
          <Text preset="caption">{t('ui.aucuneValeurNePeutEtreEnregistree')}</Text>
        </Card>

        {error ? <ErrorState error={error} /> : null}

        {/* ── Filtres ────────────────────────────────────────────── */}
        <Card tone="white" style={{ marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <Input
              label={t('ui.cultureSlug')}
              value={filters.cropSlug}
              placeholder="manioc"
              onChange={(event) => setFilters((current) => ({ ...current, cropSlug: event.target.value }))}
            />
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Text preset="caption">{t('ui.statut')}</Text>
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, status: event.target.value as RangeStatus | '' }))
                }
                style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLORS.lightBorder}` }}
              >
                <option value="">{t('ui.tous')}</option>
                <option value="PROVISIONAL">{t('ui.provisoires')}</option>
                <option value="VALIDATED">{t('ui.validees')}</option>
                <option value="RETIRED">{t('ui.retirees')}</option>
              </select>
            </label>
          </div>
        </Card>

        {/* ── Création / modification ────────────────────────────── */}
        <Card tone="white" style={{ marginBottom: 24 }}>
          <Text preset="h3" style={{ marginBottom: 12 }}>
            {editingId ? t('ui.modifierLaPlage') : t('ui.creerUnePlage')}
          </Text>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
            <Input
              label={t('ui.cultureSlug')}
              value={form.cropSlug}
              disabled={Boolean(editingId)}
              onChange={(event) => setForm((current) => ({ ...current, cropSlug: event.target.value }))}
            />
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Text preset="caption">{t('ui.parametre')}</Text>
              <select
                value={form.parameterKey}
                disabled={Boolean(editingId)}
                onChange={(event) =>
                  setForm((current) => ({ ...current, parameterKey: event.target.value as RangeParameterKey }))
                }
                style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLORS.lightBorder}` }}
              >
                {PARAMETER_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PARAMETER_LABELS[key]} ({PARAMETER_UNITS[key]})
                  </option>
                ))}
              </select>
            </label>
            <Input
              label={t('ui.min', { value: PARAMETER_UNITS[form.parameterKey] })}
              type="number"
              step="any"
              value={form.minValue}
              hint={bounds(form.parameterKey) ? t('ui.physicalBound', { value: bounds(form.parameterKey)?.min }) : undefined}
              onChange={(event) => setForm((current) => ({ ...current, minValue: event.target.value }))}
            />
            <Input
              label={t('ui.max', { value: PARAMETER_UNITS[form.parameterKey] })}
              type="number"
              step="any"
              value={form.maxValue}
              hint={bounds(form.parameterKey) ? t('ui.physicalBound', { value: bounds(form.parameterKey)?.max }) : undefined}
              onChange={(event) => setForm((current) => ({ ...current, maxValue: event.target.value }))}
            />
            <Input
              label={t('ui.tolereMin', { value: PARAMETER_UNITS[form.parameterKey] })}
              type="number"
              step="any"
              value={form.toleratedMin}
              hint={t('ui.facultatifDoitEtreALIdeal')}
              onChange={(event) => setForm((current) => ({ ...current, toleratedMin: event.target.value }))}
            />
            <Input
              label={t('ui.tolereMax', { value: PARAMETER_UNITS[form.parameterKey] })}
              type="number"
              step="any"
              value={form.toleratedMax}
              hint={t('ui.facultatifDoitEtreALIdeal_73eec')}
              onChange={(event) => setForm((current) => ({ ...current, toleratedMax: event.target.value }))}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 16 }}>
            <Input
              label={t('ui.sourceCitable')}
              value={form.sourceReference}
              placeholder={t('ui.referentielAgronomiqueDeTestManihotEsculenta')}
              hint={t('ui.obligatoirePourPouvoirValiderLaPlage')}
              onChange={(event) => setForm((current) => ({ ...current, sourceReference: event.target.value }))}
            />
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Text preset="caption" color={COLORS.slateGray}>{t('ui.typeDeSource')}</Text>
              <select
                value={form.sourceType}
                onChange={(event) =>
                  setForm((current) => ({ ...current, sourceType: event.target.value as RangeSourceType | '' }))
                }
              >
                {SOURCE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value || 'none'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label={t('ui.zoneConcernee')}
              value={form.zone}
              placeholder={t('ui.equateurBassinDeLaRuki')}
              hint={t('ui.facultatifLaisseLaFourchetteNonCirconscrite')}
              onChange={(event) => setForm((current) => ({ ...current, zone: event.target.value }))}
            />
            <Input
              label={t('ui.lot')}
              value={form.datasetLabel}
              onChange={(event) => setForm((current) => ({ ...current, datasetLabel: event.target.value }))}
            />
          </div>
          <TextArea
            label={t('ui.noteSurLaNatureDeLa')}
            value={form.sourceNote}
            onChange={(event) => setForm((current) => ({ ...current, sourceNote: event.target.value }))}
            placeholder={t('ui.temperatureDeLAirReferentielGenerique')}
            hint={t('ui.aDefautDeSourceCitableCette')}
            minHeight={70}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <Button
              label={editingId ? t('ui.enregistrerLesModifications') : t('ui.creerLaPlage')}
              variant="primary"
              loading={save.isPending}
              onClick={() => save.mutate()}
            />
            {editingId ? (
              <Button
                label={t('common.cancel')}
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                }}
              />
            ) : null}
          </div>
        </Card>

        {/* ── Liste ──────────────────────────────────────────────── */}
        <Text preset="h3" style={{ marginBottom: 12 }}>{t('ui.referentiel')}</Text>
        {ranges.isLoading ? <LoadingState count={3} height={72} /> : null}
        {ranges.isError ? <ErrorState error={ranges.error} /> : null}
        {ranges.data && items.length === 0 ? (
          <EmptyState
            title={t('ui.donneesInsuffisantes')}
            description={t('ui.aucunePlageAgronomiqueNEstEnregistree')}
            icon="🌾"
          />
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {items.map((range) => (
            <Card key={range.id} tone="white">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                <div>
                  <Text preset="bodyMd" style={{ marginBottom: 4 }}>
                    {range.cropSlug} · {PARAMETER_LABELS[range.parameterKey] ?? range.parameterKey}
                  </Text>
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.idealLotV', { minValue: range.minValue, maxValue: range.maxValue, unit: range.unit, datasetLabel: range.datasetLabel, version: range.version })}</Text>
                  {/*
                    Les bornes tolérées encadrent l'idéal. Quand elles manquent,
                    on l'affiche explicitement : un vide silencieux laisserait
                    croire que le moteur dispose de quatre limites alors qu'il
                    n'en a que deux.
                  */}
                  <Text preset="caption" color={COLORS.slateGray}>
                    {range.toleratedMin !== null && range.toleratedMax !== null
                      ? t('ui.tolere', { toleratedMin: range.toleratedMin, toleratedMax: range.toleratedMax, unit: range.unit })
                      : t('ui.tolereNonRenseigneVerdictLimiteA')}
                  </Text>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Chip label={range.status} tone={STATUS_TONE[range.status]} size="sm" />
                  {range.sourceType ? (
                    <Chip label={SOURCE_TYPE_LABELS[range.sourceType]} tone="info" size="sm" />
                  ) : null}
                  {range.zone ? <Chip label={range.zone} tone="neutral" size="sm" /> : null}
                  {range.organizationId ? <Chip label={t('ui.organisation')} tone="info" size="sm" /> : null}
                </div>
              </div>

              <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 8 }}>
                {range.sourceReference ? t('ui.source_3c4d0', { sourceReference: range.sourceReference }) : t('ui.aucuneSourceCitable')}
                {range.sourceNote ? ` · ${range.sourceNote}` : ''}
              </Text>

              {range.status === 'VALIDATED' ? (
                <Text preset="caption" color={COLORS.success} style={{ marginBottom: 8 }}>{t('ui.valideePar', { validatedBy: range.validatedBy, value: range.validatedAt ? ` le ${formatDate(range.validatedAt, locale)}` : '' })}</Text>
              ) : null}

              {range.status !== 'RETIRED' ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button label={t('ui.modifier')} size="sm" variant="outline" onClick={() => startEdit(range)} />
                  {range.status === 'PROVISIONAL' ? (
                    <Button
                      label={t('ui.valider')}
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        setValidating(range);
                        setError(null);
                      }}
                    />
                  ) : null}
                  <Button
                    label={t('ui.retirer')}
                    size="sm"
                    variant="outline"
                    loading={retire.isPending}
                    onClick={() => retire.mutate(range.id)}
                  />
                </div>
              ) : null}
            </Card>
          ))}
        </div>

        {/* ── Validation ─────────────────────────────────────────── */}
        {validating ? (
          <Card tone="white" style={{ marginBottom: 24 }}>
            <Text preset="h3" style={{ marginBottom: 8 }}>{t('ui.valider_424cc', { cropSlug: validating.cropSlug, value: PARAMETER_LABELS[validating.parameterKey] ?? validating.parameterKey })}</Text>
            {!validating.sourceReference ? (
              <Text preset="caption" color={COLORS.error} style={{ marginBottom: 12 }}>{t('ui.cettePlageNAPasDe')}</Text>
            ) : (
              <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 12 }}>{t('ui.sourceEnregistree', { sourceReference: validating.sourceReference })}</Text>
            )}
            <Input
              label={t('ui.valideePar_bbf08')}
              value={validatedBy}
              placeholder={t('ui.drAliceMuteba')}
              hint={t('ui.leNomDuValidateurEstConserve')}
              onChange={(event) => setValidatedBy(event.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Button
                label={t('ui.confirmerLaValidation')}
                variant="primary"
                loading={validateRange.isPending}
                onClick={() => validateRange.mutate()}
              />
              <Button label={t('common.cancel')} variant="outline" onClick={() => setValidating(null)} />
            </div>
          </Card>
        ) : null}

        {/* ── Import CSV ─────────────────────────────────────────── */}
        <Card tone="white">
          <Text preset="h3" style={{ marginBottom: 8 }}>{t('ui.importCsv')}</Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 12 }}>{t('ui.uneLigneParCultureEtPar')}</Text>

          {template.data ? (
            <Card tone="pale" style={{ marginBottom: 12 }}>
              <Text preset="caption" style={{ marginBottom: 8 }}>{t('ui.enTeteAttendu')}{' '}<span style={{ fontFamily: 'monospace' }}>{template.data.header.join(' ; ')}</span>
              </Text>
              <Text preset="caption" style={{ marginBottom: 8 }}>{t('ui.exemple')}{' '}<span style={{ fontFamily: 'monospace' }}>{template.data.example.join(' ; ')}</span>
              </Text>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {template.data.notes.map((note) => (
                  <li key={note}>
                    <Text preset="caption">{note}</Text>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <TextArea
            label={t('ui.contenuDuFichier')}
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            minHeight={140}
            placeholder={'Culture;Nom scientifique;Paramètre;Unité;Idéal min;Idéal max;Toléré min;Toléré max;Type de source;Source précise;Zone concernée;Statut;Validé par;Date de validation;Remarques\nexemple;Exemplum fictivum;pH du sol;pH;5.5;7.0;4.5;8.0;Agronome;Exemple de format;;;PROVISIONAL;;;Ligne d\u2019exemple : valeurs fictives, à remplacer.'}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <Button
              label={t('ui.verifierSansEcrire')}
              variant="outline"
              loading={importCsv.isPending}
              onClick={() => importCsv.mutate(true)}
            />
            <Button
              label={t('ui.appliquerLImport')}
              variant="primary"
              loading={importCsv.isPending}
              onClick={() => importCsv.mutate(false)}
            />
            {template.data ? (
              <Button
                label={t('ui.chargerLeModele')}
                variant="outline"
                onClick={() => setCsv(template.data.csv)}
              />
            ) : null}
          </div>

          {importResult ? (
            <div style={{ marginTop: 16 }}>
              <Text preset="bodyMd" style={{ marginBottom: 8 }}>
                {importResult.summary.dryRun ? t('ui.verificationRienNAEteEcrit') : t('ui.importApplique')}{' '}{t('ui.ligneSCreeeSMiseS', { totalLines: importResult.summary.totalLines, created: importResult.summary.created, updated: importResult.summary.updated, skippedValidated: importResult.summary.skippedValidated, skippedEmpty: importResult.summary.skippedEmpty, errors: importResult.summary.errors })}</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {importResult.results.map((result) => (
                  <div
                    key={`${result.line}-${result.parameterKey ?? 'none'}`}
                    style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}
                  >
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
                    <Text preset="caption">
                      ligne {result.line}
                      {result.cropSlug ? ` · ${result.cropSlug}` : ''}
                      {result.parameterKey ? ` · ${result.parameterKey}` : ''}
                      {result.reason ? ` — ${result.reason}` : ''}
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      </AuthGate>
    </Section>
  );
}
