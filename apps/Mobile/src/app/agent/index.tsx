import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate,
  ErrorState,
  LoadingState,
  MobileHorizonDonutCard,
  MobileHorizonOverviewCard,
  MobileHorizonTrackCard,
  PressableCard,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import type { MobileHorizonTrack } from '@/components/ui';
import { useI18n, tr } from '@/i18n';
import { formatDate, formatNumber } from '@/lib/format';
import { aiApi, verificationApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const TOOLS = [
  { href: '/agent/registration', get label() { return tr('ui.enrolerUnProducteur_3d138'); }, get hint() { return tr('ui.creationSousMandatTrace'); } },
  { href: '/agent/consent', get label() { return tr('ui.consentementAssiste'); }, get hint() { return tr('ui.recueilExpliciteTerrain'); } },
  { href: '/messages', get label() { return tr('ui.messagerie'); }, get hint() { return tr('ui.suiviDesFilsMetier'); } },
  { href: '/notifications', get label() { return tr('ui.notifications'); }, get hint() { return tr('ui.alertesEnTempsReel'); } },
] as const;

/** Poste Agent de terrain & Support Mobile (/agent) — Design Horizon 100 % API reelle. */
export default function Agent() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const queue = useQuery({
    queryKey: queryKeys.verifications.queue({ limit: 20 }),
    queryFn: () => verificationApi.adminQueue({ limit: 20 }).then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const escalations = useQuery({
    queryKey: queryKeys.ai.list({ status: 'ESCALATED' }),
    queryFn: () => aiApi.list({ status: 'ESCALATED', limit: 20 }).then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const pending = (queue.data ?? []).filter((item) => item.status === 'PENDING');
  const escalated = escalations.data ?? [];

  const tracks: MobileHorizonTrack[] = useMemo(
    () => [
      ...pending.slice(0, 2).map((v) => ({
        id: v.id,
        code: `${v.subjectType.slice(0, 6)}-${v.id.slice(0, 4).toUpperCase()}`,
        subtitle: formatDate(v.createdAt, locale),
        statusLabel: t('ui.enAttente'),
        tone: 'amber' as const,
        leftCode: v.level,
        rightCode: t('ui.trackCodeReview'),
        progressPct: 50,
        icon: 'shield-checkmark-outline' as const,
        onPress: () => router.push('/reviewer'),
      })),
      ...escalated.slice(0, 2).map((a) => ({
        id: a.id,
        code: `IA-${a.id.slice(0, 5).toUpperCase()}`,
        subtitle: formatDate(a.createdAt, locale),
        statusLabel: t('ui.escaladee'),
        tone: 'red' as const,
        leftCode: a.type.slice(0, 6),
        rightCode: 'AI-10',
        progressPct: 70,
        icon: 'sparkles-outline' as const,
        onPress: () => router.push('/reviewer'),
      })),
    ],
    [pending, escalated, locale],
  );

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader
        title={t('ui.agentDeTerrain')}
        subtitle={t('ui.enrolementSousMandatEscaladesEtSupport')}
        ctaLabel={t('ui.enroler')}
        onCtaPress={() => router.push('/agent/registration')}
      />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title={t('ui.accesAgent')}
          description={t('ui.connectezVousAvecUnRoleAgent')}
          icon="people-outline"
        >
          {queue.isLoading && escalations.isLoading ? (
            <LoadingState count={2} height={110} />
          ) : queue.isError && escalations.isError ? (
            <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />
          ) : (
            <>
              <MobileHorizonOverviewCard
                title={t('ui.chargeDAccompagnementEnCours')}
                items={[
                  {
                    id: 'ver',
                    label: t('ui.verifications'),
                    value: formatNumber(pending.length, locale),
                    subtitle: t('ui.dossiersTerrainEnAttente'),
                    tone: pending.length > 0 ? 'amber' : 'green',
                    icon: 'shield-checkmark-outline',
                    onPress: () => router.push('/reviewer'),
                  },
                  {
                    id: 'ai',
                    label: t('ui.escaladesIa'),
                    value: formatNumber(escalated.length, locale),
                    subtitle: t('ui.validationHumaineAi10'),
                    tone: escalated.length > 0 ? 'red' : 'green',
                    icon: 'sparkles-outline',
                    onPress: () => router.push('/reviewer'),
                  },
                  {
                    id: 'reg',
                    label: t('ui.enrolement'),
                    value: t('ui.kpiValueMandate'),
                    subtitle: t('ui.producteursAssistes'),
                    badge: 'AG-01',
                    tone: 'green',
                    icon: 'person-add-outline',
                    onPress: () => router.push('/agent/registration'),
                  },
                  {
                    id: 'msg',
                    label: t('ui.supportFils'),
                    value: t('ui.kpiValueDirect'),
                    subtitle: t('ui.messagerieMetier'),
                    tone: 'blue',
                    icon: 'chatbubbles-outline',
                    onPress: () => router.push('/messages'),
                  },
                ]}
              />

              <MobileHorizonTrackCard
                title={t('ui.filesPrioritaires')}
                items={tracks}
                emptyMessage={t('ui.aucunDossierEnAttenteDeTraitement')}
              />

              <MobileHorizonDonutCard
                title={t('ui.repartitionDeLaCharge')}
                totalValue={formatNumber(pending.length + escalated.length, locale)}
                totalLabel={t('ui.dossiers')}
                segments={[
                  { label: t('ui.verifications'), value: pending.length, tone: 'amber' },
                  { label: t('ui.escaladesIa'), value: escalated.length, tone: 'red' },
                ]}
              />

              <View style={styles.grid}>
                {TOOLS.map((tool, index) => (
                  <Reveal key={tool.href} index={index} variant="up" style={styles.cell}>
                    <PressableCard onPress={() => router.push(tool.href as never)}>
                      <Text preset="bodyMedium">{tool.label}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {tool.hint}
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  cell: { flexGrow: 1, flexBasis: '46%' },
});
