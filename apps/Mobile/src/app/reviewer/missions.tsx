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
import { verificationApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** Missions Verificateur / Agronome / Labo Mobile (/reviewer/missions) — Design Horizon 100 % API reelle. */
export default function ReviewerMissions() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.verifications.queue({ limit: 100 }),
    queryFn: () => verificationApi.adminQueue({ limit: 100 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const items = query.data ?? [];
  const pending = items.filter((v) => v.status === 'PENDING');
  const verified = items.filter((v) => v.status === 'VERIFIED');
  const rejected = items.filter((v) => v.status === 'REJECTED');

  const tracks: MobileHorizonTrack[] = useMemo(
    () =>
      items.map((v) => ({
        id: String(v.id),
        code: String(v.subjectType ?? t('ui.trackCodeFile')),
        subtitle: t('ui.niveau_54639', { value: String(v.level ?? 'N1') }),
        statusLabel: String(v.status ?? 'PENDING'),
        tone: v.status === 'VERIFIED' ? 'green' : v.status === 'REJECTED' ? 'red' : 'amber',
        leftCode: String(v.level ?? 'N1'),
        rightCode: v.status === 'VERIFIED' ? t('ui.trackCodeValidated') : 'AUDIT',
        progressPct: v.status === 'VERIFIED' ? 100 : 55,
        icon: 'shield-checkmark-outline',
        onPress: () => router.push(`/reviewer/checklists/${String(v.id)}` as never),
      })),
    [items, t],
  );

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('ui.mesMissions')} subtitle={t('ui.verificationsEtAuditsAssignes')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.mesMissions')} icon="clipboard-outline">
          {query.isLoading ? (
            <LoadingState count={3} height={95} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <View style={styles.stack}>
              <MobileHorizonOverviewCard
                title={t('ui.fileDExpertiseAudit')}
                items={[
                  {
                    id: 'all',
                    label: t('ui.totalDossiers'),
                    value: formatNumber(items.length, locale),
                    subtitle: t('ui.dansVotreFile'),
                    tone: 'blue',
                    icon: 'clipboard-outline',
                  },
                  {
                    id: 'pend',
                    label: t('ui.aInstruire'),
                    value: formatNumber(pending.length, locale),
                    subtitle: t('ui.enAttenteDecision'),
                    badge: pending.length > 0 ? t('ui.prioritaire') : t('ui.aJour'),
                    tone: pending.length > 0 ? 'amber' : 'green',
                    icon: 'time-outline',
                  },
                  {
                    id: 'ver',
                    label: t('ui.valides'),
                    value: formatNumber(verified.length, locale),
                    subtitle: t('ui.criteresConformes'),
                    tone: 'green',
                    icon: 'checkmark-circle-outline',
                  },
                  {
                    id: 'rej',
                    label: t('ui.rejetes'),
                    value: formatNumber(rejected.length, locale),
                    subtitle: t('ui.nonConformes'),
                    tone: rejected.length > 0 ? 'red' : 'neutral',
                    icon: 'close-circle-outline',
                  },
                ]}
              />

              {items.length === 0 ? (
                <EmptyState
                  title={t('ui.aucuneMission')}
                  description={t('ui.aucuneVerificationNeVousEstAssignee')}
                  icon="clipboard-outline"
                />
              ) : (
                <MobileHorizonTrackCard title={t('ui.dossiersAInstruire')} items={tracks} />
              )}

              <MobileHorizonDonutCard
                title={t('ui.statutDesVerifications')}
                totalValue={formatNumber(items.length, locale)}
                totalLabel={t('ui.missions')}
                segments={[
                  { label: t('ui.validees'), value: verified.length, tone: 'green' },
                  { label: t('ui.enAttente'), value: pending.length, tone: 'amber' },
                  { label: t('ui.rejetees'), value: rejected.length, tone: 'red' },
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
