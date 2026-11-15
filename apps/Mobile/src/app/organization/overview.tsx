import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate,
  Button,
  Card,
  ErrorState,
  LoadingState,
  MobileHorizonDonutCard,
  MobileHorizonOverviewCard,
  PressableCard,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n, tr } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { authApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const SHORTCUTS = [
  { href: '/organization/profile', get label() { return tr('ui.profil'); }, get hint() { return tr('ui.identiteDeLOrganisation'); } },
  { href: '/organization/members', get label() { return tr('ui.membres'); }, get hint() { return tr('ui.accesRolesConsentements'); } },
  { href: '/organization/farms', get label() { return tr('ui.exploitations'); }, get hint() { return tr('ui.sitesRattaches'); } },
  { href: '/organization/orders', get label() { return tr('ui.commandes'); }, get hint() { return tr('ui.ventesEtAchats'); } },
  { href: '/organization/offers', get label() { return tr('ui.offresGroupees'); }, get hint() { return tr('ui.commercialisationCollective'); } },
  { href: '/organization/production-summary', get label() { return tr('ui.production'); }, get hint() { return tr('ui.volumesConsolides'); } },
  { href: '/organization/transport', get label() { return tr('ui.transport'); }, get hint() { return tr('ui.logistiquePod'); } },
  { href: '/organization/verification', get label() { return tr('ui.verification_bb27a'); }, get hint() { return tr('ui.niveauDePreuve'); } },
  { href: '/organization/invitations', get label() { return tr('ui.invitations'); }, get hint() { return tr('ui.membresEnAttente'); } },
  { href: '/organization/member-import', get label() { return tr('ui.importCsv'); }, get hint() { return tr('ui.ajoutEnMasse'); } },
] as const;

/** Vue d'ensemble Organisation Mobile (/organization/overview) — Design Horizon 100 % API reelle. */
export default function OrganizationOverview() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => authApi.me().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const organizationId = me.data?.activeOrganizationId ?? null;
  const activeOrgName =
    me.data?.user.organizations.find((o) => o.id === organizationId)?.name ?? t('ui.organisationActive');
  const counts = me.data?.counts;
  const pct = Math.round(me.data?.completeness.percent ?? 0);

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader
        title={t('ui.pilotageOrganisation')}
        subtitle={activeOrgName}
        ctaLabel={t('ui.membres')}
        onCtaPress={() => router.push('/organization/members')}
      />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.organisation_6e99c')} icon="business-outline">
          {me.isLoading ? (
            <LoadingState count={2} height={110} />
          ) : me.isError ? (
            <ErrorState error={me.error} onRetry={() => void me.refetch()} />
          ) : !organizationId ? (
            <Card tone="pale">
              <Text preset="bodySm" color={COLORS.slateGray}>{t('ui.aucuneOrganisationActiveSurCeCompte')}</Text>
              <Button
                label={t('ui.creerUneOrganisation')}
                variant="primary"
                onPress={() => router.push('/organization/create')}
                style={styles.mt}
              />
            </Card>
          ) : (
            <>
              <MobileHorizonOverviewCard
                title={activeOrgName}
                items={[
                  {
                    id: 'farms',
                    label: t('ui.exploitations'),
                    value: formatNumber(counts?.farms ?? 0, locale),
                    subtitle: t('ui.sitesRattaches'),
                    tone: 'green',
                    icon: 'home-outline',
                    onPress: () => router.push('/organization/farms'),
                  },
                  {
                    id: 'plots',
                    label: t('ui.parcelles'),
                    value: formatNumber(counts?.plots ?? 0, locale),
                    subtitle: t('ui.sousConsentement'),
                    tone: 'blue',
                    icon: 'map-outline',
                    onPress: () => router.push('/organization/production-summary'),
                  },
                  {
                    id: 'prods',
                    label: t('ui.productions'),
                    value: formatNumber(counts?.productions ?? 0, locale),
                    subtitle: t('ui.volumesConsolides'),
                    tone: 'amber',
                    icon: 'stats-chart-outline',
                    onPress: () => router.push('/organization/offers'),
                  },
                  {
                    id: 'comp',
                    label: t('ui.completudeProfil'),
                    value: `${pct}%`,
                    subtitle: t('ui.dossierStructure'),
                    badge: pct >= 80 ? t('ui.complet') : t('ui.enCours_bc9b5'),
                    tone: pct >= 80 ? 'green' : 'amber',
                    icon: 'shield-checkmark-outline',
                    onPress: () => router.push('/organization/verification'),
                  },
                ]}
              />

              <MobileHorizonDonutCard
                title={t('ui.repartitionDesActifsRattaches')}
                totalValue={`${pct}%`}
                totalLabel={t('ui.completude_2d727')}
                segments={[
                  { label: t('ui.exploitations'), value: counts?.farms ?? 0, tone: 'green' },
                  { label: t('ui.parcelles'), value: counts?.plots ?? 0, tone: 'blue' },
                  { label: t('ui.productions'), value: counts?.productions ?? 0, tone: 'amber' },
                ]}
              />

              <View style={styles.grid}>
                {SHORTCUTS.map((item, index) => (
                  <Reveal key={item.href} index={index} variant="up" style={styles.cell}>
                    <PressableCard onPress={() => router.push(item.href as never)}>
                      <Text preset="bodyMedium">{item.label}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {item.hint}
                      </Text>
                    </PressableCard>
                  </Reveal>
                ))}
              </View>
            </>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  mt: { marginTop: SPACING.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  cell: { flexGrow: 1, flexBasis: '46%' },
});
