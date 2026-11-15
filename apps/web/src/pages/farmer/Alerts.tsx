import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
  Section,
  Text,
} from '@/components/ui';
import { alertApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { AlertFilterOption, AlertSourceType, DescribedAlert } from '@/services/types';
import { formatDate, type Locale } from '@/lib/format';
import { useI18n, tr } from '@/i18n';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';

/**
 * Écran 3 — boîte d'alertes.
 *
 * Trois sources, et elles n'appellent **pas** la même action : une mesure hors
 * seuil, un franchissement anticipé par la prévision, et un capteur silencieux
 * (une **absence** de remontée — jamais une mauvaise mesure).
 *
 * Le canal SMS reste primaire ; cet écran est le suivi et la clôture, pas le
 * déclencheur.
 *
 * ## Deux règles suivies ici
 *
 * 1. **Aucun libellé recopié.** Source, gravité, statut et grandeur arrivent
 *    nommés par l'API (`describeAlert`), et les valeurs des filtres viennent de
 *    `GET /alerts/meta`. Une valeur d'enum ajoutée côté serveur s'affiche et se
 *    filtre sans modifier ce fichier ; une table recopiée l'oublierait en
 *    silence.
 * 2. **Un seul sélecteur d'état.** `open` et `status` sont exclusifs côté API
 *    (422 sinon). Deux sélecteurs laisseraient croire que les deux filtres
 *    s'appliquent alors que l'un est rejeté.
 */

/** Gravité → ton visuel. C'est une mise en forme, pas un libellé. */
const SEVERITY_TONE = { INFO: 'info', WARNING: 'warning', CRITICAL: 'error' } as const;
const STATUS_TONE = { NEW: 'warning', READ: 'info', HANDLED: 'success' } as const;

const PAGE_SIZE = 20;

type EtatFiltre = 'TOUS' | 'OUVERTS' | 'NEW' | 'READ' | 'HANDLED';

/**
 * Construit les options d'état : les statuts nommés par l'API, plus les deux
 * vues transverses (« toutes » et « non traitées »).
 *
 * « Non traitées » n'est pas un statut — c'est `open=true`, qui couvre NEW et
 * READ. L'écrire comme un quatrième statut ferait croire à l'utilisateur que
 * `status` porte cette valeur.
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

/** Valeur observée face à sa plage — le cœur de l'écran. */
function ObservedVsRange({ alert }: { alert: DescribedAlert }) {
  const { t } = useI18n();
  const plage = alert.range;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Text preset="bodySm" color={COLORS.textPrimary}>
        {alert.observedLabel
          ? t('ui.observe', { observedLabel: alert.observedLabel })
          : alert.predictive
            ? t('ui.aucuneValeurObserveeFranchissementAnticipe')
            : t('ui.aucuneValeurObserveeTransmise')}{' '}{t('ui.seuil_65678', { referenceLabel: alert.referenceLabel })}</Text>

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

      {alert.deviation !== null ? (
        <Text preset="caption" color={COLORS.slateGray}>{t('ui.ecartAuSeuil', { deviation: alert.deviation, value: alert.unit ? ` ${alert.unit}` : '' })}</Text>
      ) : null}
    </div>
  );
}

/** Une alerte, avec ses actions. */
function AlertCard({
  alert,
  locale,
  onRead,
  onHandled,
  busy,
}: {
  alert: DescribedAlert;
  locale: Locale;
  onRead: () => void;
  onHandled: () => void;
  busy: boolean;
}) {
  const { t } = useI18n();
  const reference = alert.observedAt ?? alert.predictedBreachAt ?? alert.createdAt;

  return (
    <Card tone={alert.status === 'HANDLED' ? 'paper' : 'white'}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 8,
        }}
      >
        <div>
          <Text preset="bodyMd" style={{ marginBottom: 4 }}>
            {alert.parameterLabel}
          </Text>
          <Text preset="caption" color={COLORS.slateGray}>
            {alert.sourceTypeLabel} ·{' '}
            {alert.predictive ? t('ui.franchissementAnticipe') : t('ui.franchissementConstate')} ·{' '}
            {formatDate(reference, locale, 'datetime')}
          </Text>
        </div>
        <ChipRow>
          <Chip label={alert.severityLabel} tone={SEVERITY_TONE[alert.severity]} />
          <Chip label={alert.statusLabel} tone={STATUS_TONE[alert.status]} />
        </ChipRow>
      </div>

      <ObservedVsRange alert={alert} />

      {alert.channelsSent.length > 0 || alert.notificationCount > 1 ? (
        <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 8 }}>
          {alert.channelsSent.length > 0 ? t('ui.dejaTransmisePar', { value: alert.channelsSent.join(', ') }) : ''}
          {alert.notificationCount > 1 ? t('ui.notifications_533d3', { notificationCount: alert.notificationCount }) : ''}
        </Text>
      ) : null}

      {alert.status !== 'HANDLED' ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {alert.status === 'NEW' ? (
            <Button label={t('ui.marquerLue')} variant="outline" size="sm" loading={busy} onClick={onRead} />
          ) : null}
          <Button
            label={t('ui.marquerTraitee')}
            variant="primary"
            size="sm"
            loading={busy}
            onClick={onHandled}
          />
        </div>
      ) : (
        <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 12 }}>{t('ui.traiteeElleNeSeraPlusRappelee')}</Text>
      )}
    </Card>
  );
}

export default function FarmerAlerts() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const { locale } = useI18n();
  const queryClient = useQueryClient();

  const [etat, setEtat] = useState<EtatFiltre>('OUVERTS');
  /*
   * Typé `AlertSourceType` et non `string` : les options viennent de
   * `/alerts/meta`, donc une valeur inconnue du serveur ne peut pas arriver
   * jusqu'ici sans être rejetée par le compilateur.
   */
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all });
  };

  const marquerLue = useMutation({
    mutationFn: (id: string) => alertApi.markRead(id),
    onSuccess: invalidate,
  });

  const marquerTraitee = useMutation({
    mutationFn: (id: string) => alertApi.markHandled(id),
    onSuccess: invalidate,
  });

  const busyFor = (id: string) =>
    (marquerLue.isPending && marquerLue.variables === id) ||
    (marquerTraitee.isPending && marquerTraitee.variables === id);

  const items = alertes.data?.items ?? [];
  const meta = alertes.data;
  const options = filtres.data;

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title={t('ui.boiteDAlertes')} icon="🔔">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}
          style={{ maxWidth: 720 }}
        >
          <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.boiteDAlertes')}</Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 16 }}>{t('ui.franchissementsDeSeuilPrevisionsEtCapteurs')}</Text>

          {meta && meta.openCount > 0 ? (
            <Card tone="gold" style={{ marginBottom: 16 }}>
              <Text preset="bodySm">{t(meta.openCount > 1 ? 'ui.openAlertsInOrgOther' : 'ui.openAlertsInOrgOne', { openCount: meta.openCount })}</Text>
            </Card>
          ) : null}

          {options ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div>
                <Text preset="overline" color={COLORS.slateGray} style={{ marginBottom: 6 }}>{t('ui.etat')}</Text>
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
              </div>
              <div>
                <Text preset="overline" color={COLORS.slateGray} style={{ marginBottom: 6 }}>{t('ui.source_6da13')}</Text>
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
              </div>
            </div>
          ) : null}

          {alertes.isPending ? <LoadingState count={3} height={140} /> : null}
          {alertes.isError ? <ErrorState error={alertes.error} onRetry={() => alertes.refetch()} /> : null}

          {!alertes.isPending && !alertes.isError && items.length === 0 ? (
            <EmptyState
              icon="🔔"
              title={t('ui.aucuneAlertePourCeFiltre')}
              description={t('ui.soitAucuneAlerteNAEte')}
              action={
                etat !== 'TOUS' || source !== undefined
                  ? {
                      label: t('ui.voirToutesLesAlertes'),
                      onPress: () => {
                        setEtat('TOUS');
                        setSource(undefined);
                        setPage(1);
                      },
                    }
                  : undefined
              }
            />
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                locale={locale}
                busy={busyFor(alert.id)}
                onRead={() => marquerLue.mutate(alert.id)}
                onHandled={() => marquerTraitee.mutate(alert.id)}
              />
            ))}
          </div>

          {meta && meta.totalPages > 1 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginTop: 16,
              }}
            >
              <Button
                label={t('common.previous')}
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              />
              <Text preset="caption" color={COLORS.slateGray}>{t(meta.total > 1 ? 'ui.alertsPageOther' : 'ui.alertsPageOne', { page: meta.page, totalPages: meta.totalPages, total: meta.total })}</Text>
              <Button
                label={t('common.next')}
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              />
            </div>
          ) : null}
        </motion.div>
      </AuthGate>
    </Section>
  );
}
