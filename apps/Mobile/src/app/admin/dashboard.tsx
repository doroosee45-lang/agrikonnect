import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate,
  ChipRow,
  ErrorState,
  FilterChip,
  LoadingState,
  MobileHorizonAreaCard,
  MobileHorizonDonutCard,
  MobileHorizonOverviewCard,
  Screen,
  Section,
  StatCard,
  Text,
} from '@/components/ui';
import { useI18n, tr } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { adminApi, referenceApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

type DashboardData = {
  series?: { signups?: Array<{ month: string; count: number }> };
  generatedAt?: string;
  note?: string;
} & Record<string, unknown>;

const PERIODES = [
  { id: '30', label: '30 j' },
  { id: '90', label: '90 j' },
  { id: '365', get label() { return tr('ui.n12Mois'); } },
  { id: 'all', get label() { return tr('ui.tout'); } },
];

const bornesPeriode = (periode: string): { from?: string; to?: string } => {
  if (periode === 'all') return {};
  const debut = new Date();
  debut.setDate(debut.getDate() - Number(periode));
  return {
    from: debut.toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  };
};

/** ADMIN Mobile — Tableau de bord Horizon 100 % API reelle (GET /admin/dashboard). */
export default function AdminDashboard() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [pays, setPays] = useState<string | null>(null);
  const [periode, setPeriode] = useState('30');

  const filtres = {
    ...(pays ? { country: pays } : {}),
    ...bornesPeriode(periode),
  };

  const query = useQuery({
    queryKey: queryKeys.admin.dashboard(filtres),
    queryFn: () => adminApi.dashboard(filtres).then((r) => r.data as DashboardData),
    enabled: isAuthenticated,
    retry: false,
  });

  const paysQuery = useQuery({
    queryKey: ['reference', 'countries'],
    queryFn: () => referenceApi.countries().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const data = query.data ?? {};
  const num = (cle: string) => Number(data[cle] ?? 0) || 0;
  const seriePoints = useMemo(
    () =>
      (data.series?.signups ?? []).slice(-8).map((pt) => ({
        label: String(pt.month).slice(2),
        value: Number(pt.count) || 0,
      })),
    [data.series?.signups],
  );

  const totalOrgs =
    num('organizationsIndividual') + num('organizationsCooperative') + num('organizationsCompany');

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader
        title={t('ui.tableauDeBord')}
        subtitle={t('ui.pilotageConsolideDeLaPlateforme')}
        ctaLabel={t('ui.comptes')}
        onCtaPress={() => router.push('/admin/users')}
      />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.tableauDeBord')} icon="stats-chart-outline">
          <ChipRow>
            <FilterChip label={t('ui.tousPays')} active={pays === null} onPress={() => setPays(null)} />
            {(paysQuery.data ?? []).map((p) => (
              <FilterChip
                key={p.code}
                label={p.code}
                active={pays === p.code}
                onPress={() => setPays(p.code)}
              />
            ))}
          </ChipRow>

          <ChipRow>
            {PERIODES.map((item) => (
              <FilterChip
                key={item.id}
                label={item.label}
                active={periode === item.id}
                onPress={() => setPeriode(item.id)}
              />
            ))}
          </ChipRow>

          {query.isLoading ? (
            <LoadingState count={3} height={110} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <View style={styles.blocks}>
              <MobileHorizonOverviewCard
                title={t('ui.vueDEnsembleDesOperations')}
                updatedLabel={
                  data.generatedAt ? new Date(String(data.generatedAt)).toLocaleTimeString(locale) : undefined
                }
                items={[
                  {
                    id: 'users',
                    label: t('ui.comptesInscrits'),
                    value: formatNumber(num('users'), locale),
                    subtitle: t('ui.actifsMfa', { value: formatNumber(num('usersActive'), locale), value2: formatNumber(num('usersMfa'), locale) }),
                    badge: `+${formatNumber(num('usersNewInPeriod'), locale)}`,
                    tone: 'green',
                    icon: 'people-outline',
                    onPress: () => router.push('/admin/users'),
                  },
                  {
                    id: 'farms',
                    label: t('ui.exploitations'),
                    value: formatNumber(num('farms'), locale),
                    subtitle: t('ui.parcellesRec', { value: formatNumber(num('plots'), locale), value2: formatNumber(num('productions'), locale) }),
                    badge: t('ui.coop', { value: formatNumber(num('cooperatives'), locale) }),
                    tone: 'blue',
                    icon: 'leaf-outline',
                    onPress: () => router.push('/admin/farms'),
                  },
                  {
                    id: 'market',
                    label: t('ui.marcheCommandes'),
                    value: formatNumber(num('listingsPublished'), locale),
                    subtitle: t('ui.commandeS', { value: formatNumber(num('ordersInPeriod'), locale) }),
                    badge: t('ui.litigeS', { value: formatNumber(num('disputesOpen'), locale) }),
                    tone: num('disputesOpen') > 0 ? 'amber' : 'green',
                    icon: 'cart-outline',
                    onPress: () => router.push('/admin/marketplace'),
                  },
                  {
                    id: 'verif',
                    label: t('ui.qualiteAlertes'),
                    value: formatNumber(num('pendingVerifications'), locale),
                    subtitle: t('ui.signalementS', { value: formatNumber(num('openReports'), locale) }),
                    badge: num('pendingVerifications') > 0 ? t('ui.aTraiter') : t('ui.aJour'),
                    tone: num('pendingVerifications') > 0 ? 'red' : 'green',
                    icon: 'shield-checkmark-outline',
                    onPress: () => router.push('/admin/verifications'),
                  },
                ]}
              />

              <MobileHorizonAreaCard
                title={t('ui.dynamiqueDesInscriptions')}
                seriesLabel={t('ui.n12Mois')}
                points={seriePoints}
                emptyMessage={t('ui.aucuneInscriptionEnregistreeSurCettePeriode')}
              />

              <MobileHorizonDonutCard
                title={t('ui.repartitionDesOrganisations')}
                totalValue={formatNumber(totalOrgs, locale)}
                totalLabel={t('ui.structures')}
                segments={[
                  { label: t('ui.individuelles'), value: num('organizationsIndividual'), tone: 'green' },
                  { label: t('ui.cooperatives'), value: num('organizationsCooperative'), tone: 'blue' },
                  { label: t('ui.entreprises'), value: num('organizationsCompany'), tone: 'amber' },
                  { label: t('ui.comptesSuspendus'), value: num('usersSuspended'), tone: 'red' },
                ]}
              />

              <View style={styles.grid}>
                {[
                  { label: t('ui.analysesDeSol'), val: num('soilAssessments'), vers: '/admin/farms' },
                  { label: t('ui.commandesPeriode'), val: num('ordersInPeriod'), vers: '/admin/orders' },
                  { label: t('ui.eMailsNonVerifies'), val: num('usersUnverifiedEmail'), vers: '/admin/users' },
                  { label: t('ui.moderation'), val: num('disputesOpen'), vers: '/admin/moderation' },
                ].map((extra) => (
                  <View key={extra.label} style={styles.kpiWrap}>
                    <StatCard
                      label={extra.label}
                      valeur={formatNumber(extra.val, locale)}
                      onPress={() => router.push(extra.vers)}
                    />
                  </View>
                ))}
              </View>
            </View>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  blocks: { gap: SPACING.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  kpiWrap: { flexGrow: 1, flexBasis: '46%' },
});
