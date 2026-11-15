import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import {
  AuthGate,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  ErrorState,
  FilterChip,
  LoadingState,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n, tr } from '@/i18n';
import { formatDate } from '@/lib/format';
import { alertApi } from '@/services/api/endpoints';
import type { AlertFilterOption, AlertSourceType, DescribedAlert } from '@/services/api/types';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * Écran 3 (mobile) — boîte d'alertes. Miroir de `apps/web/src/pages/farmer/Alerts.tsx`.
 *
 * Trois sources, qui n'appellent **pas** la même action : mesure hors seuil,
 * franchissement anticipé par la prévision, capteur silencieux (une **absence**
 * de remontée — jamais une mauvaise mesure).
 *
 * Le canal SMS reste primaire ; cet écran est le suivi et la clôture.
 *
 * ## Deux règles suivies ici
 *
 * 1. **Aucun libellé recopié.** Source, gravité, statut et grandeur arrivent
 *    nommés par l'API, et les valeurs des filtres viennent de `GET /alerts/meta`.
 * 2. **Un seul sélecteur d'état.** `open` et `status` sont exclusifs côté API
 *    (422 sinon) ; deux sélecteurs laisseraient croire que les deux s'appliquent.
 */

/** Gravité → ton visuel. Mise en forme, pas libellé. */
const SEVERITY_TONE = { INFO: 'info', WARNING: 'warning', CRITICAL: 'error' } as const;
const STATUS_TONE = { NEW: 'warning', READ: 'info', HANDLED: 'success' } as const;

const PAGE_SIZE = 20;

type EtatFiltre = 'TOUS' | 'OUVERTS' | 'NEW' | 'READ' | 'HANDLED';

/**
 * Options d'état : les statuts nommés par l'API, plus deux vues transverses.
 *
 * « Non traitées » n'est pas un statut — c'est `open=true`, qui couvre NEW et
 * READ. L'écrire comme un quatrième statut ferait croire que `status` porte
 * cette valeur.
 */
function etatOptions(statuts: AlertFilterOption[]): { value: EtatFiltre; label: string }[] {
  return [
    { value: 'TOUS', label: tr('ui.toutes') },
    { value: 'OUVERTS', label: tr('ui.nonTraitees') },
    ...statuts
      .filter((s) => s.value === 'NEW' || s.value === 'READ' || s.value === 'HANDLED')
      .map((s) => ({ value: s.value as EtatFiltre, label: s.label })),
  ];
}

/** Une alerte, avec ses actions. */
function AlertCard({
  alert,
  locale,
  busy,
  onRead,
  onHandled,
}: {
  alert: DescribedAlert;
  locale: 'fr' | 'en';
  busy: boolean;
  onRead: () => void;
  onHandled: () => void;
}) {
  const { t } = useI18n();
  const plage = alert.range;
  const reference = alert.observedAt ?? alert.predictedBreachAt ?? alert.createdAt;

  return (
    <Card tone={alert.status === 'HANDLED' ? 'paper' : 'white'} style={styles.card}>
      <View style={styles.entete}>
        <View style={styles.titres}>
          <Text preset="bodySm">{alert.parameterLabel}</Text>
          <Text preset="caption" color={COLORS.slateGray}>
            {alert.sourceTypeLabel} · {formatDate(reference, locale)}
          </Text>
        </View>
        <View style={styles.pastilles}>
          <Chip label={alert.severityLabel} tone={SEVERITY_TONE[alert.severity]} size="sm" />
          <Chip label={alert.statusLabel} tone={STATUS_TONE[alert.status]} size="sm" />
        </View>
      </View>

      <Text preset="caption" color={COLORS.textPrimary} style={styles.observation}>
        {alert.observedLabel
          ? t('ui.observe', { observedLabel: alert.observedLabel })
          : alert.predictive
            ? t('ui.aucuneValeurObserveeFranchissementAnticipe')
            : t('ui.aucuneValeurObserveeTransmise')}
        {t('ui.seuil_c5cb9')}
        {alert.referenceLabel}
      </Text>

      {plage?.label ? (
        <Text preset="caption" color={COLORS.slateGray}>{t('ui.plageDeReference', { label: plage.label })}{plage.status === 'PROVISIONAL'
            ? t('ui.provisoireCetteAlerteNeReposePas')
            : plage.status
              ? t('ui.validee_a1416')
              : ''}
        </Text>
      ) : (
        /*
         * Absence de plage affichée comme telle : sans bornes, on peut dire
         * qu'un seuil a été franchi, pas situer la valeur observée.
         */
        <Text preset="caption" color={COLORS.slateGray}>{t('ui.plageDeReferenceNonDisponiblePour')}</Text>
      )}

      {alert.status !== 'HANDLED' ? (
        <View style={styles.actions}>
          {alert.status === 'NEW' ? (
            <Button label={t('ui.marquerLue')} variant="outline" size="sm" loading={busy} onPress={onRead} />
          ) : null}
          <Button
            label={t('ui.marquerTraitee')}
            variant="primary"
            size="sm"
            loading={busy}
            onPress={onHandled}
          />
        </View>
      ) : (
        <Text preset="caption" color={COLORS.slateGray} style={styles.cloture}>{t('ui.traiteeElleNeSeraPlusRappelee')}</Text>
      )}
    </Card>
  );
}

export default function FarmerAlerts() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const queryClient = useQueryClient();

  const [etat, setEtat] = useState<EtatFiltre>('OUVERTS');
  // Typé `AlertSourceType` : les options viennent de `/alerts/meta`, donc une
  // valeur inconnue du serveur ne peut pas arriver ici sans erreur de compilation.
  const [source, setSource] = useState<AlertSourceType | undefined>(undefined);
  const [page, setPage] = useState(1);

  const params = {
    page,
    limit: PAGE_SIZE,
    sourceType: source,
    // `open` et `status` sont exclusifs : un seul est envoyé, jamais les deux.
    open: etat === 'OUVERTS' ? true : undefined,
    status: etat === 'OUVERTS' || etat === 'TOUS' ? undefined : etat,
  };

  const filtres = useQuery({
    queryKey: queryKeys.alerts.meta,
    queryFn: () => alertApi.meta().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const alertes = useQuery({
    queryKey: queryKeys.alerts.list(params),
    queryFn: () => alertApi.list(params).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const invalider = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all });
  };

  const marquerLue = useMutation({
    mutationFn: (id: string) => alertApi.markRead(id),
    onSuccess: invalider,
  });

  const marquerTraitee = useMutation({
    mutationFn: (id: string) => alertApi.markHandled(id),
    onSuccess: invalider,
  });

  const occupee = (id: string) =>
    (marquerLue.isPending && marquerLue.variables === id) ||
    (marquerTraitee.isPending && marquerTraitee.variables === id);

  const items = alertes.data?.items ?? [];
  const meta = alertes.data;
  const options = filtres.data;

  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader
        title={t('ui.boiteDAlertes_6a179')}
        subtitle={t('ui.franchissementsPrevisionsEtCapteursSilencieuxLe')}
      />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.boiteDAlertes_6a179')} icon="notifications-outline">
          {meta && meta.openCount > 0 ? (
            <Card tone="gold" style={styles.compteur}>
              <Text preset="caption" color={COLORS.textPrimary}>{t(meta.openCount > 1 ? 'ui.openAlertsInOrgOther' : 'ui.openAlertsInOrgOne', { openCount: meta.openCount })}</Text>
            </Card>
          ) : null}

          {options ? (
            <View style={styles.filtres}>
              <Text preset="overline" color={COLORS.slateGray}>{t('ui.etat')}</Text>
              <ChipRow>
                {etatOptions(options.statuses).map((o) => (
                  <FilterChip
                    key={o.value}
                    label={o.label}
                    active={etat === o.value}
                    onPress={() => {
                      setEtat(o.value);
                      setPage(1);
                    }}
                  />
                ))}
              </ChipRow>

              <Text preset="overline" color={COLORS.slateGray}>{t('ui.source_6da13')}</Text>
              <ChipRow>
                <FilterChip
                  label={t('ui.toutes')}
                  active={source === undefined}
                  onPress={() => {
                    setSource(undefined);
                    setPage(1);
                  }}
                />
                {options.sourceTypes.map((o) => (
                  <FilterChip
                    key={o.value}
                    label={o.label}
                    active={source === o.value}
                    onPress={() => {
                      setSource(source === o.value ? undefined : (o.value as AlertSourceType));
                      setPage(1);
                    }}
                  />
                ))}
              </ChipRow>
            </View>
          ) : null}

          {alertes.isLoading ? (
            <LoadingState count={3} height={120} />
          ) : alertes.isError ? (
            <ErrorState error={alertes.error} onRetry={() => void alertes.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title={t('ui.aucuneAlertePourCeFiltre')}
              description={t('ui.soitAucuneAlerteNAEte_14232')}
              icon="notifications-outline"
            />
          ) : (
            <View style={styles.liste}>
              {items.map((alert, index) => (
                <Reveal key={alert.id} index={index} variant="up">
                  <AlertCard
                    alert={alert}
                    locale={locale}
                    busy={occupee(alert.id)}
                    onRead={() => marquerLue.mutate(alert.id)}
                    onHandled={() => marquerTraitee.mutate(alert.id)}
                  />
                </Reveal>
              ))}
            </View>
          )}

          {meta && meta.totalPages > 1 ? (
            <View style={styles.pagination}>
              <Button
                label={t('common.previous')}
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
              />
              <Text preset="caption" color={COLORS.slateGray}>
                {meta.page}/{meta.totalPages}
              </Text>
              <Button
                label={t('common.next')}
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages}
                onPress={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              />
            </View>
          ) : null}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  compteur: { padding: SPACING.md },
  filtres: { gap: SPACING.sm },
  liste: { gap: SPACING.sm },
  card: { gap: SPACING.sm },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACING.sm },
  titres: { flex: 1, gap: 2 },
  pastilles: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, justifyContent: 'flex-end' },
  observation: { lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  cloture: { marginTop: SPACING.xs },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
});
