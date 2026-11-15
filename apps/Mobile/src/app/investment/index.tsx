import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  ErrorState,
  FilterChip,
  LoadingState,
  MobileHorizonDonutCard,
  MobileHorizonOverviewCard,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n, tr } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { investApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const FILTERS = [
  { key: 'all', get label() { return tr('ui.tousLesProjets'); } },
  { key: 'followed', get label() { return tr('ui.suivis'); } },
  { key: 'matches', get label() { return tr('ui.correspondances'); } },
] as const;

interface InvestDashData {
  kpis?: {
    publishedProjects?: number;
    withVerifiedData?: number;
    accessGranted?: number;
    accessPending?: number;
    fundingFollowUps?: number;
  };
}

/** Espace Investisseur Mobile (/investment) — Design Horizon 100 % API reelle. */
export default function Investment() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [filter, setFilter] = useState<'all' | 'followed' | 'matches'>('all');

  const unwrapList = <T,>(raw: unknown): T[] => {
    if (Array.isArray(raw)) return raw as T[];
    if (raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items)) {
      return (raw as { items: T[] }).items;
    }
    return [];
  };

  const investorProfile = useQuery({
    queryKey: ['investors', 'me'],
    queryFn: () => investApi.profile().then((r) => r.data).catch(() => null),
    enabled: isAuthenticated,
    retry: false,
  });

  const hasProfile = Boolean(investorProfile.data);

  const projects = useQuery({
    queryKey: queryKeys.invest.projects({ limit: 30 }),
    queryFn: () => investApi.projects({ limit: 30 }).then((result) => unwrapList<NonNullable<typeof result.data>[number]>(result.data)),
    enabled: isAuthenticated,
  });
  const followed = useQuery({
    queryKey: queryKeys.invest.followed,
    queryFn: () => investApi.followed().then((result) => unwrapList<NonNullable<typeof result.data>[number]>(result.data)),
    enabled: isAuthenticated,
  });
  const matches = useQuery({
    queryKey: queryKeys.invest.matches,
    queryFn: () =>
      investApi
        .matches()
        .then((result) => unwrapList<NonNullable<typeof result.data>[number]>(result.data))
        .catch(() => []),
    enabled: isAuthenticated && hasProfile,
    retry: false,
  });
  const dashboard = useQuery({
    queryKey: queryKeys.invest.dashboard,
    queryFn: () => investApi.dashboard().then((result) => result.data as InvestDashData).catch(() => null),
    enabled: isAuthenticated && hasProfile,
    retry: false,
  });

  const follow = useMutation({
    mutationFn: (id: string) => investApi.follow(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invest.followed });
      void queryClient.invalidateQueries({ queryKey: queryKeys.invest.dashboard });
    },
  });

  const active = filter === 'all' ? projects : filter === 'followed' ? followed : matches;
  const items = unwrapList<NonNullable<typeof projects.data>[number]>(active.data);
  const allCount = unwrapList(projects.data).length;
  const followedCount = unwrapList(followed.data).length;
  const matchCount = unwrapList(matches.data).length;
  const kpis = dashboard.data?.kpis;

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader
        title={t('ui.investissement')}
        subtitle={t('ui.projetsAgricolesStructuresDataRooms')}
        ctaLabel={t('ui.portefeuille')}
        onCtaPress={() => router.push('/investment/followed')}
      />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title={t('ui.connexionRequise_37a92')}
          description={t('ui.connectezVousAvecUnCompteInvestisseur')}
          icon="trending-up-outline"
        >
          <Card tone="pale" style={styles.note}>
            <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.info} />
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>{t('ui.absenceDIntermediationFinanciereAgrikonnectAssur')}</Text>
          </Card>

          <MobileHorizonOverviewCard
            title={t('ui.vueDEnsembleDuDealflow')}
            items={[
              {
                id: 'pub',
                label: t('ui.projetsPublies'),
                value: formatNumber(kpis?.publishedProjects ?? allCount, locale),
                subtitle: t('ui.dossiersAccessibles'),
                badge: t('ui.ouverts'),
                tone: 'green',
                icon: 'briefcase-outline',
                onPress: () => setFilter('all'),
              },
              {
                id: 'fol',
                label: t('ui.projetsSuivis'),
                value: formatNumber(followedCount, locale),
                subtitle: t('ui.dansVotreSelection'),
                tone: 'blue',
                icon: 'bookmark-outline',
                onPress: () => setFilter('followed'),
              },
              {
                id: 'mat',
                label: t('ui.correspondances'),
                value: formatNumber(matchCount, locale),
                subtitle: t('ui.alignesAVotreThese'),
                tone: 'amber',
                icon: 'sparkles-outline',
                onPress: () => setFilter('matches'),
              },
              {
                id: 'room',
                label: t('ui.dataRooms'),
                value: formatNumber(kpis?.accessGranted ?? 0, locale),
                subtitle: t('ui.enAttente_9ecb1', { value: formatNumber(kpis?.accessPending ?? 0, locale) }),
                tone: 'green',
                icon: 'lock-open-outline',
              },
            ]}
          />

          <MobileHorizonDonutCard
            title={t('ui.couvertureDuPortefeuille')}
            totalValue={formatNumber(allCount, locale)}
            totalLabel={t('ui.projets')}
            segments={[
              { label: t('ui.suivis'), value: followedCount, tone: 'green' },
              { label: t('ui.correspondances'), value: matchCount, tone: 'blue' },
              { label: t('ui.autresPublies'), value: Math.max(0, allCount - followedCount), tone: 'amber' },
            ]}
          />

          <ChipRow>
            {FILTERS.map((item) => (
              <FilterChip key={item.key} label={item.label} active={filter === item.key} onPress={() => setFilter(item.key)} />
            ))}
          </ChipRow>

          {active.isLoading ? (
            <LoadingState count={2} height={140} />
          ) : active.isError ? (
            <ErrorState error={active.error} onRetry={() => void active.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title={t('ui.aucunProjet')}
              description={
                filter === 'followed'
                  ? t('ui.suivezDesProjetsPourLesRetrouver')
                  : filter === 'matches'
                    ? t('ui.aucuneCorrespondanceAvecVotreTheseInvestisseur')
                    : t('ui.aucunProjetPublieActuellement')
              }
              icon="briefcase-outline"
            />
          ) : (
            <View style={[styles.grid, wide ? styles.gridWide : null]}>
              {items.map((project, index) => (
                <Reveal key={project.id} index={index % 3} variant="up" style={styles.item}>
                  <Card tone="white" style={styles.card}>
                    <View style={styles.chips}>
                      <Chip label={project.sector} tone="forest" size="sm" />
                      <Chip label={project.countryCode} tone="neutral" size="sm" />
                      <Chip label={project.status} tone={project.status === 'PUBLISHED' ? 'success' : 'neutral'} size="sm" />
                    </View>

                    <Text preset="h3" color={COLORS.textPrimary} numberOfLines={2}>
                      {project.title}
                    </Text>

                    <View style={styles.facts}>
                      <View style={styles.fact}>
                        <Text preset="caption" color={COLORS.slateGray}>{t('ui.surface')}</Text>
                        <Text preset="bodySm" color={COLORS.textPrimary}>
                          {project.existingAreaHa !== null ? `${formatNumber(project.existingAreaHa, locale, 0)} ha` : '—'}
                        </Text>
                      </View>
                      <View style={styles.fact}>
                        <Text preset="caption" color={COLORS.slateGray}>{t('ui.besoin')}</Text>
                        <Text preset="bodySm" color={COLORS.textPrimary}>
                          {project.fundingNeed !== null ? formatNumber(project.fundingNeed, locale, 0) : '—'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.actions}>
                      <Button
                        label={t('ui.ouvrirLeProjet')}
                        onPress={() => router.push(`/investment/projects/${project.id}` as never)}
                        variant="outline"
                        size="sm"
                        icon="arrow-forward-outline"
                      />
                      <Button
                        label={t('ui.suivre')}
                        onPress={() => follow.mutate(project.id)}
                        variant="ghost"
                        size="sm"
                        icon="bookmark-outline"
                        loading={follow.isPending && follow.variables === project.id}
                      />
                    </View>
                  </Card>
                </Reveal>
              ))}
            </View>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  lineHeight: { lineHeight: 18, flex: 1 },
  note: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  grid: { gap: SPACING.md },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  item: { flex: 1, minWidth: 300 },
  card: { gap: SPACING.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.lg },
  fact: { minWidth: 110, gap: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
});
