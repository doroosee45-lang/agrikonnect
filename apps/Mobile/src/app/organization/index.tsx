import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate,
  EmptyState,
  ErrorState,
  LoadingState,
  MobileHorizonDonutCard,
  MobileHorizonOverviewCard,
  MobileHorizonTrackCard,
  Screen,
  Section,
} from '@/components/ui';
import type { MobileHorizonTrack } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { organizationApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** Espace Organisations Mobile (/organization) — Design Horizon 100 % API reelle. */
export default function OrganizationIndex() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.organizations.all,
    queryFn: () => organizationApi.list().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const items = query.data ?? [];
  const coops = items.filter((o) => o.type === 'COOPERATIVE');
  const companies = items.filter((o) => o.type === 'COMPANY' || o.type === 'AGRICULTURAL_COMPANY');

  const tracks: MobileHorizonTrack[] = useMemo(
    () =>
      items.map((org) => ({
        id: org.id,
        code: org.name,
        subtitle: org.countryCode,
        statusLabel: org.type,
        tone: org.type === 'COOPERATIVE' ? 'green' : 'blue',
        leftCode: org.countryCode,
        rightCode: org.type.slice(0, 7),
        progressPct: 100,
        icon: 'business-outline',
        onPress: () => router.push(`/organization/${org.id}` as never),
      })),
    [items],
  );

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader
        title={t('ui.monOrganisation')}
        subtitle={t('ui.structuresCooperativesEtGouvernance')}
        ctaLabel={t('ui.creer')}
        onCtaPress={() => router.push('/organization/create')}
      />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.monOrganisation')} icon="business-outline">
          {query.isLoading ? (
            <LoadingState count={2} height={110} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title={t('ui.aucuneOrganisation')}
              description={t('ui.creezUneOrganisationOuRejoignezUne')}
              icon="business-outline"
              action={{ label: t('ui.creerUneOrganisation'), onPress: () => router.push('/organization/create') }}
            />
          ) : (
            <View style={styles.stack}>
              <MobileHorizonOverviewCard
                title={t('ui.vueDEnsembleDesStructures')}
                items={[
                  {
                    id: 'total',
                    label: t('ui.organisations'),
                    value: formatNumber(items.length, locale),
                    subtitle: t('ui.rattacheesAVotreSession'),
                    badge: t('ui.actives'),
                    tone: 'green',
                    icon: 'business-outline',
                    onPress: () => router.push('/organization/overview'),
                  },
                  {
                    id: 'coop',
                    label: t('ui.cooperatives'),
                    value: formatNumber(coops.length, locale),
                    subtitle: t('ui.collecteVentesGroupees'),
                    badge: t('ui.coop03'),
                    tone: 'blue',
                    icon: 'people-outline',
                    onPress: () => router.push('/organization/members'),
                  },
                  {
                    id: 'comp',
                    label: t('ui.entreprises'),
                    value: formatNumber(companies.length, locale),
                    subtitle: t('ui.exploitationsStructurees'),
                    tone: 'amber',
                    icon: 'briefcase-outline',
                  },
                  {
                    id: 'verif',
                    label: t('ui.gouvernance'),
                    value: t('ui.kpiValueSteering'),
                    subtitle: t('ui.membresOffresCommandes'),
                    badge: t('ui.ouvrir'),
                    tone: 'green',
                    icon: 'shield-checkmark-outline',
                    onPress: () => router.push('/organization/overview'),
                  },
                ]}
              />

              <MobileHorizonTrackCard title={t('ui.structuresRattachees')} items={tracks} />

              <MobileHorizonDonutCard
                title={t('ui.typologieDesStructures')}
                totalValue={formatNumber(items.length, locale)}
                totalLabel={t('ui.organisations')}
                segments={[
                  { label: t('ui.cooperatives'), value: coops.length, tone: 'green' },
                  { label: t('ui.entreprises'), value: companies.length, tone: 'blue' },
                  {
                    label: t('ui.autres'),
                    value: Math.max(0, items.length - coops.length - companies.length),
                    tone: 'amber',
                  },
                ]}
              />
            </View>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  stack: { gap: SPACING.md },
});
