import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  PressableCard,
  ProvenanceTag,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatNumber, formatRelative } from '@/lib/format';
import { alertApi, authApi, dashboardApi, plotApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

/** Pilotage : compteurs réels, dossier, parcelles récentes, actions rapides. */
export default function FarmerHome() {
  const { t, locale } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 820;

  const me = useQuery({ queryKey: queryKeys.me, queryFn: () => authApi.me().then((r) => r.data) });
  const plots = useQuery({
    queryKey: queryKeys.plots.list({ limit: 5 }),
    queryFn: () => plotApi.list({ limit: 5 }).then((r) => r.data),
  });
  const dashboard = useQuery({
    queryKey: queryKeys.dashboard.farmer,
    queryFn: () => dashboardApi.farmer().then((r) => r.data),
  });

  /*
   * Compteur d'alertes non traitées, pour relier le tableau de bord à la boîte
   * d'alertes avec une information réelle. `openCount` vient de la meta de la
   * liste : un seul aller-retour, pas de requête de comptage en plus.
   */
  const alertes = useQuery({
    queryKey: queryKeys.alerts.list({ open: true, limit: 1, page: 1 }),
    queryFn: () => alertApi.list({ open: true, limit: 1, page: 1 }).then((r) => r.data),
  });

  const counts = me.data?.counts;
  const alertesOuvertes = alertes.data?.openCount ?? 0;
  const items = plots.data ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title={t('farmer.title')} subtitle="Vue d’ensemble de vos exploitations, parcelles et productions." />

      <Section bare contentStyle={styles.section}>
        {me.isLoading ? (
          <LoadingState count={2} height={110} />
        ) : me.isError ? (
          <ErrorState error={me.error} onRetry={() => void me.refetch()} />
        ) : (
          <>
            <View style={[styles.counts, wide ? styles.countsWide : null]}>
              {[
                { label: t('farmer.farms'), value: counts?.farms ?? 0, icon: 'home-outline' as const, href: '/farmer/farms' },
                { label: t('farmer.plots'), value: counts?.plots ?? 0, icon: 'map-outline' as const, href: '/farmer/plots' },
                { label: t('farmer.productions'), value: counts?.productions ?? 0, icon: 'leaf-outline' as const, href: '/farmer/productions' },
              ].map((item, index) => (
                <Reveal key={item.label} index={index} variant="up" style={styles.countItem}>
                  <PressableCard onPress={() => router.push(item.href as never)} style={styles.countCard}>
                    <View style={styles.countIcon}>
                      <Ionicons name={item.icon} size={17} color={COLORS.forestGreen} />
                    </View>
                    <Text preset="numeric" color={COLORS.textPrimary} style={styles.countValue}>
                      {formatNumber(item.value, locale)}
                    </Text>
                    <Text preset="caption" color={COLORS.slateGray}>
                      {item.label}
                    </Text>
                  </PressableCard>
                </Reveal>
              ))}
            </View>

            <Reveal variant="up">
              <Card tone="ink" style={styles.actions}>
                <Text preset="overline" color={COLORS.gold}>
                  Actions rapides
                </Text>
                <View style={styles.actionRow}>
                  <Button label={t('farmer.newPlot')} onPress={() => router.push('/farmer/plots')} variant="gold" size="sm" icon="add" />
                  <Button label="Déclarer une production" onPress={() => router.push('/farmer/productions')} variant="dark" size="sm" icon="leaf-outline" />
                  <Button label="Diagnostic de sol" onPress={() => router.push('/farmer/soil')} variant="dark" size="sm" icon="flask-outline" />
              <Button label="Rendements réels" onPress={() => router.push('/farmer/season-feedback')} variant="dark" size="sm" icon="stats-chart-outline" />
              <Button
                label={alertesOuvertes > 0 ? `Boîte d’alertes (${alertesOuvertes})` : 'Boîte d’alertes'}
                onPress={() => router.push('/farmer/alerts')}
                variant="dark"
                size="sm"
                icon="notifications-outline"
              />
                </View>
                {dashboard.data ? (
                  <Text preset="caption" color="rgba(246, 247, 242, 0.6)" style={styles.lineHeight}>
                    Tableau de bord chargé depuis GET /dashboard.
                  </Text>
                ) : null}
              </Card>
            </Reveal>

            <View style={styles.listHeader}>
              <Text preset="h3" color={COLORS.textPrimary}>
                Parcelles récentes
              </Text>
              <PressableCard onPress={() => router.push('/farmer/plots')} style={styles.seeAll}>
                <Text preset="caption" color={COLORS.forestGreen}>
                  {t('common.seeAll')}
                </Text>
              </PressableCard>
            </View>

            {plots.isLoading ? (
              <LoadingState count={2} height={90} />
            ) : plots.isError ? (
              <ErrorState error={plots.error} onRetry={() => void plots.refetch()} />
            ) : items.length === 0 ? (
              <EmptyState
                title={t('farmer.noPlots')}
                description="Une parcelle localisée active la météo, le diagnostic de sol et la traçabilité des lots."
                icon="map-outline"
                action={{ label: t('farmer.newPlot'), onPress: () => router.push('/farmer/plots') }}
              />
            ) : (
              <View style={styles.list}>
                {items.map((plot, index) => (
                  <Reveal key={plot.id} index={index} variant="up">
                    <PressableCard onPress={() => router.push(`/farmer/plots/${plot.id}` as never)} style={styles.plotCard}>
                      <View style={styles.plotIcon}>
                        <Ionicons name="leaf-outline" size={15} color={COLORS.livingGreen} />
                      </View>
                      <View style={styles.plotBody}>
                        <Text preset="bodyMedium" color={COLORS.textPrimary} numberOfLines={1}>
                          {plot.name}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          {plot.areaHa !== null ? `${formatNumber(plot.areaHa, locale, 2)} ha · ` : ''}
                          {plot.status} · {formatRelative(plot.updatedAt, locale)}
                        </Text>
                      </View>
                      <View style={styles.plotAside}>
                        <ProvenanceTag kind={plot.source === 'declared' ? 'declared' : 'measured'} />
                        <Chip label={plot.geometryType} tone="neutral" size="sm" />
                      </View>
                    </PressableCard>
                  </Reveal>
                ))}
              </View>
            )}
          </>
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.lg },
  lineHeight: { lineHeight: 18 },
  counts: { gap: SPACING.md },
  countsWide: { flexDirection: 'row' },
  countItem: { flex: 1 },
  countCard: { gap: SPACING.xs, alignItems: 'flex-start' },
  countIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    backgroundColor: TINTS.forestGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countValue: { fontSize: 26, lineHeight: 30 },
  actions: { gap: SPACING.md },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seeAll: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  list: { gap: SPACING.sm },
  plotCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  plotIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    backgroundColor: TINTS.livingGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plotBody: { flex: 1, gap: 2 },
  plotAside: { alignItems: 'flex-end', gap: 4 },
});
