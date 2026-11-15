import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { StatusChip } from '@/components/pages';
import { AuthGate, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import {
  HorizonAreaChartCard,
  HorizonDonutCard,
  HorizonOverviewCard,
  HorizonQuadMetricsCard,
  HorizonShell,
  HorizonTrackListCard,
  buildMonthlySeries,
  formatHorizonTimestamp,
} from '@/design-system';
import type { HorizonTrackItem } from '@/design-system';
import { useI18n } from '@/i18n';
import { formatDate, formatNumber } from '@/lib/format';
import { queryKeys, transportApi } from '@/services';
import { useAuthStore } from '@/store/auth';

/** Espace Transporteur & Logistique (/app/transport) — Design Horizon 100 % API reelle. */
export default function AppTransport() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const requestsQuery = useQuery({
    queryKey: queryKeys.transport.list({ limit: 100 }),
    queryFn: () => transportApi.requests({ limit: 100 }).then((r) => r.data ?? []),
    enabled: isAuthenticated,
  });

  const rows = requestsQuery.data ?? [];
  const openRows = rows.filter((r) => r.status === 'OPEN' || r.status === 'PENDING');
  const assignedRows = rows.filter((r) => Boolean(r.transporterOrgId) && r.status !== 'DELIVERED');
  const deliveredRows = rows.filter((r) => r.status === 'DELIVERED' || Boolean(r.proof));
  const cancelledRows = rows.filter((r) => r.status === 'CANCELLED');

  const series = useMemo(
    () =>
      buildMonthlySeries(
        rows,
        (r) => r.createdAt,
        (r) => r.status === 'DELIVERED' || Boolean(r.proof),
      ),
    [rows],
  );

  const activeFleet: HorizonTrackItem[] = useMemo(
    () =>
      rows.slice(0, 4).map((req) => {
        const pickupCity = String(
          (req.pickup as Record<string, unknown> | null)?.city ??
            (req.pickup as Record<string, unknown> | null)?.province ??
            t('ui.enlevement'),
        );
        const dropoffCity = String(
          (req.dropoff as Record<string, unknown> | null)?.city ??
            (req.dropoff as Record<string, unknown> | null)?.province ??
            t('ui.destination'),
        );
        const isDelivered = req.status === 'DELIVERED' || Boolean(req.proof);
        return {
          id: req.id,
          code: `TRP-${req.id.slice(0, 6).toUpperCase()}`,
          subtitle: formatDate(req.createdAt, locale),
          statusLabel: req.status,
          tone: isDelivered ? 'green' : req.transporterOrgId ? 'blue' : 'amber',
          leftCode: pickupCity.slice(0, 8).toUpperCase(),
          leftLabel: t('ui.depart'),
          rightCode: dropoffCity.slice(0, 8).toUpperCase(),
          rightLabel: t('ui.arrivee'),
          progressPct: isDelivered ? 100 : req.transporterOrgId ? 65 : 25,
          icon: 'truck',
          href: `/app/orders/${req.orderId}`,
        };
      }),
    [rows, locale],
  );

  return (
    <AuthGate
      isAuthenticated={isAuthenticated}
      title={t('ui.flotteDemandesDeTransport')}
      description={t('ui.suiviDesEnlevementsAttributionsTransporteursEt')}
      icon="🚚"
    >
      <HorizonShell>
        {requestsQuery.isLoading ? (
          <LoadingState count={3} height={150} />
        ) : requestsQuery.isError ? (
          <ErrorState error={requestsQuery.error} onRetry={() => void requestsQuery.refetch()} showRequestId />
        ) : (
          <>
            <HorizonOverviewCard
              title={t('ui.vueDEnsembleLogistiqueTransport')}
              updatedLabel={formatHorizonTimestamp(undefined, locale)}
              items={[
                {
                  id: 'all',
                  label: t('ui.demandesDeTransport'),
                  value: formatNumber(rows.length, locale),
                  subtitle: t('ui.totalEnregistreSurLePerimetre'),
                  badgeText: t('ui.countOpenFemPlural', { count: formatNumber(openRows.length, locale) }),
                  badgeSubtext: t('ui.aAttribuer'),
                  tone: 'green',
                  icon: 'truck',
                },
                {
                  id: 'assigned',
                  label: t('ui.missionsEnTransit'),
                  value: formatNumber(assignedRows.length, locale),
                  subtitle: t('ui.transporteurAttribue'),
                  badgeText: t('ui.enRoute'),
                  badgeSubtext: t('ui.kpiSubTracking'),
                  tone: 'blue',
                  icon: 'map',
                },
                {
                  id: 'delivered',
                  label: t('ui.preuvesDeLivraison'),
                  value: formatNumber(deliveredRows.length, locale),
                  subtitle: t('ui.livraisonsConfirmeesPod'),
                  badgeText:
                    rows.length > 0 ? `${Math.round((deliveredRows.length / rows.length) * 100)}%` : '0%',
                  badgeSubtext: t('ui.completees'),
                  tone: 'green',
                  icon: 'check',
                },
                {
                  id: 'open',
                  label: t('ui.enAttenteDOffre'),
                  value: formatNumber(openRows.length, locale),
                  subtitle: t('ui.annuleeS', { length: formatNumber(cancelledRows.length, locale) }),
                  badgeText: openRows.length > 0 ? t('ui.offresOuvertes') : t('ui.aJour'),
                  badgeSubtext: t('ui.kpiSubCalls'),
                  tone: openRows.length > 0 ? 'amber' : 'neutral',
                  icon: 'clock',
                },
              ]}
            />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <HorizonTrackListCard
                title={t('ui.flotteExpeditionsActives')}
                items={activeFleet}
                emptyMessage={t('ui.aucuneExpeditionActiveEnregistree')}
              />

              <HorizonQuadMetricsCard
                title={t('ui.statutDeChargement')}
                cells={[
                  {
                    id: 't-open',
                    value: formatNumber(openRows.length, locale),
                    label: t('ui.attenteTransporteur'),
                    bars: [35, 58, 72, openRows.length > 0 ? 86 : 18],
                    tone: 'amber',
                  },
                  {
                    id: 't-transit',
                    value: formatNumber(assignedRows.length, locale),
                    label: t('ui.enAcheminement'),
                    bars: [42, 66, 78, assignedRows.length > 0 ? 88 : 18],
                    tone: 'blue',
                  },
                  {
                    id: 't-pod',
                    value: formatNumber(deliveredRows.length, locale),
                    label: t('ui.preuvesDeposees'),
                    bars: [38, 64, 80, deliveredRows.length > 0 ? 92 : 18],
                    tone: 'green',
                  },
                  {
                    id: 't-cancel',
                    value: formatNumber(cancelledRows.length, locale),
                    label: t('ui.missionsAnnulees'),
                    bars: [20, 34, 28, cancelledRows.length > 0 ? 60 : 16],
                    tone: 'red',
                  },
                ]}
              />

              <HorizonDonutCard
                title={t('ui.repartitionDesExpeditions')}
                totalValue={formatNumber(rows.length, locale)}
                totalLabel={t('ui.missions')}
                segments={[
                  { label: t('ui.livreesPod'), value: deliveredRows.length, tone: 'green' },
                  { label: t('ui.enTransit'), value: assignedRows.length, tone: 'blue' },
                  { label: t('ui.ouvertes'), value: openRows.length, tone: 'amber' },
                  { label: t('ui.annulees'), value: cancelledRows.length, tone: 'red' },
                ]}
              />
            </div>

            <HorizonAreaChartCard
              title={t('ui.fluxMensuelDesDemandesDeTransport')}
              primaryLabel={t('ui.demandesCreees')}
              secondaryLabel={t('ui.missionsLivrees')}
              points={series}
              emptyMessage={t('ui.aucuneDemandeDeTransportHorodateeSur')}
            />

            {/* Registre complet des demandes */}
            <section className="rounded-carte border border-bordure bg-surface p-5 shadow-2xs">
              <h3 className="mb-3 text-[15px] font-bold text-texte" style={{ margin: '0 0 12px 0' }}>{t('ui.registreDesDemandesDeTransport', { length: rows.length })}</h3>
              {rows.length === 0 ? (
                <EmptyState
                  icon="🚚"
                  title={t('ui.aucuneDemandeDeTransport')}
                  description={t('ui.lesDemandesLieesAuxCommandesApparaitront')}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-bordure text-texte-doux">
                        <th className="py-2.5 pr-4 font-semibold">{t('ui.commande')}</th>
                        <th className="py-2.5 pr-4 font-semibold">{t('ui.statut')}</th>
                        <th className="py-2.5 pr-4 font-semibold">{t('ui.transporteur')}</th>
                        <th className="py-2.5 font-semibold">{t('ui.creeeLe')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((request) => (
                        <tr key={request.id} className="border-b border-bordure/60 last:border-b-0">
                          <td className="py-2.5 pr-4 font-mono font-semibold text-texte">
                            {request.orderId}
                          </td>
                          <td className="py-2.5 pr-4">
                            <StatusChip value={request.status} />
                          </td>
                          <td className="py-2.5 pr-4 text-texte-doux">
                            {request.transporterOrgId ?? t('ui.nonAttribue')}
                          </td>
                          <td className="py-2.5 text-texte-doux">
                            {formatDate(request.createdAt, locale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </HorizonShell>
    </AuthGate>
  );
}
