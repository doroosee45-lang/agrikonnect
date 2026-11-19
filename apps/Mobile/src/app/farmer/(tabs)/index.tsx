import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  MobileHorizonDonutCard,
  MobileHorizonOverviewCard,
  MobileHorizonTrackCard,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import type { MobileHorizonTrack } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatNumber, formatRelative } from '@/lib/format';
import { alertApi, authApi, dashboardApi, plotApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** Espace Producteur Mobile (/farmer) — Design Horizon 100 % API reelle (sans texte debug). */
export default function FarmerHome() {
  const { t, locale } = useI18n();

  const me = useQuery({ queryKey: queryKeys.me, queryFn: () => authApi.me().then((r) => r.data) });
  const plots = useQuery({
    queryKey: queryKeys.plots.list({ limit: 8 }),
    queryFn: () => plotApi.list({ limit: 8 }).then((r) => r.data),
  });
  const dashboard = useQuery({
    queryKey: queryKeys.dashboard.farmer,
    queryFn: () => dashboardApi.farmer().then((r) => r.data as Record<string, unknown>),
  });
  const alertes = useQuery({
    queryKey: queryKeys.alerts.list({ open: true, limit: 1, page: 1 }),
    queryFn: () => alertApi.list({ open: true, limit: 1, page: 1 }).then((r) => r.data),
  });

  const counts = me.data?.counts;
  const completenessPct = me.data?.completeness.percent ?? 0;
  const alertesOuvertes = alertes.data?.openCount ?? 0;
  const items = plots.data ?? [];
  const tiles = ((dashboard.data ?? {}).tiles ?? {}) as Record<string, unknown>;
  const totalAreaHa = Number(tiles.totalAreaHa ?? 0) || 0;

  const plotTracks: MobileHorizonTrack[] = useMemo(
    () =>
      items.slice(0, 4).map((plot) => ({
        id: plot.id,
        code: plot.name,
        subtitle: formatRelative(plot.updatedAt, locale),
        statusLabel: plot.status,
        tone: plot.status === 'ACTIVE' ? 'green' : 'amber',
        leftCode: plot.geometryType.slice(0, 5),
        rightCode: plot.areaHa !== null ? `${formatNumber(plot.areaHa, locale, 1)} ha` : t('ui.trackCodePlot'),
        progressPct: plot.source === 'declared' ? 65 : 100,
        icon: 'leaf-outline',
        onPress: () => router.push(`/farmer/plots/${plot.id}` as never),
      })),
    [items, locale],
  );

  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title={t('farmer.title')} subtitle={t('ui.pilotageTempsReelDeVosExploitations')} />

      <Section bare contentStyle={styles.section}>
        {me.isLoading ? (
          <LoadingState count={3} height={110} />
        ) : me.isError ? (
          <ErrorState error={me.error} onRetry={() => void me.refetch()} />
        ) : (
          <>
            <MobileHorizonOverviewCard
              title={t('ui.vueDEnsembleAgricole')}
              items={[
                {
                  id: 'farms',
                  label: t('farmer.farms'),
                  value: formatNumber(counts?.farms ?? 0, locale),
                  subtitle: totalAreaHa > 0 ? t('ui.haCumules', { totalAreaHa: formatNumber(totalAreaHa, locale, 1) }) : t('ui.domaineActif'),
                  badge: t('ui.sites'),
                  tone: 'green',
                  icon: 'home-outline',
                  onPress: () => router.push('/farmer/farms'),
                },
                {
                  id: 'plots',
                  label: t('farmer.plots'),
                  value: formatNumber(counts?.plots ?? items.length, locale),
                  subtitle: t('ui.cadastreesSuivies'),
                  badge: 'GPS',
                  tone: 'blue',
                  icon: 'map-outline',
                  onPress: () => router.push('/farmer/plots'),
                },
                {
                  id: 'productions',
                  label: t('farmer.productions'),
                  value: formatNumber(counts?.productions ?? 0, locale),
                  subtitle: t('ui.campagnesSaisies'),
                  badge: t('ui.lotsQr'),
                  tone: 'amber',
                  icon: 'leaf-outline',
                  onPress: () => router.push('/farmer/productions'),
                },
                {
                  id: 'alerts',
                  label: t('ui.alertesOuvertes'),
                  value: formatNumber(alertesOuvertes, locale),
                  subtitle: t('ui.suiviAgronomiqueSol'),
                  badge: alertesOuvertes > 0 ? t('ui.aTraiter') : 'RAS',
                  tone: alertesOuvertes > 0 ? 'red' : 'green',
                  icon: 'notifications-outline',
                  onPress: () => router.push('/farmer/alerts'),
                },
              ]}
            />

            <Card tone="white" style={styles.actions}>
              <Text preset="h3" color={COLORS.textPrimary}>{t('ui.operationsRapides')}</Text>
              <View style={styles.actionRow}>
                <Button label={t('farmer.newPlot')} onPress={() => router.push('/farmer/plots/create')} variant="primary" size="sm" icon="add" />
                <Button label={t('ui.declarerRecolte')} onPress={() => router.push('/farmer/productions')} variant="outline" size="sm" icon="leaf-outline" />
                <Button label={t('ui.diagnosticSol')} onPress={() => router.push('/farmer/soil')} variant="outline" size="sm" icon="flask-outline" />
                <Button label={t('ui.rendementsReels')} onPress={() => router.push('/farmer/season-feedback')} variant="ghost" size="sm" icon="stats-chart-outline" />
              </View>
            </Card>

            {plots.isLoading ? (
              <LoadingState count={2} height={90} />
            ) : plots.isError ? (
              <ErrorState error={plots.error} onRetry={() => void plots.refetch()} />
            ) : items.length === 0 ? (
              <EmptyState
                title={t('farmer.noPlots')}
                description={t('ui.uneParcelleLocaliseeActiveLaMeteo')}
                icon="map-outline"
                action={{ label: t('farmer.newPlot'), onPress: () => router.push('/farmer/plots/create') }}
              />
            ) : (
              <MobileHorizonTrackCard
                title={t('ui.parcellesActivesProvenance')}
                items={plotTracks}
              />
            )}

            <MobileHorizonDonutCard
              title={t('ui.completudeDuDossierProducteur')}
              totalValue={`${Math.round(completenessPct)}%`}
              totalLabel={t('ui.completude_2d727')}
              segments={[
                { label: t('ui.exploitations'), value: counts?.farms ?? 0, tone: 'green' },
                { label: t('ui.parcelles'), value: counts?.plots ?? 0, tone: 'blue' },
                { label: t('ui.recoltes'), value: counts?.productions ?? 0, tone: 'amber' },
                { label: t('ui.alertesOuvertes'), value: alertesOuvertes, tone: 'red' },
              ]}
            />
          </>
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  actions: { gap: SPACING.sm },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
});
