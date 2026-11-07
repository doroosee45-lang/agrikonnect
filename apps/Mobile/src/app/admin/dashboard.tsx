import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate, Card, ChipRow, EmptyState, ErrorState, FilterChip, LoadingState, Reveal,
  Screen, Section, StatCard, Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { adminApi, referenceApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * ADMIN — Tableau de bord centralisé (SPEC-SUPER-ADMIN M1, miroir mobile).
 *
 * Même contrat que le web : `GET /admin/dashboard` avec filtres pays/période,
 * valeurs calculées à la requête (RG-M1-1). Chaque carte mène à la liste
 * correspondante (drill-down).
 */

type DashboardData = {
  series?: { signups?: Array<{ month: string; count: number }> };
  generatedAt?: string;
  note?: string;
} & Record<string, unknown>;

type Kpi = { cle: string; label: string; vers: string };
type Bloc = { titre: string; kpis: Kpi[] };

const BLOCS: Bloc[] = [
  {
    titre: 'Comptes',
    kpis: [
      { cle: 'users', label: 'Comptes créés', vers: '/admin/users' },
      { cle: 'usersActive', label: 'Actifs', vers: '/admin/users' },
      { cle: 'usersSuspended', label: 'Suspendus', vers: '/admin/users' },
      { cle: 'usersUnverifiedEmail', label: 'E-mails non vérifiés', vers: '/admin/users' },
      { cle: 'usersMfa', label: 'MFA active', vers: '/admin/users' },
      { cle: 'usersNewInPeriod', label: 'Nouveaux (période)', vers: '/admin/users' },
    ],
  },
  {
    titre: 'Organisations',
    kpis: [
      { cle: 'organizationsIndividual', label: 'Individuelles', vers: '/admin/farmers' },
      { cle: 'organizationsCooperative', label: 'Coopératives', vers: '/admin/cooperatives' },
      { cle: 'organizationsCompany', label: 'Sociétés', vers: '/admin/producers' },
    ],
  },
  {
    titre: 'Activité',
    kpis: [
      { cle: 'farms', label: 'Exploitations', vers: '/admin/farms' },
      { cle: 'plots', label: 'Parcelles', vers: '/admin/plots' },
      { cle: 'productions', label: 'Productions', vers: '/admin/productions' },
      { cle: 'soilAssessments', label: 'Analyses de sol', vers: '/admin/farms' },
      { cle: 'cooperatives', label: 'Coopératives actives', vers: '/admin/cooperatives' },
    ],
  },
  {
    titre: 'Marché',
    kpis: [
      { cle: 'listingsPublished', label: 'Annonces publiées', vers: '/admin/marketplace' },
      { cle: 'ordersInPeriod', label: 'Commandes (période)', vers: '/admin/orders' },
      { cle: 'disputesOpen', label: 'Litiges ouverts', vers: '/admin/moderation' },
    ],
  },
  {
    titre: 'Qualité',
    kpis: [
      { cle: 'pendingVerifications', label: 'Vérifications en attente', vers: '/admin/verifications' },
      { cle: 'openReports', label: 'Signalements ouverts', vers: '/admin/reports' },
    ],
  },
];

const PERIODES = [
  { id: '30', label: '30 j' },
  { id: '90', label: '90 j' },
  { id: '365', label: '12 mois' },
  { id: 'all', label: 'Tout' },
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

export default function AdminDashboard() {
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
  const serie = data.series?.signups ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Tableau de bord" subtitle="Vue consolidée de la plateforme." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Tableau de bord" icon="stats-chart-outline">
          {/* Filtres pays (RG-M1-1) */}
          <Text preset="caption" color={COLORS.slateGray}>Pays</Text>
          <ChipRow>
            <FilterChip label="Tous" active={pays === null} onPress={() => setPays(null)} />
            {(paysQuery.data ?? []).map((p) => (
              <FilterChip
                key={p.code}
                label={p.code}
                active={pays === p.code}
                onPress={() => setPays(p.code)}
              />
            ))}
          </ChipRow>

          {/* Filtre période */}
          <Text preset="caption" color={COLORS.slateGray}>Période</Text>
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
            <LoadingState count={3} height={90} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <View style={styles.blocks}>
              {BLOCS.map((bloc, blocIndex) => (
                <Reveal key={bloc.titre} index={blocIndex} variant="up">
                  <View style={styles.block}>
                    <Text preset="h3">{bloc.titre}</Text>
                    <View style={styles.grid}>
                      {bloc.kpis.map((kpi) => (
                        <View key={kpi.cle} style={styles.kpiWrap}>
                          <StatCard
                            label={kpi.label}
                            valeur={String(data[kpi.cle] ?? 0)}
                            onPress={() => router.push(kpi.vers)}
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                </Reveal>
              ))}

              {/* Série des inscriptions */}
              <Reveal index={BLOCS.length} variant="up">
                <View style={styles.block}>
                  <Text preset="h3">Inscriptions — 12 derniers mois</Text>
                  {serie.length === 0 ? (
                    <EmptyState
                      title="Aucune inscription"
                      description="Aucun compte créé sur la période."
                      icon="person-add-outline"
                    />
                  ) : (
                    <Card tone="white" style={styles.kpi}>
                      {serie.map((point) => (
                        <View key={point.month} style={styles.serieRow}>
                          <Text preset="caption" color={COLORS.slateGray}>{point.month}</Text>
                          <Text preset="bodyMedium">{String(point.count)}</Text>
                        </View>
                      ))}
                    </Card>
                  )}
                </View>
              </Reveal>

              <Text preset="caption" color={COLORS.slateGray}>
                {data.note ? `${String(data.note)} — ` : ''}
                Calculé le {data.generatedAt ? new Date(String(data.generatedAt)).toLocaleString(locale) : '—'}.
              </Text>
            </View>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  blocks: { gap: SPACING.lg },
  block: { gap: SPACING.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  kpiWrap: { flexGrow: 1, flexBasis: '45%' },
  kpi: { gap: 4 },
  serieRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
});