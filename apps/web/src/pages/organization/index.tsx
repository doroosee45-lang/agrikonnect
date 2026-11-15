import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { AuthGate, Button, ErrorState, LoadingState } from '@/components/ui';
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
import { getActiveOrganizationId, setActiveOrganizationId } from '@/lib/redirects';
import { cooperativeApi, organizationApi, queryKeys } from '@/services';
import { useAuthStore } from '@/store/auth';

/**
 * Espace Organisation & Cooperative (/organization) — Design Horizon 100 % API reelle.
 * Respecte strictement le perimetre de consentement des membres (COOP-03).
 */
export default function OrganizationHome() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const activeOrgId = getActiveOrganizationId();

  const organizations = useQuery({
    queryKey: queryKeys.organizations.all,
    queryFn: () => organizationApi.list().then((r) => r.data ?? []),
    enabled: isAuthenticated,
  });

  const coop = useQuery({
    queryKey: queryKeys.cooperatives.current,
    queryFn: () => cooperativeApi.current().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const coopId = coop.data?.id ?? '';
  const coopName = coop.data?.organization?.name ?? t('ui.cooperativeActive');

  const overview = useQuery({
    queryKey: queryKeys.cooperatives.overview(coopId),
    queryFn: () => cooperativeApi.overview(coopId).then((r) => r.data),
    enabled: isAuthenticated && Boolean(coopId),
    retry: false,
  });

  const membersQuery = useQuery({
    queryKey: ['organization', 'horizon', 'members', coopId],
    queryFn: () => cooperativeApi.members(coopId, { limit: 30 }).then((r) => r.data ?? []),
    enabled: isAuthenticated && Boolean(coopId),
    retry: false,
  });

  const groupOffersQuery = useQuery({
    queryKey: ['organization', 'horizon', 'group-offers', coopId],
    queryFn: () => cooperativeApi.groupOffers(coopId).then((r) => r.data ?? []),
    enabled: isAuthenticated && Boolean(coopId),
    retry: false,
  });

  const orgs = organizations.data ?? [];
  const members = membersQuery.data ?? [];
  const groupOffers = groupOffersQuery.data ?? [];
  const ov = overview.data;

  const totalMembers = ov?.members.total ?? members.length;
  const consentedMembers = ov?.members.withPlotsConsent ?? 0;
  const plotsCount = ov?.plots.count ?? 0;
  const totalAreaHa = ov?.plots.totalAreaHa ?? 0;
  const byCrop = ov?.productions.byCrop ?? [];
  const totalCoopKg = byCrop.reduce((acc, row) => acc + (Number(row.quantityKg) || 0), 0);

  const memberJoinSeries = useMemo(
    () =>
      buildMonthlySeries(
        members,
        (m) => m.joinedAt,
        (m) => m.status === 'ACTIVE',
      ),
    [members],
  );

  const mapMarkers: HorizonMapMarker[] = useMemo(
    () =>
      orgs.map((org) => ({
        id: org.id,
        code: org.slug.slice(0, 9).toUpperCase(),
        label: `${org.name} (${org.type})`,
        countryCode: org.countryCode,
        tone: org.id === activeOrgId ? 'blue' : org.cooperative ? 'green' : 'amber',
        href: '/organization/profile',
        isHub: org.id === activeOrgId,
      })),
    [orgs, activeOrgId],
  );

  const trackItems: HorizonTrackItem[] = useMemo(() => {
    if (groupOffers.length > 0) {
      return groupOffers.slice(0, 4).map((offer) => {
        const id = String(offer.id ?? '');
        const status = String(offer.status ?? 'DRAFT');
        return {
          id,
          code: `OFF-${id.slice(0, 6).toUpperCase()}`,
          subtitle: `${Number(offer.totalQuantityKg ?? 0)} kg`,
          statusLabel: status === 'CONFIRMED' ? t('ui.confirmee') : status === 'CANCELLED' ? t('ui.annulee') : t('ui.brouillon'),
          tone: status === 'CONFIRMED' ? 'green' : status === 'CANCELLED' ? 'red' : 'amber',
          leftCode: t('ui.trackCodeMembers'),
          leftLabel: t('ui.collecte'),
          rightCode: t('ui.trackCodeMarket'),
          rightLabel: t('ui.offreGroupee'),
          progressPct: status === 'CONFIRMED' ? 100 : 55,
          icon: 'layers',
          href: '/organization/group-sales',
        };
      });
    }
    return orgs.slice(0, 4).map((org) => ({
      id: org.id,
      code: org.type.slice(0, 8),
      subtitle: org.countryCode,
      statusLabel: org.cooperative ? t('ui.cooperative') : org.type,
      tone: org.cooperative ? 'green' : 'blue',
      leftCode: org.countryCode,
      leftLabel: t('ui.juridiction'),
      rightCode: org.roles[0] ?? t('ui.trackCodeMember'),
      rightLabel: org.name,
      progressPct: org.id === activeOrgId ? 100 : 65,
      icon: 'users',
      href: '/organization/profile',
    }));
  }, [groupOffers, orgs, activeOrgId, t]);

  return (
    <AuthGate
      isAuthenticated={isAuthenticated}
      title={t('ui.espaceOrganisationCooperative')}
      description={t('ui.pilotezVotreStructureVosMembresVos')}
      icon="🤝"
    >
      <HorizonShell>
        {organizations.isLoading ? (
          <LoadingState count={3} height={150} />
        ) : organizations.isError ? (
          <ErrorState error={organizations.error} onRetry={() => void organizations.refetch()} showRequestId />
        ) : (
          <>
            {orgs.length > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-bordure bg-surface px-4 py-3 text-xs">
                <span className="font-semibold text-texte">{t('ui.organisationsRattacheesAVotreCompte', { length: orgs.length })}</span>
                <div className="flex flex-wrap gap-2">
                  {orgs.map((org) => (
                    <Button
                      key={org.id}
                      size="sm"
                      variant={org.id === activeOrgId ? 'primary' : 'outline'}
                      label={`${org.name} (${org.countryCode})`}
                      onClick={() => setActiveOrganizationId(org.id)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <HorizonOverviewCard
              title={coop.data ? t('ui.cooperative_442a4', { coopName }) : t('ui.vueDEnsembleDeLOrganisation')}
              updatedLabel={formatHorizonTimestamp(undefined, locale)}
              headerRight={
                <Link
                  to="/organization/overview"
                  className="rounded-lg bg-marque-clair px-2.5 py-1 text-xs font-semibold text-marque"
                  style={{ textDecoration: 'none' }}
                >{t('ui.perimetreConsentements')}</Link>
              }
              items={[
                {
                  id: 'members',
                  label: t('ui.membresRattaches'),
                  value: formatNumber(totalMembers, locale),
                  subtitle: t('ui.avecPartageParcellaireActif', { consentedMembers: formatNumber(consentedMembers, locale) }),
                  badgeText: totalMembers > 0 ? `${Math.round((consentedMembers / totalMembers) * 100)}%` : '0%',
                  badgeSubtext: t('ui.kpiSubConsented'),
                  tone: 'green',
                  icon: 'users',
                  href: '/organization/members',
                },
                {
                  id: 'plots',
                  label: t('ui.surfaceSousConsentement'),
                  value: formatAreaHa(totalAreaHa, locale),
                  subtitle: t('ui.parcelleSConsolideeS', { plotsCount: formatNumber(plotsCount, locale) }),
                  badgeText: t('ui.coop03'),
                  badgeSubtext: t('ui.perimetre'),
                  tone: 'blue',
                  icon: 'map',
                  href: '/organization/overview',
                },
                {
                  id: 'volume',
                  label: t('ui.volumesConsolides'),
                  value: formatWeightKg(totalCoopKg, locale),
                  subtitle: t('ui.filiereSDeclareeS', { length: formatNumber(byCrop.length, locale) }),
                  badgeText: t('ui.offreS', { length: formatNumber(groupOffers.length, locale) }),
                  badgeSubtext: t('ui.groupees'),
                  tone: 'amber',
                  icon: 'box',
                  href: '/organization/collection',
                },
                {
                  id: 'orgs',
                  label: t('ui.structuresGouvernance'),
                  value: formatNumber(orgs.length, locale),
                  subtitle: coop.data?.province ?? coop.data?.territory ?? t('ui.perimetreMultiOrganisations'),
                  badgeText: coop.data ? t('ui.cooperative') : t('ui.organisation_6e99c'),
                  badgeSubtext: 'active',
                  tone: 'green',
                  icon: 'shield',
                  href: '/organization/governance',
                },
              ]}
            />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <HorizonAreaChartCard
                title={t('ui.adhesionsDesMembresParMois')}
                primaryLabel={t('ui.adhesionsEnregistrees')}
                secondaryLabel={t('ui.membresActifs')}
                points={memberJoinSeries}
                emptyMessage={t('ui.aucuneAdhesionHorodateePourLeMoment')}
                sourceNote={ov?.plots.scope ?? t('ui.perimetreLimiteAuxMembresAyantConsenti')}
              />

              <HorizonGeoMapCard
                title={t('ui.implantationDesStructures')}
                markers={mapMarkers}
                searchPlaceholder={t('ui.filtrerUneStructure')}
                emptyMessage={t('ui.aucuneOrganisationRattachee')}
                legend={[
                  { label: t('ui.structureActive'), tone: 'blue', count: activeOrgId ? 1 : 0 },
                  { label: t('ui.cooperatives'), tone: 'green', count: orgs.filter((o) => Boolean(o.cooperative)).length },
                  { label: t('ui.autresStructures'), tone: 'amber', count: orgs.filter((o) => !o.cooperative).length },
                  { label: t('ui.offresGroupees'), tone: 'neutral', count: groupOffers.length },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <HorizonTrackListCard
                title={groupOffers.length > 0 ? t('ui.ventesGroupeesEnCours') : t('ui.structuresRattachees')}
                items={trackItems}
                viewAllHref={groupOffers.length > 0 ? '/organization/group-sales' : '/organization/profile'}
                emptyMessage={t('ui.aucuneVenteGroupeeEnregistree')}
              />

              <HorizonQuadMetricsCard
                title={t('ui.consolidationCooperative')}
                cells={[
                  {
                    id: 'm-total',
                    value: formatNumber(totalMembers, locale),
                    label: t('ui.membresInscrits'),
                    bars: [42, 65, 78, totalMembers > 0 ? 90 : 18],
                    tone: 'green',
                    href: '/organization/members',
                  },
                  {
                    id: 'm-consent',
                    value: formatNumber(consentedMembers, locale),
                    label: t('ui.consentementsParcelles'),
                    bars: [35, 55, 72, consentedMembers > 0 ? 86 : 18],
                    tone: 'blue',
                    href: '/organization/overview',
                  },
                  {
                    id: 'm-crops',
                    value: formatNumber(byCrop.length, locale),
                    label: t('ui.culturesConsolidees'),
                    bars: [28, 48, 66, byCrop.length > 0 ? 82 : 18],
                    tone: 'amber',
                    href: '/organization/collection',
                  },
                  {
                    id: 'm-offers',
                    value: formatNumber(groupOffers.length, locale),
                    label: t('ui.offresGroupees'),
                    bars: [25, 44, 60, groupOffers.length > 0 ? 80 : 18],
                    tone: 'green',
                    href: '/organization/group-sales',
                  },
                ]}
              />

              <HorizonDonutCard
                title={t('ui.perimetreDeConsentement')}
                totalValue={formatNumber(totalMembers, locale)}
                totalLabel={t('ui.membres')}
                segments={[
                  { label: t('ui.partageActif'), value: consentedMembers, tone: 'green' },
                  { label: t('ui.sansPartageParcelle'), value: Math.max(0, totalMembers - consentedMembers), tone: 'amber' },
                  { label: t('ui.filieresSuivies'), value: byCrop.length, tone: 'blue' },
                ]}
              />
            </div>
          </>
        )}
      </HorizonShell>
    </AuthGate>
  );
}
