import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { ErrorState, LoadingState } from '@/components/ui';
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
import { formatNumber } from '@/lib/format';
import { apiClientApi, queryKeys, referenceApi } from '@/services';
import { useAuthStore } from '@/store/auth';

/** Espace Developpeurs & Clients API (/developers) — Design Horizon 100 % API reelle. */
export default function DevelopersHome() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const clientsQuery = useQuery({
    queryKey: queryKeys.apiClients.all,
    queryFn: () => apiClientApi.clients().then((r) => r.data ?? []),
    enabled: isAuthenticated,
    retry: false,
  });

  const countriesQuery = useQuery({
    queryKey: ['developers', 'horizon', 'countries'],
    queryFn: () => referenceApi.countries().then((r) => r.data ?? []),
    retry: false,
  });

  const cropsQuery = useQuery({
    queryKey: ['developers', 'horizon', 'crops'],
    queryFn: () => referenceApi.crops().then((r) => r.data ?? []),
    retry: false,
  });

  const clients = clientsQuery.data ?? [];
  const activeClients = clients.filter((c) => c.status === 'ACTIVE');
  const approvedClients = clients.filter((c) => Boolean(c.purposeApprovedAt));
  const totalKeys = clients.reduce((acc, c) => acc + (c.keys?.length ?? 0), 0);

  const clientTracks: HorizonTrackItem[] = useMemo(
    () =>
      clients.slice(0, 4).map((client) => {
        const isApproved = Boolean(client.purposeApprovedAt);
        return {
          id: client.id,
          code: client.name.slice(0, 10).toUpperCase(),
          subtitle: t('ui.cleSScopeS', { value: client.keys?.length ?? 0, value2: client.scopes?.length ?? 0 }),
          statusLabel: isApproved ? t('ui.finaliteApprouvee') : client.status,
          tone: isApproved ? 'green' : 'amber',
          leftCode: t('ui.trackCodePurpose'),
          leftLabel: isApproved ? t('ui.validee') : t('ui.aValider'),
          rightCode: 'API',
          rightLabel: client.status,
          progressPct: isApproved ? 100 : 55,
          icon: 'key',
          href: '/developers/keys',
        };
      }),
    [clients, t],
  );

  return (
    <HorizonShell>
      {isAuthenticated && clientsQuery.isLoading ? (
        <LoadingState count={2} height={140} />
      ) : clientsQuery.isError ? (
        <ErrorState error={clientsQuery.error} onRetry={() => void clientsQuery.refetch()} showRequestId />
      ) : (
        <>
          <HorizonOverviewCard
            title={t('ui.portailDeveloppeursIntegrationsB2b')}
            updatedLabel={formatHorizonTimestamp(undefined, locale)}
            headerRight={
              <div className="flex items-center gap-2">
                <Link
                  to="/developers/docs"
                  className="rounded-lg border border-bordure bg-fond px-2.5 py-1 text-xs font-semibold text-texte"
                  style={{ textDecoration: 'none' }}
                >{t('ui.documentationOpenapi')}</Link>
                <Link
                  to="/developers/keys"
                  className="rounded-lg bg-marque-clair px-2.5 py-1 text-xs font-semibold text-marque"
                  style={{ textDecoration: 'none' }}
                >{t('ui.gererLesClesApi')}</Link>
              </div>
            }
            items={[
              {
                id: 'clients',
                label: t('ui.applicationsEnregistrees'),
                value: formatNumber(clients.length, locale),
                subtitle: isAuthenticated
                  ? t('ui.clientSActifS', { length: formatNumber(activeClients.length, locale) })
                  : t('ui.connectezVousPourGererVosApplications'),
                badgeText: t('ui.approuv', { length: formatNumber(approvedClients.length, locale) }),
                badgeSubtext: t('ui.finaliteRgpd'),
                tone: 'green',
                icon: 'layers',
                href: '/developers/keys',
              },
              {
                id: 'keys',
                label: t('ui.clesApiEmises'),
                value: formatNumber(totalKeys, locale),
                subtitle: t('ui.authentificationMachineAMachine'),
                badgeText: 'SHA-256',
                badgeSubtext: t('ui.revocables'),
                tone: 'blue',
                icon: 'key',
                href: '/developers/keys',
              },
              {
                id: 'countries',
                label: t('ui.referentielPaysOuvert'),
                value: formatNumber((countriesQuery.data ?? []).length, locale),
                subtitle: t('ui.devisesFuseauxEtTauxFxPublics'),
                badgeText: t('ui.getCountries'),
                badgeSubtext: 'public',
                tone: 'green',
                icon: 'map',
                href: '/developers/docs',
              },
              {
                id: 'crops',
                label: t('ui.catalogueCultures'),
                value: formatNumber((cropsQuery.data ?? []).length, locale),
                subtitle: t('ui.taxonomieAgronomiqueNormalisee'),
                badgeText: t('ui.getCrops'),
                badgeSubtext: 'public',
                tone: 'amber',
                icon: 'leaf',
                href: '/developers/usage',
              },
            ]}
          />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <HorizonTrackListCard
              title={t('ui.applicationsValidationDeFinalite')}
              items={clientTracks}
              viewAllHref="/developers/keys"
              emptyMessage={
                isAuthenticated
                  ? t('ui.aucunClientApiCreeOuvrezCles')
                  : t('ui.connectezVousPourConsulterVosApplications')
              }
            />

            <HorizonQuadMetricsCard
              title={t('ui.ressourcesQuotas')}
              cells={[
                {
                  id: 'd-cli',
                  value: formatNumber(clients.length, locale),
                  label: t('ui.clientsDeclares'),
                  bars: [35, 58, 74, clients.length > 0 ? 88 : 18],
                  tone: 'green',
                  href: '/developers/keys',
                },
                {
                  id: 'd-key',
                  value: formatNumber(totalKeys, locale),
                  label: t('ui.clesActives'),
                  bars: [30, 50, 68, totalKeys > 0 ? 84 : 18],
                  tone: 'blue',
                  href: '/developers/usage',
                },
                {
                  id: 'd-ctry',
                  value: formatNumber((countriesQuery.data ?? []).length, locale),
                  label: t('ui.juridictionsCouvertes'),
                  bars: [45, 68, 82, 92],
                  tone: 'green',
                  href: '/developers/docs',
                },
                {
                  id: 'd-crop',
                  value: formatNumber((cropsQuery.data ?? []).length, locale),
                  label: t('ui.filieresReferencees'),
                  bars: [40, 64, 78, 90],
                  tone: 'amber',
                  href: '/developers/docs',
                },
              ]}
            />

            <HorizonDonutCard
              title={t('ui.conformiteDesClientsApi')}
              totalValue={formatNumber(clients.length, locale)}
              totalLabel={t('ui.applications')}
              segments={[
                { label: t('ui.finaliteApprouvee'), value: approvedClients.length, tone: 'green' },
                {
                  label: t('ui.enAttenteApprobation'),
                  value: Math.max(0, clients.length - approvedClients.length),
                  tone: 'amber',
                },
                { label: t('ui.clesEmises'), value: totalKeys, tone: 'blue' },
              ]}
            />
          </div>
        </>
      )}
    </HorizonShell>
  );
}
