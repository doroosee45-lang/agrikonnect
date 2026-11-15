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
import { formatAreaHa, formatNumber, formatWeightKg } from '@/lib/format';
import {
  alertApi,
  dashboardApi,
  lotApi,
  plotApi,
  productionApi,
  queryKeys,
} from '@/services';
import { useAuthStore } from '@/store/auth';

interface Completeness {
  done: number;
  total: number;
  missing?: string[];
}

interface DashboardTiles {
  totalAreaHa?: number;
  plots?: number;
  activeCrops?: number;
  productionKg?: number;
  profileViews?: number;
  profileCompleteness?: Completeness;
}

interface FarmerDashboardPayload {
  tiles?: DashboardTiles;
  farms?: Array<{
    id: string;
    name: string;
    slug: string;
    countryCode?: string;
    totalAreaHa?: number | null;
    verificationStatus?: string | null;
  }>;
  onboarding?: Array<{ key: string; label?: string; done: boolean }>;
}

/** Espace Producteur (/farmer) — Tableau de bord Horizon 100 % branche sur l'API reelle. */
export default function FarmerHome() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const dashboard = useQuery({
    queryKey: queryKeys.dashboard.farmer,
    queryFn: () => dashboardApi.farmer().then((r) => r.data as FarmerDashboardPayload),
    enabled: isAuthenticated,
  });

  const plotsQuery = useQuery({
    queryKey: ['farmer', 'horizon', 'plots'],
    queryFn: () => plotApi.list({ limit: 20 }).then((r) => r.data ?? []),
    enabled: isAuthenticated,
    retry: false,
  });

  const productionsQuery = useQuery({
    queryKey: ['farmer', 'horizon', 'productions'],
    queryFn: () => productionApi.list({ limit: 30 }).then((r) => r.data ?? []),
    enabled: isAuthenticated,
    retry: false,
  });

  const alertsQuery = useQuery({
    queryKey: ['farmer', 'horizon', 'alerts-open'],
    queryFn: () => alertApi.list({ open: true, limit: 10 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const lotsQuery = useQuery({
    queryKey: ['farmer', 'horizon', 'lots'],
    queryFn: () => lotApi.list({ limit: 6 }).then((r) => r.data ?? []),
    enabled: isAuthenticated,
    retry: false,
  });

  const tiles = dashboard.data?.tiles ?? {};
  const farms = dashboard.data?.farms ?? [];
  const onboarding = dashboard.data?.onboarding ?? [];
  const completeness = tiles.profileCompleteness;
  const plots = plotsQuery.data ?? [];
  const productions = productionsQuery.data ?? [];
  const openAlerts = alertsQuery.data?.items ?? [];
  const lots = lotsQuery.data ?? [];

  const harvestSeries = useMemo(
    () =>
      buildMonthlySeries(
        productions,
        (p) => p.harvestedAt || p.createdAt,
        (p) => p.source !== 'declared',
      ),
    [productions],
  );

  const mapMarkers: HorizonMapMarker[] = useMemo(() => {
    if (plots.length > 0) {
      return plots.slice(0, 12).map((p) => ({
        id: p.id,
        code: p.name.slice(0, 10).toUpperCase(),
        label: `${p.name}${p.areaHa ? ` · ${p.areaHa} ha` : ''}`,
        lat: p.latitude,
        lng: p.longitude,
        tone: p.status === 'ACTIVE' ? 'green' : p.status === 'FALLOW' ? 'amber' : 'blue',
        href: `/farmer/plots/${p.id}`,
      }));
    }
    return farms.map((f) => ({
      id: f.id,
      code: (f.slug || f.name).slice(0, 10).toUpperCase(),
      label: f.name,
      countryCode: f.countryCode ?? 'CD',
      tone: f.verificationStatus === 'VERIFIED' ? 'green' : 'amber',
      href: `/farmer/farms/${f.id}`,
    }));
  }, [plots, farms]);

  const trackItems: HorizonTrackItem[] = useMemo(() => {
    if (lots.length > 0) {
      return lots.slice(0, 4).map((lot) => {
        const id = String(lot.id ?? '');
        const code = String(lot.code ?? `LOT-${id.slice(0, 6).toUpperCase()}`);
        const status = String(lot.status ?? 'CREATED');
        const qty = lot.quantityKg ? `${Number(lot.quantityKg)} kg` : t('ui.qrTraceabilityLabel');
        return {
          id,
          code,
          subtitle: qty,
          statusLabel: status === 'RECALLED' ? t('ui.rappele') : status === 'PUBLISHED' ? t('ui.publie') : t('ui.actif'),
          tone: status === 'RECALLED' ? 'red' : 'green',
          leftCode: t('ui.trackCodeHarvest'),
          leftLabel: t('ui.parcelle'),
          rightCode: 'QR',
          rightLabel: t('ui.fichePublique'),
          progressPct: status === 'PUBLISHED' ? 100 : 68,
          icon: 'box',
          href: `/farmer/lots/${id}`,
        };
      });
    }
    return productions.slice(0, 4).map((prod) => ({
      id: prod.id,
      code: `REC-${prod.id.slice(0, 6).toUpperCase()}`,
      subtitle: new Date(prod.harvestedAt).toLocaleDateString(locale),
      statusLabel: prod.source === 'declared' ? t('ui.declaree') : t('ui.verifiee'),
      tone: prod.source === 'declared' ? 'amber' : 'green',
      leftCode: prod.season || t('ui.trackCodeSeason'),
      leftLabel: t('ui.campagne'),
      rightCode: `${prod.quantity} ${prod.unit}`,
      rightLabel: prod.destination ?? t('ui.stock'),
      progressPct: prod.source === 'declared' ? 60 : 100,
      icon: 'leaf',
      href: `/farmer/productions/${prod.id}`,
    }));
  }, [lots, productions, locale]);

  const doneCount = completeness?.done ?? onboarding.filter((s) => s.done).length;
  const totalCriteria = completeness?.total ?? Math.max(1, onboarding.length);
  const missingCount = Math.max(0, totalCriteria - doneCount);
  const verifiedFarms = farms.filter((f) => f.verificationStatus === 'VERIFIED').length;

  return (
    <AuthGate
      isAuthenticated={isAuthenticated}
      title={t('ui.espaceProducteur')}
      description={t('ui.pilotezVosExploitationsVosParcellesVos')}
      icon="🌾"
    >
      <HorizonShell>
        {dashboard.isLoading ? (
          <LoadingState count={3} height={150} />
        ) : dashboard.isError ? (
          <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} showRequestId />
        ) : (
          <>
            {/* RANGE 1 : Vue d'ensemble des operations agricoles */}
            <HorizonOverviewCard
              title={t('ui.vueDEnsembleDeLExploitation')}
              updatedLabel={formatHorizonTimestamp(undefined, locale)}
              headerRight={
                <Link
                  to="/farmer/harvests/new"
                  className="rounded-lg bg-marque-clair px-2.5 py-1 text-xs font-semibold text-marque"
                  style={{ textDecoration: 'none' }}
                >{t('ui.declarerUneRecolte_6f02c')}</Link>
              }
              items={[
                {
                  id: 'area',
                  label: t('ui.surfaceCumulee'),
                  value: formatAreaHa(tiles.totalAreaHa ?? 0, locale),
                  subtitle: t('ui.exploitationSActiveS', { length: formatNumber(farms.length, locale) }),
                  badgeText: t('ui.parc', { value: formatNumber(tiles.plots ?? plots.length, locale) }),
                  badgeSubtext: t('ui.cadastrees'),
                  tone: 'green',
                  icon: 'map',
                  href: '/farmer/farms',
                },
                {
                  id: 'crops',
                  label: t('ui.culturesEnPlace'),
                  value: formatNumber(tiles.activeCrops ?? 0, locale),
                  subtitle: t('ui.assolementEtItinerairesActifs'),
                  badgeText: `${formatNumber(plots.filter((p) => p.latitude !== null).length, locale)} GPS`,
                  badgeSubtext: t('ui.geolocalisees'),
                  tone: 'blue',
                  icon: 'leaf',
                  href: '/farmer/plots',
                },
                {
                  id: 'production',
                  label: t('ui.productionDeclaree'),
                  value: formatWeightKg(tiles.productionKg ?? 0, locale),
                  subtitle: t('ui.saisieSEnregistreeS', { length: formatNumber(productions.length, locale) }),
                  badgeText: t('ui.lotS', { length: formatNumber(lots.length, locale) }),
                  badgeSubtext: t('ui.tracables'),
                  tone: 'amber',
                  icon: 'box',
                  href: '/farmer/productions',
                },
                {
                  id: 'alerts',
                  label: t('ui.alertesVisibilite'),
                  value: formatNumber(openAlerts.length, locale),
                  unit: t('ui.kpiSubOpenFemPlural'),
                  subtitle: t('ui.consultationSFichePublique', { value: formatNumber(tiles.profileViews ?? 0, locale) }),
                  badgeText: openAlerts.length > 0 ? t('ui.actionRequise') : 'RAS',
                  badgeSubtext: t('ui.kpiSubField'),
                  tone: openAlerts.length > 0 ? 'red' : 'green',
                  icon: 'alert',
                  href: '/farmer/alerts',
                },
              ]}
            />

            {/* RANGE 2 : Rythme des recoltes (50 %) + Carte parcellaire GPS (50 %) */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <HorizonAreaChartCard
                title={t('ui.historiqueDesRecoltesParMois')}
                primaryLabel={t('ui.recoltesSaisies')}
                secondaryLabel={t('ui.lotsMesuresVerifiees')}
                points={harvestSeries}
                emptyMessage={t('ui.aucuneRecolteHorodateePourLeMoment')}
                sourceNote={t('ui.calculeDepuisVosEnregistrementsGetProductions')}
              />

              <HorizonGeoMapCard
                title={t('ui.carteParcellaireExploitations')}
                markers={mapMarkers}
                searchPlaceholder={t('ui.rechercherUneParcelle')}
                emptyMessage={t('ui.aucuneParcelleEnregistreeCreezUneParcelle')}
                legend={[
                  { label: t('ui.parcellesActives'), tone: 'green', count: plots.filter((p) => p.status === 'ACTIVE').length || plots.length },
                  { label: t('ui.exploitations'), tone: 'blue', count: farms.length },
                  { label: t('ui.jachereAttente'), tone: 'amber', count: plots.filter((p) => p.status !== 'ACTIVE').length },
                  { label: t('ui.alertesOuvertes'), tone: 'red', count: openAlerts.length },
                ]}
              />
            </div>

            {/* RANGE 3 : Lots & recoltes actifs + Grille 2x2 + Anneau de completude */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <HorizonTrackListCard
                title={lots.length > 0 ? t('ui.lotsTracabiliteEnCours') : t('ui.dernieresRecoltesEnregistrees')}
                items={trackItems}
                viewAllHref={lots.length > 0 ? '/farmer/lots' : '/farmer/productions'}
                emptyMessage={t('ui.aucunLotNiRecolteActiveVos')}
              />

              <HorizonQuadMetricsCard
                title={t('ui.etatOperationnelDuDomaine')}
                cells={[
                  {
                    id: 'farms-q',
                    value: formatNumber(farms.length, locale),
                    label: t('ui.exploitationsGerees'),
                    bars: [45, 70, 60, farms.length > 0 ? 90 : 20],
                    tone: 'green',
                    href: '/farmer/farms',
                  },
                  {
                    id: 'plots-q',
                    value: formatNumber(tiles.plots ?? plots.length, locale),
                    label: t('ui.parcellesCadastrees'),
                    bars: [38, 64, 82, plots.length > 0 ? 88 : 20],
                    tone: 'blue',
                    href: '/farmer/plots',
                  },
                  {
                    id: 'lots-q',
                    value: formatNumber(lots.length, locale),
                    label: t('ui.lotsDeTracabilite'),
                    bars: [30, 52, 68, lots.length > 0 ? 84 : 18],
                    tone: 'amber',
                    href: '/farmer/lots',
                  },
                  {
                    id: 'views-q',
                    value: formatNumber(tiles.profileViews ?? 0, locale),
                    label: t('ui.vuesFichePublique'),
                    bars: [28, 48, 62, (tiles.profileViews ?? 0) > 0 ? 80 : 18],
                    tone: 'green',
                    href: '/farmer/documents',
                  },
                ]}
              />

              <HorizonDonutCard
                title={t('ui.completudeVerification')}
                totalValue={`${doneCount}/${totalCriteria}`}
                totalLabel={t('ui.criteresValides')}
                segments={[
                  { label: t('ui.criteresRemplis'), value: doneCount, tone: 'green' },
                  { label: t('ui.exploitationsVerifiees'), value: verifiedFarms, tone: 'blue' },
                  { label: t('ui.criteresManquants'), value: missingCount, tone: 'amber' },
                  { label: t('ui.alertesOuvertes'), value: openAlerts.length, tone: 'red' },
                ]}
              />
            </div>

            {/* Rappel transparent des etapes d'onboarding restantes si pertinent */}
            {onboarding.some((s) => !s.done) ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-bordure bg-surface px-4 py-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-texte">{t('ui.prochainesEtapesRecommandees')}</span>
                  {onboarding
                    .filter((s) => !s.done)
                    .slice(0, 3)
                    .map((step) => (
                      <span
                        key={step.key}
                        className="rounded-full bg-fond px-2.5 py-1 font-medium text-texte-doux"
                      >
                        • {step.label ?? step.key}
                      </span>
                    ))}
                </div>
                <Link to="/farmer/onboarding" className="font-semibold text-marque hover:underline">{t('ui.completerLeParcours')}</Link>
              </div>
            ) : null}
          </>
        )}
      </HorizonShell>
    </AuthGate>
  );
}
