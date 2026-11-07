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
import { useI18n } from '@/i18n';
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
    { value: 'TOUS', label: 'Toutes' },
    { value: 'OUVERTS', label: 'Non traitées' },
    ...statuts
      .filter((s) => s.value === 'NEW' || s.value === 'READ' || s.value === 'HANDLED')
      .map((s) => ({ value: s.value as EtatFiltre, label: s.label })),
  ];
}

/** Valeur observée face à sa plage — le cœur de l'écran. */
function ObservedVsRange({ alert }: { alert: DescribedAlert }) {
  const plage = alert.range;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Text preset="bodySm" color={COLORS.textPrimary}>
        {alert.observedLabel
          ? `Observé ${alert.observedLabel}`
          : alert.predictive
            ? 'Aucune valeur observée : franchissement anticipé'
            : 'Aucune valeur observée transmise'}
        {' · '}
        seuil {alert.referenceLabel}
      </Text>

      {plage?.label ? (
        <Text preset="caption" color={COLORS.slateGray}>
          Plage de référence {plage.label}
          {plage.status === 'PROVISIONAL'
            ? ' — provisoire : cette alerte ne repose pas sur un seuil validé'
            : plage.status
              ? ' — validée'
              : ''}
        </Text>
      ) : (
        /*
         * Absence de plage affichée comme telle : sans bornes, on peut dire
         * qu'un seuil a été franchi, pas situer la valeur observée.
         */
        <Text preset="caption" color={COLORS.slateGray}>
          Plage de référence non disponible pour cette grandeur
        </Text>
      )}

      {alert.deviation !== null ? (
        <Text preset="caption" color={COLORS.slateGray}>
          Écart au seuil {alert.deviation}
          {alert.unit ? ` ${alert.unit}` : ''}
        </Text>
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
            {alert.predictive ? 'franchissement anticipé' : 'franchissement constaté'} ·{' '}
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
          {alert.channelsSent.length > 0 ? `Déjà transmise par ${alert.channelsSent.join(', ')}` : ''}
          {alert.notificationCount > 1 ? ` · ${alert.notificationCount} notifications` : ''}
        </Text>
      ) : null}

      {alert.status !== 'HANDLED' ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {alert.status === 'NEW' ? (
            <Button label="Marquer lue" variant="outline" size="sm" loading={busy} onClick={onRead} />
          ) : null}
          <Button
            label="Marquer traitée"
            variant="primary"
            size="sm"
            loading={busy}
            onClick={onHandled}
          />
        </div>
      ) : (
        <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 12 }}>
          Traitée : elle ne sera plus rappelée.
        </Text>
      )}
    </Card>
  );
}

export default function FarmerAlerts() {
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
      <AuthGate isAuthenticated={isAuthenticated} title="Boîte d'alertes" icon="🔔">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}
          style={{ maxWidth: 720 }}
        >
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Boîte d'alertes
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 16 }}>
            Franchissements de seuil, prévisions et capteurs silencieux. Le canal principal reste le
            SMS : cet écran sert au suivi et à la clôture.
          </Text>

          {meta && meta.openCount > 0 ? (
            <Card tone="gold" style={{ marginBottom: 16 }}>
              <Text preset="bodySm">
                {meta.openCount} alerte{meta.openCount > 1 ? 's' : ''} non traitée
                {meta.openCount > 1 ? 's' : ''} dans votre organisation.
              </Text>
            </Card>
          ) : null}

          {options ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div>
                <Text preset="overline" color={COLORS.slateGray} style={{ marginBottom: 6 }}>
                  État
                </Text>
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
                <Text preset="overline" color={COLORS.slateGray} style={{ marginBottom: 6 }}>
                  Source
                </Text>
                <ChipRow>
                  <FilterChip
                    label="Toutes"
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
              title="Aucune alerte pour ce filtre"
              description="Soit aucune alerte n'a été déclenchée, soit le filtre sélectionné n'en retient aucune. Élargissez l'état ou la source pour vérifier."
              action={
                etat !== 'TOUS' || source !== undefined
                  ? {
                      label: 'Voir toutes les alertes',
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
                label="Précédent"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              />
              <Text preset="caption" color={COLORS.slateGray}>
                Page {meta.page} sur {meta.totalPages} · {meta.total} alerte
                {meta.total > 1 ? 's' : ''}
              </Text>
              <Button
                label="Suivant"
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
