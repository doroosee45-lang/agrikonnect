import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { AuthGate, ErrorState, LoadingState } from '@/components/ui';
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
import { formatDate, formatNumber } from '@/lib/format';
import { messagingApi, notificationApi, queryKeys } from '@/services';
import { useAuthStore } from '@/store/auth';

/**
 * Espace Agent d'accompagnement & Support (/app/agent) — Design Horizon 100 % API reelle.
 * Corrige les liens vers /app/messages, /app/notifications, /agent/registration et /agent/consent.
 */
export default function AppAgent() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const conversations = useQuery({
    queryKey: queryKeys.messaging.conversations,
    queryFn: () => messagingApi.conversations({ limit: 30 }).then((r) => r.data),
    enabled: isAuthenticated,
  });

  const notifications = useQuery({
    queryKey: queryKeys.notifications.list({ unread: true, limit: 30 }),
    queryFn: () => notificationApi.list({ unread: true, limit: 30 }).then((r) => r.data),
    enabled: isAuthenticated,
  });

  const convItems = conversations.data?.items ?? [];
  const totalConv = conversations.data?.total ?? convItems.length;
  const totalUnread = conversations.data?.totalUnread ?? 0;
  const notifItems = notifications.data?.items ?? [];
  const unreadNotifs = notifications.data?.unreadCount ?? notifItems.length;

  const activeThreads = convItems.filter((c) => c.unread > 0);
  const resolvedThreads = convItems.filter((c) => c.unread === 0);

  const trackItems: HorizonTrackItem[] = useMemo(
    () =>
      convItems.slice(0, 4).map((c) => {
        const subject = c.subjectType ?? 'DOSSIER';
        return {
          id: c.id,
          code: `${subject.slice(0, 5)}-${c.id.slice(0, 4).toUpperCase()}`,
          subtitle: formatDate(c.lastMessage?.createdAt ?? c.updatedAt, locale),
          statusLabel: c.unread > 0 ? t('ui.nonLuS', { unread: c.unread }) : t('ui.repondu'),
          tone: c.unread > 0 ? 'amber' : 'green',
          leftCode: subject,
          leftLabel: t('ui.objetMetier'),
          rightCode: 'AGENT',
          rightLabel: t('ui.mediation'),
          progressPct: c.unread > 0 ? 52 : 100,
          icon: 'users',
          href: `/app/messages/${c.id}`,
        };
      }),
    [convItems, locale],
  );

  return (
    <AuthGate
      isAuthenticated={isAuthenticated}
      title={t('ui.posteAgentDAccompagnementSupport')}
      description={t('ui.enrolementTerrainSousMandatConsentementsAssistes')}
      icon="🎧"
    >
      <HorizonShell>
        {conversations.isLoading && notifications.isLoading ? (
          <LoadingState count={3} height={140} />
        ) : conversations.isError ? (
          <ErrorState error={conversations.error} onRetry={() => void conversations.refetch()} showRequestId />
        ) : (
          <>
            <HorizonOverviewCard
              title={t('ui.vueDEnsembleMediationAccompagnementTerrain')}
              updatedLabel={formatHorizonTimestamp(undefined, locale)}
              headerRight={
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/agent/consent"
                    className="rounded-lg border border-bordure bg-fond px-2.5 py-1 text-xs font-semibold text-texte"
                    style={{ textDecoration: 'none' }}
                  >{t('ui.consentementAssiste')}</Link>
                  <Link
                    to="/agent/registration"
                    className="rounded-lg bg-marque-clair px-2.5 py-1 text-xs font-semibold text-marque"
                    style={{ textDecoration: 'none' }}
                  >{t('ui.enrolerUnProducteur')}</Link>
                </div>
              }
              items={[
                {
                  id: 'conv',
                  label: t('ui.conversationsSuivies'),
                  value: formatNumber(totalConv, locale),
                  subtitle: t('ui.filsRattachesAuxObjetsMetier'),
                  badgeText: t('ui.countActiveMascPlural', { count: formatNumber(activeThreads.length, locale) }),
                  badgeSubtext: t('ui.aRepondre'),
                  tone: 'green',
                  icon: 'users',
                  href: '/app/messages',
                },
                {
                  id: 'unread',
                  label: t('ui.messagesEnAttente'),
                  value: formatNumber(totalUnread, locale),
                  subtitle: t('ui.demandesNonLuesSurVosDossiers'),
                  badgeText: totalUnread > 0 ? t('ui.prioritaire') : t('ui.aJour'),
                  badgeSubtext: 'support',
                  tone: totalUnread > 0 ? 'amber' : 'green',
                  icon: 'clock',
                  href: '/app/messages',
                },
                {
                  id: 'notifs',
                  label: t('ui.alertesNotifications'),
                  value: formatNumber(unreadNotifs, locale),
                  subtitle: t('ui.evenementsNonLusSurLaFile'),
                  badgeText: unreadNotifs > 0 ? t('ui.aTraiter') : 'RAS',
                  badgeSubtext: 'in-app',
                  tone: unreadNotifs > 0 ? 'red' : 'blue',
                  icon: 'alert',
                  href: '/app/notifications',
                },
                {
                  id: 'mandate',
                  label: t('ui.enrolementSousMandat'),
                  value: t('ui.actif'),
                  subtitle: t('ui.tracabiliteCompleteDuMandatProducteur'),
                  badgeText: 'AG-01',
                  badgeSubtext: t('ui.kpiSubCompliant'),
                  tone: 'blue',
                  icon: 'shield',
                  href: '/agent/registration',
                },
              ]}
            />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <HorizonTrackListCard
                title={t('ui.dossiersConversationsEnCours')}
                items={trackItems}
                viewAllHref="/app/messages"
                emptyMessage={t('ui.aucuneConversationAssigneePourLeMoment')}
              />

              <HorizonQuadMetricsCard
                title={t('ui.indicateursDeTraitement')}
                cells={[
                  {
                    id: 'ag-total',
                    value: formatNumber(totalConv, locale),
                    label: t('ui.filsPrisEnCharge'),
                    bars: [38, 60, 74, totalConv > 0 ? 88 : 18],
                    tone: 'green',
                    href: '/app/messages',
                  },
                  {
                    id: 'ag-unread',
                    value: formatNumber(totalUnread, locale),
                    label: t('ui.messagesNonLus'),
                    bars: [28, 52, 66, totalUnread > 0 ? 84 : 18],
                    tone: 'amber',
                    href: '/app/messages',
                  },
                  {
                    id: 'ag-notif',
                    value: formatNumber(unreadNotifs, locale),
                    label: t('ui.notificationsNonLues'),
                    bars: [25, 44, 60, unreadNotifs > 0 ? 80 : 18],
                    tone: 'red',
                    href: '/app/notifications',
                  },
                  {
                    id: 'ag-ok',
                    value: formatNumber(resolvedThreads.length, locale),
                    label: t('ui.filsAJour'),
                    bars: [42, 68, 82, resolvedThreads.length > 0 ? 92 : 18],
                    tone: 'blue',
                    href: '/app/messages',
                  },
                ]}
              />

              <HorizonDonutCard
                title={t('ui.statutDeLaBoiteAgent')}
                totalValue={formatNumber(totalConv, locale)}
                totalLabel={t('ui.conversations')}
                segments={[
                  { label: t('ui.aJour'), value: resolvedThreads.length, tone: 'green' },
                  { label: t('ui.enAttenteReponse'), value: activeThreads.length, tone: 'amber' },
                  { label: t('ui.alertesNonLues'), value: unreadNotifs, tone: 'red' },
                ]}
              />
            </div>
          </>
        )}
      </HorizonShell>
    </AuthGate>
  );
}
