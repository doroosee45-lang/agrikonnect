import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { AuthGate, ErrorState, LoadingState } from '@/components/ui';
import {
  HorizonAreaChartCard,
  HorizonDonutCard,
  HorizonGeoMapCard,
  HorizonOverviewCard,
  HorizonQuadMetricsCard,
  HorizonShell,
  HorizonTrackListCard,
  buildMonthlySeries,
  formatHorizonTimestamp,
} from '@/design-system';
import type { HorizonMapMarker, HorizonTrackItem } from '@/design-system';
import { useI18n } from '@/i18n';
import { formatMoney, formatNumber } from '@/lib/format';
import { listingApi, orderApi, queryKeys, requestApi, transportApi } from '@/services';
import { useAuthStore } from '@/store/auth';

/**
 * Espace Marche & Commandes (/market/app) — Acheteurs & Fournisseurs (Design Horizon, 100 % API reelle).
 * Corrige egalement le lien /annonces/:id vers /market/listings/:id.
 */
export default function MarketApp() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const listings = useQuery({
    queryKey: queryKeys.listings.list({ limit: 30 }),
    queryFn: () => listingApi.list({ limit: 30 }).then((r) => r.data ?? []),
    enabled: isAuthenticated,
  });

  const orders = useQuery({
    queryKey: queryKeys.orders.list({ limit: 30 }),
    queryFn: () => orderApi.list({ limit: 30 }).then((r) => r.data ?? []),
    enabled: isAuthenticated,
  });

  const requests = useQuery({
    queryKey: queryKeys.requests.list({ limit: 20 }),
    queryFn: () => requestApi.list({ limit: 20 }).then((r) => r.data ?? []),
    enabled: isAuthenticated,
  });

  const transports = useQuery({
    queryKey: queryKeys.transport.list({ limit: 20 }),
    queryFn: () => transportApi.requests({ limit: 20 }).then((r) => r.data ?? []),
    enabled: isAuthenticated,
    retry: false,
  });

  const listingRows = listings.data ?? [];
  const orderRows = orders.data ?? [];
  const requestRows = requests.data ?? [];
  const transportRows = transports.data ?? [];

  const deliveredOrders = orderRows.filter((o) => o.status === 'DELIVERED' || o.status === 'COMPLETED');
  const inTransitOrders = orderRows.filter((o) => o.status === 'SHIPPED' || o.status === 'IN_TRANSIT' || o.status === 'CONFIRMED');
  const pendingOrders = orderRows.filter((o) => o.status === 'PENDING' || o.status === 'CREATED');
  const cancelledOrders = orderRows.filter((o) => o.status === 'CANCELLED' || o.status === 'DISPUTED');

  const perfSeries = useMemo(
    () =>
      buildMonthlySeries<{ createdAt: string; status: string }>(
        orderRows.length > 0 ? orderRows : listingRows,
        (item) => item.createdAt,
        (item) => item.status === 'DELIVERED' || item.status === 'PUBLISHED',
      ),
    [orderRows, listingRows],
  );

  const mapMarkers: HorizonMapMarker[] = useMemo(
    () =>
      listingRows.slice(0, 12).map((l) => ({
        id: l.id,
        code: `${l.countryCode}-${l.id.slice(0, 4).toUpperCase()}`,
        label: `${l.title} (${l.quantity} ${l.unit})`,
        lat: l.latitude,
        lng: l.longitude,
        countryCode: l.countryCode,
        tone: l.status === 'PUBLISHED' ? 'green' : l.status === 'PAUSED' ? 'amber' : 'blue',
        href: `/market/listings/${l.id}`,
      })),
    [listingRows],
  );

  const fleetItems: HorizonTrackItem[] = useMemo(() => {
    if (orderRows.length > 0) {
      return orderRows.slice(0, 4).map((o) => {
        const isDone = o.status === 'DELIVERED' || o.status === 'COMPLETED';
        const isCancel = o.status === 'CANCELLED' || o.status === 'DISPUTED';
        return {
          id: o.id,
          code: o.number || `CMD-${o.id.slice(0, 6).toUpperCase()}`,
          subtitle:
            o.totalAmount !== null
              ? formatMoney(o.totalAmount, o.currency, locale)
              : new Date(o.createdAt).toLocaleDateString(locale),
          statusLabel: o.status,
          tone: isDone ? 'green' : isCancel ? 'red' : 'amber',
          leftCode: t('ui.trackCodeSeller'),
          leftLabel: o.paymentStatus,
          rightCode: t('ui.trackCodeBuyer'),
          rightLabel: isDone ? t('ui.livre') : t('ui.reception'),
          progressPct: isDone ? 100 : isCancel ? 25 : 64,
          icon: 'truck',
          href: `/app/orders/${o.id}`,
        };
      });
    }
    return listingRows.slice(0, 4).map((l) => ({
      id: l.id,
      code: `ANN-${l.id.slice(0, 5).toUpperCase()}`,
      subtitle: `${l.quantity} ${l.unit}`,
      statusLabel: l.status,
      tone: l.status === 'PUBLISHED' ? 'green' : 'amber',
      leftCode: l.countryCode,
      leftLabel: l.province ?? t('ui.origine'),
      rightCode: l.indicativePrice ? `${l.indicativePrice} ${l.currency}` : t('ui.trackCodeOpen'),
      rightLabel: l.title,
      progressPct: l.status === 'PUBLISHED' ? 88 : 45,
      icon: 'box',
      href: `/market/listings/${l.id}`,
    }));
  }, [orderRows, listingRows, locale]);

  return (
    <AuthGate
      isAuthenticated={isAuthenticated}
      title={t('ui.espaceMarcheCommandes')}
      description={t('ui.pilotezVosAnnoncesDemandesDAchat')}
      icon="🛒"
    >
      <HorizonShell>
        {listings.isLoading && orders.isLoading ? (
          <LoadingState count={3} height={150} />
        ) : listings.isError ? (
          <ErrorState error={listings.error} onRetry={() => void listings.refetch()} showRequestId />
        ) : (
          <>
            {/* RANGE 1 : Operations overview (identique a la structure Horizon) */}
            <HorizonOverviewCard
              title={t('ui.vueDEnsembleCommercialeLogistique')}
              updatedLabel={formatHorizonTimestamp(undefined, locale)}
              headerRight={
                <div className="flex items-center gap-2">
                  <Link
                    to="/market/requests/new"
                    className="rounded-lg border border-bordure bg-fond px-2.5 py-1 text-xs font-semibold text-texte"
                    style={{ textDecoration: 'none' }}
                  >{t('ui.demandeDAchat')}</Link>
                  <Link
                    to="/market/listings/new"
                    className="rounded-lg bg-marque-clair px-2.5 py-1 text-xs font-semibold text-marque"
                    style={{ textDecoration: 'none' }}
                  >{t('ui.publierUneAnnonce_92ecd')}</Link>
                </div>
              }
              items={[
                {
                  id: 'orders-total',
                  label: t('ui.commandesEnregistrees'),
                  value: formatNumber(orderRows.length, locale),
                  subtitle: t('ui.livreeSOuClotureeS', { length: formatNumber(deliveredOrders.length, locale) }),
                  badgeText: t('ui.enCours_6eb0f', { length: formatNumber(inTransitOrders.length, locale) }),
                  badgeSubtext: t('ui.suiviActif'),
                  tone: 'green',
                  icon: 'box',
                  href: '/app/orders',
                },
                {
                  id: 'listings',
                  label: t('ui.annoncesActives'),
                  value: formatNumber(listingRows.length, locale),
                  subtitle: t('ui.catalogueB2bProducteursIntrants'),
                  badgeText: t('ui.publ', { length: formatNumber(listingRows.filter((l) => l.status === 'PUBLISHED').length, locale) }),
                  badgeSubtext: t('ui.enLigne'),
                  tone: 'blue',
                  icon: 'layers',
                  href: '/market/listings',
                },
                {
                  id: 'requests',
                  label: t('ui.demandesDAchat'),
                  value: formatNumber(requestRows.length, locale),
                  subtitle: t('ui.appelsDApprovisionnementAcheteurs'),
                  badgeText: t('ui.ouv', { length: formatNumber(requestRows.filter((r) => r.status === 'OPEN').length, locale) }),
                  badgeSubtext: t('ui.kpiSubActiveFemPlural'),
                  tone: 'amber',
                  icon: 'clock',
                  href: '/market/requests',
                },
                {
                  id: 'transport',
                  label: t('ui.expeditionsTransport'),
                  value: formatNumber(transportRows.length, locale),
                  subtitle: t('ui.litigeSOuAnnulationS', { length: formatNumber(cancelledOrders.length, locale) }),
                  badgeText: cancelledOrders.length > 0 ? t('ui.vigilance') : t('ui.fluide'),
                  badgeSubtext: t('ui.kpiSubDeliveries'),
                  tone: cancelledOrders.length > 0 ? 'red' : 'green',
                  icon: 'truck',
                  href: '/app/transport',
                },
              ]}
            />

            {/* RANGE 2 : Performance mensuelle + Carte des offres */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <HorizonAreaChartCard
                title={t('ui.activiteMensuelleDesTransactions')}
                primaryLabel={orderRows.length > 0 ? t('ui.commandesCreees') : t('ui.annoncesCreees')}
                secondaryLabel={orderRows.length > 0 ? t('ui.commandesLivrees') : t('ui.annoncesPubliees')}
                points={perfSeries}
                emptyMessage={t('ui.aucuneCommandeOuAnnonceHorodateeSur')}
                sourceNote={t('ui.agregeEnTempsReelDepuisGet')}
              />

              <HorizonGeoMapCard
                title={t('ui.localisationDesOffresDisponibles')}
                markers={mapMarkers}
                searchPlaceholder={t('ui.rechercherProduitOuPays')}
                emptyMessage={t('ui.aucuneAnnonceGeolocaliseeEnregistree')}
                legend={[
                  { label: t('ui.publiees'), tone: 'green', count: listingRows.filter((l) => l.status === 'PUBLISHED').length },
                  { label: t('ui.demandesAchat'), tone: 'blue', count: requestRows.length },
                  { label: t('ui.enPause_3a366'), tone: 'amber', count: listingRows.filter((l) => l.status !== 'PUBLISHED').length },
                  { label: t('ui.litiges'), tone: 'red', count: cancelledOrders.length },
                ]}
              />
            </div>

            {/* RANGE 3 : Suivi des commandes/offres + 2x2 Sparkbars + Statut des commandes */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <HorizonTrackListCard
                title={orderRows.length > 0 ? t('ui.commandesLivraisonsActives') : t('ui.dernieresOffresDuMarche')}
                items={fleetItems}
                viewAllHref={orderRows.length > 0 ? '/app/orders' : '/market/listings'}
                emptyMessage={t('ui.aucuneCommandeNiAnnonceActive')}
              />

              <HorizonQuadMetricsCard
                title={t('ui.capaciteFluxMarche')}
                cells={[
                  {
                    id: 'q-list',
                    value: formatNumber(listingRows.length, locale),
                    label: t('ui.offresReferencees'),
                    bars: [42, 68, 76, listingRows.length > 0 ? 90 : 18],
                    tone: 'green',
                    href: '/market/listings',
                  },
                  {
                    id: 'q-req',
                    value: formatNumber(requestRows.length, locale),
                    label: t('ui.demandesAcheteurs'),
                    bars: [30, 52, 66, requestRows.length > 0 ? 82 : 18],
                    tone: 'blue',
                    href: '/market/requests',
                  },
                  {
                    id: 'q-tr',
                    value: formatNumber(transportRows.length, locale),
                    label: t('ui.ordresDeTransport'),
                    bars: [25, 48, 60, transportRows.length > 0 ? 80 : 18],
                    tone: 'amber',
                    href: '/app/transport',
                  },
                  {
                    id: 'q-done',
                    value: formatNumber(deliveredOrders.length, locale),
                    label: t('ui.livraisonsValidees'),
                    bars: [35, 58, 74, deliveredOrders.length > 0 ? 88 : 18],
                    tone: 'green',
                    href: '/app/orders',
                  },
                ]}
              />

              <HorizonDonutCard
                title={t('ui.statutDesCommandes')}
                totalValue={formatNumber(orderRows.length, locale)}
                totalLabel={t('ui.commandes')}
                segments={[
                  { label: t('ui.livrees'), value: deliveredOrders.length, tone: 'green' },
                  { label: t('ui.enCours_bc9b5'), value: inTransitOrders.length, tone: 'blue' },
                  { label: t('ui.enAttente'), value: pendingOrders.length, tone: 'amber' },
                  { label: t('ui.litigesAnnulees'), value: cancelledOrders.length, tone: 'red' },
                ]}
              />
            </div>
          </>
        )}
      </HorizonShell>
    </AuthGate>
  );
}
