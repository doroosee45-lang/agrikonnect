import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { AuthGate, ErrorState, LoadingState } from '@/components/ui';
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
import { formatAreaHa, formatNumber } from '@/lib/format';
import {
  dashboardApi,
  messagingApi,
  notificationApi,
  orderApi,
  queryKeys,
  verificationApi,
} from '@/services';
import { useAuthStore } from '@/store/auth';

interface DashboardSummary {
  tiles?: {
    totalAreaHa?: number;
    plots?: number;
    activeCrops?: number;
    productionKg?: number;
    profileCompleteness?: { done: number; total: number };
  };
  onboarding?: Array<{ key: string; label?: string; done: boolean }>;
}

/** Espace Compte & Activite (/app) — Design Horizon 100 % API reelle (sans JSON.stringify brut). */
export default function AppDashboard() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const dashboard = useQuery({
    queryKey: queryKeys.dashboard.farmer,
    queryFn: () => dashboardApi.farmer().then((r) => r.data as DashboardSummary),
    enabled: isAuthenticated,
    retry: false,
  });

  const ordersQuery = useQuery({
    queryKey: queryKeys.orders.list({ limit: 20 }),
    queryFn: () => orderApi.list({ limit: 20 }).then((r) => r.data ?? []),
    enabled: isAuthenticated,
    retry: false,
  });

  const conversationsQuery = useQuery({
    queryKey: ['app', 'horizon', 'conversations'],
    queryFn: () => messagingApi.conversations({ limit: 15 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const notificationsQuery = useQuery({
    queryKey: ['app', 'horizon', 'notifications'],
    queryFn: () => notificationApi.list({ limit: 15 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const verificationsQuery = useQuery({
    queryKey: ['app', 'horizon', 'verifications-me'],
    queryFn: () => verificationApi.mine().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const tiles = dashboard.data?.tiles ?? {};
  const orders = ordersQuery.data ?? [];
  const convItems = conversationsQuery.data?.items ?? [];
  const unreadMessages = conversationsQuery.data?.totalUnread ?? 0;
  const unreadNotifs = notificationsQuery.data?.unreadCount ?? 0;
  const notifItems = notificationsQuery.data?.items ?? [];
  const completeness = tiles.profileCompleteness;
  const verifCount = verificationsQuery.data?.items?.length ?? 0;

  const activitySeries = useMemo(
    () =>
      buildMonthlySeries<{ createdAt: string }>(
        orders.length > 0 ? orders : notifItems,
        (item) => item.createdAt,
      ),
    [orders, notifItems],
  );

  const trackItems: HorizonTrackItem[] = useMemo(() => {
    if (orders.length > 0) {
      return orders.slice(0, 4).map((o) => ({
        id: o.id,
        code: o.number || `CMD-${o.id.slice(0, 6).toUpperCase()}`,
        subtitle: new Date(o.createdAt).toLocaleDateString(locale),
        statusLabel: o.status,
        tone: o.status === 'DELIVERED' ? 'green' : o.status === 'CANCELLED' ? 'red' : 'blue',
        leftCode: o.paymentStatus,
        leftLabel: t('ui.paiement'),
        rightCode: o.status,
        rightLabel: t('ui.livraison'),
        progressPct: o.status === 'DELIVERED' ? 100 : 60,
        icon: 'truck',
        href: `/app/orders/${o.id}`,
      }));
    }
    return convItems.slice(0, 4).map((c) => {
      const subject = c.subjectType ?? 'DISCUSSION';
      return {
        id: c.id,
        code: `${subject.slice(0, 5)}-${c.id.slice(0, 4).toUpperCase()}`,
        subtitle: t('ui.nonLuS', { unread: c.unread }),
        statusLabel: c.unread > 0 ? t('ui.nouveau') : t('ui.suivi'),
        tone: c.unread > 0 ? 'amber' : 'green',
        leftCode: subject,
        leftLabel: t('ui.objet'),
        rightCode: t('ui.trackCodeFeed'),
        rightLabel: t('ui.messagerie'),
        progressPct: c.unread > 0 ? 50 : 100,
        icon: 'users',
        href: `/app/messages/${c.id}`,
      };
    });
  }, [orders, convItems, locale]);

  const doneCriteria = completeness?.done ?? 0;
  const totalCriteria = completeness?.total ?? 4;

  return (
    <AuthGate
      isAuthenticated={isAuthenticated}
      title={t('ui.monEspaceAgrikonnect')}
      description={t('ui.vueDEnsembleDeVosCommandes')}
      icon="📊"
    >
      <HorizonShell>
        {dashboard.isLoading && ordersQuery.isLoading ? (
          <LoadingState count={3} height={150} />
        ) : dashboard.isError && ordersQuery.isError ? (
          <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} showRequestId />
        ) : (
          <>
            <HorizonOverviewCard
              title={t('ui.vueDEnsembleDeVotreCompte')}
              updatedLabel={formatHorizonTimestamp(undefined, locale)}
              headerRight={
                <Link
                  to="/app/profile"
                  className="rounded-lg bg-marque-clair px-2.5 py-1 text-xs font-semibold text-marque"
                  style={{ textDecoration: 'none' }}
                >{t('ui.monProfilSecurite')}</Link>
              }
              items={[
                {
                  id: 'orders',
                  label: t('ui.commandesSuivies'),
                  value: formatNumber(orders.length, locale),
                  subtitle: t('ui.achatsEtVentesRattachesAuCompte'),
                  badgeText: t('ui.livr', { length: formatNumber(orders.filter((o) => o.status === 'DELIVERED').length, locale) }),
                  badgeSubtext: t('ui.cloturees'),
                  tone: 'green',
                  icon: 'box',
                  href: '/app/orders',
                },
                {
                  id: 'messages',
                  label: t('ui.conversationsMetier'),
                  value: formatNumber(convItems.length, locale),
                  subtitle: t('ui.messageSNonLuS', { unreadMessages: formatNumber(unreadMessages, locale) }),
                  badgeText: unreadMessages > 0 ? t('ui.nouv', { unreadMessages }) : t('ui.aJour'),
                  badgeSubtext: t('ui.kpiSubMessaging'),
                  tone: unreadMessages > 0 ? 'amber' : 'blue',
                  icon: 'users',
                  href: '/app/messages',
                },
                {
                  id: 'notifs',
                  label: t('ui.notificationsSysteme'),
                  value: formatNumber(unreadNotifs, locale),
                  unit: t('ui.unreadUnit'),
                  subtitle: t('ui.evenementSRecents', { length: formatNumber(notifItems.length, locale) }),
                  badgeText: unreadNotifs > 0 ? t('ui.aLire') : t('ui.nothingToReport'),
                  badgeSubtext: t('ui.inAppChannel'),
                  tone: unreadNotifs > 0 ? 'amber' : 'green',
                  icon: 'alert',
                  href: '/app/notifications',
                },
                {
                  id: 'farm',
                  label: t('ui.surfaceDossiers'),
                  value: formatAreaHa(tiles.totalAreaHa ?? 0, locale),
                  subtitle: t('ui.parcelleSVerif', { value: formatNumber(tiles.plots ?? 0, locale), verifCount: formatNumber(verifCount, locale) }),
                  badgeText: `${doneCriteria}/${totalCriteria}`,
                  badgeSubtext: t('ui.completude'),
                  tone: 'green',
                  icon: 'shield',
                  href: '/app/verifications',
                },
              ]}
            />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <HorizonTrackListCard
                title={orders.length > 0 ? t('ui.commandesRecentes') : t('ui.conversationsActives')}
                items={trackItems}
                viewAllHref={orders.length > 0 ? '/app/orders' : '/app/messages'}
                emptyMessage={t('ui.aucuneCommandeNiConversationActivePour')}
              />

              <HorizonQuadMetricsCard
                title={t('ui.raccourcisIndicateurs')}
                cells={[
                  {
                    id: 'a-farms',
                    value: formatNumber(tiles.plots ?? 0, locale),
                    label: t('ui.parcellesRattachees'),
                    bars: [35, 56, 70, (tiles.plots ?? 0) > 0 ? 84 : 18],
                    tone: 'green',
                    href: '/app/plots',
                  },
                  {
                    id: 'a-crops',
                    value: formatNumber(tiles.activeCrops ?? 0, locale),
                    label: t('ui.culturesSuivies'),
                    bars: [28, 48, 62, (tiles.activeCrops ?? 0) > 0 ? 80 : 18],
                    tone: 'blue',
                    href: '/app/productions',
                  },
                  {
                    id: 'a-msg',
                    value: formatNumber(convItems.length, locale),
                    label: t('ui.filsDeDiscussion'),
                    bars: [32, 52, 68, convItems.length > 0 ? 82 : 18],
                    tone: 'amber',
                    href: '/app/messages',
                  },
                  {
                    id: 'a-ver',
                    value: formatNumber(verifCount, locale),
                    label: t('ui.demandesVerification'),
                    bars: [25, 44, 58, verifCount > 0 ? 78 : 18],
                    tone: 'green',
                    href: '/app/verifications',
                  },
                ]}
              />

              <HorizonDonutCard
                title={t('ui.etatDuDossierCompte')}
                totalValue={`${doneCriteria}/${totalCriteria}`}
                totalLabel={t('ui.criteres')}
                segments={[
                  { label: t('ui.criteresValides'), value: doneCriteria, tone: 'green' },
                  { label: t('ui.restants'), value: Math.max(0, totalCriteria - doneCriteria), tone: 'amber' },
                  { label: t('ui.verifications'), value: verifCount, tone: 'blue' },
                ]}
              />
            </div>

            <HorizonAreaChartCard
              title={t('ui.activiteMensuelleDuCompte')}
              primaryLabel={orders.length > 0 ? t('ui.commandes') : t('ui.evenements')}
              points={activitySeries}
              emptyMessage={t('ui.aucuneActiviteHorodateeRecenteSurVotre')}
            />
          </>
        )}
      </HorizonShell>
    </AuthGate>
  );
}
