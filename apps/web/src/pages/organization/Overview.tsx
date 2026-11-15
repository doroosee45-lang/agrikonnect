import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { AuthGate, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import {
  HorizonDonutCard,
  HorizonOverviewCard,
  HorizonQuadMetricsCard,
  HorizonShell,
  HorizonTrackListCard,
  formatHorizonTimestamp,
} from '@/design-system';
import type { HorizonTrackItem } from '@/design-system';
import { useI18n } from '@/i18n';
import { formatAreaHa, formatNumber, formatWeightKg } from '@/lib/format';
import { cooperativeApi, queryKeys } from '@/services';
import { useAuthStore } from '@/store/auth';

/**
 * Vue consolidee de la cooperative (/organization/overview) — Design Horizon.
 * Affiche explicitement le perimetre de consentement COOP-03 et la repartition par culture.
 */
export default function OrganizationOverview() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const coop = useQuery({
    queryKey: queryKeys.cooperatives.current,
    queryFn: () => cooperativeApi.current().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const coopId = coop.data?.id ?? '';
  const coopName = coop.data?.organization?.name ?? t('ui.cooperative');

  const overview = useQuery({
    queryKey: queryKeys.cooperatives.overview(coopId),
    queryFn: () => cooperativeApi.overview(coopId).then((r) => r.data),
    enabled: isAuthenticated && Boolean(coopId),
  });

  const ov = overview.data;
  const byCrop = ov?.productions.byCrop ?? [];
  const totalKg = byCrop.reduce((acc, row) => acc + (Number(row.quantityKg) || 0), 0);

  const cropTracks: HorizonTrackItem[] = byCrop.map((row, idx) => ({
    id: `${row.cropId}-${idx}`,
    code: (row.crop || row.cropId).slice(0, 10).toUpperCase(),
    subtitle: t('ui.saisieS', { records: formatNumber(row.records, locale) }),
    statusLabel: formatWeightKg(row.quantityKg, locale),
    tone: idx % 2 === 0 ? 'green' : 'blue',
    leftCode: t('ui.trackCodeMembers'),
    leftLabel: t('ui.declarations'),
    rightCode: 'COOP',
    rightLabel: t('ui.consolide'),
    progressPct: totalKg > 0 ? Math.min(100, Math.max(15, Math.round((row.quantityKg / totalKg) * 100))) : 50,
    icon: 'leaf',
    href: '/organization/collection',
  }));

  return (
    <AuthGate
      isAuthenticated={isAuthenticated}
      title={t('ui.vueDEnsembleCooperative')}
      description={t('ui.agregationStricteDesMembresAyantConsenti')}
      icon="📊"
    >
      <HorizonShell>
        {coop.isLoading || overview.isLoading ? (
          <LoadingState count={3} height={140} />
        ) : coop.isError || !coop.data ? (
          <EmptyState
            icon="🤝"
            title={t('ui.aucuneCooperativeRattacheeALOrganisation')}
            description={t('ui.selectionnezUneOrganisationDisposantDUne')}
          />
        ) : overview.isError || !ov ? (
          <ErrorState error={overview.error} onRetry={() => void overview.refetch()} showRequestId />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-bordure bg-marque-clair/45 px-4 py-3 text-xs text-texte">
              <div>
                <span className="font-bold text-marque">{t('ui.perimetreDesDonneesCoop03')}{' '}</span>
                <span>{ov.plots.scope}</span>
                <span className="ml-2 text-texte-doux">({ov.productions.source})</span>
              </div>
              <Link to="/organization/members" className="font-semibold text-marque hover:underline">{t('ui.gererLesMembres')}</Link>
            </div>

            <HorizonOverviewCard
              title={t('ui.consolidation', { coopName })}
              updatedLabel={formatHorizonTimestamp(undefined, locale)}
              items={[
                {
                  id: 'total-members',
                  label: t('ui.membresTotaux'),
                  value: formatNumber(ov.members.total, locale),
                  subtitle: t('ui.avecConsentementActif', { withPlotsConsent: formatNumber(ov.members.withPlotsConsent, locale) }),
                  badgeText:
                    ov.members.total > 0
                      ? `${Math.round((ov.members.withPlotsConsent / ov.members.total) * 100)}%`
                      : '0%',
                  badgeSubtext: t('ui.kpiSubSharing'),
                  tone: 'green',
                  icon: 'users',
                  href: '/organization/members',
                },
                {
                  id: 'plots',
                  label: t('ui.parcellesPartagees'),
                  value: formatNumber(ov.plots.count, locale),
                  subtitle: t('ui.membresAyantAccordePlotsShare'),
                  badgeText: formatAreaHa(ov.plots.totalAreaHa, locale),
                  badgeSubtext: t('ui.cumules'),
                  tone: 'blue',
                  icon: 'map',
                },
                {
                  id: 'kg',
                  label: t('ui.recoltesConsolidees'),
                  value: formatWeightKg(totalKg, locale),
                  subtitle: ov.productions.scope,
                  badgeText: t('ui.cultureS', { length: formatNumber(byCrop.length, locale) }),
                  badgeSubtext: t('ui.kpiSubActiveFemPlural'),
                  tone: 'amber',
                  icon: 'box',
                  href: '/organization/collection',
                },
                {
                  id: 'sales',
                  label: t('ui.commercialisationGroupee'),
                  value: formatNumber(byCrop.reduce((a, r) => a + r.records, 0), locale),
                  unit: 'lots',
                  subtitle: t('ui.agregesDepuisLesDeclarationsMembres'),
                  badgeText: t('ui.ventes'),
                  badgeSubtext: t('ui.groupees'),
                  tone: 'green',
                  icon: 'truck',
                  href: '/organization/group-sales',
                },
              ]}
            />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <HorizonTrackListCard
                title={t('ui.recoltesConsolideesParFiliere')}
                items={cropTracks}
                viewAllHref="/organization/collection"
                emptyMessage={t('ui.aucuneRecoltePartageeParLesMembres')}
              />

              <HorizonQuadMetricsCard
                title={t('ui.indicateursDeCouverture')}
                cells={[
                  {
                    id: 'c1',
                    value: formatNumber(ov.members.total, locale),
                    label: t('ui.adherentsCooperative'),
                    bars: [40, 62, 78, 92],
                    tone: 'green',
                  },
                  {
                    id: 'c2',
                    value: formatNumber(ov.members.withPlotsConsent, locale),
                    label: t('ui.consentementsActifs'),
                    bars: [30, 54, 70, 85],
                    tone: 'blue',
                  },
                  {
                    id: 'c3',
                    value: formatNumber(ov.plots.count, locale),
                    label: t('ui.parcellesVisibles'),
                    bars: [25, 48, 68, 82],
                    tone: 'amber',
                  },
                  {
                    id: 'c4',
                    value: formatNumber(byCrop.length, locale),
                    label: t('ui.filieresActives'),
                    bars: [22, 44, 60, 76],
                    tone: 'green',
                  },
                ]}
              />

              <HorizonDonutCard
                title={t('ui.partageDesDonneesMembres')}
                totalValue={formatNumber(ov.members.total, locale)}
                totalLabel={t('ui.membres')}
                segments={[
                  { label: t('ui.avecConsentement'), value: ov.members.withPlotsConsent, tone: 'green' },
                  {
                    label: t('ui.horsPerimetre'),
                    value: Math.max(0, ov.members.total - ov.members.withPlotsConsent),
                    tone: 'neutral',
                  },
                ]}
              />
            </div>
          </>
        )}
      </HorizonShell>
    </AuthGate>
  );
}
