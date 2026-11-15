import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { authApi, reviewApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function FarmerReviews() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const me = useQuery({ queryKey: queryKeys.me, queryFn: () => authApi.me().then((r) => r.data), enabled: isAuthenticated, retry: false });
  const organizationId = me.data?.activeOrganizationId ?? null;
  const query = useQuery({
    queryKey: queryKeys.reviews.reputation(organizationId ?? ''),
    queryFn: () => reviewApi.reputation(organizationId ?? '').then((r) => r.data),
    enabled: isAuthenticated && Boolean(organizationId),
    retry: false,
  });
  const reputation = query.data;
  const items = reputation?.reviews ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title={t('ui.avis')} subtitle={t('ui.avisLaissesParVosPartenaires')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.avis')} icon="star-outline">
          {query.isLoading ? <LoadingState count={3} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : (
            <>
              {reputation ? (
                <Card tone="white" style={styles.card}>
                  <Text preset="h3">{reputation.average !== null ? `${reputation.average.toFixed(1)} / 5` : t('ui.pasEncoreNote')}</Text>
                  <Text preset="caption" color={COLORS.slateGray}>{reputation.count} avis</Text>
                </Card>
              ) : null}
              {items.length === 0 ? <EmptyState title={t('ui.aucunAvis')} description={t('ui.lesAvisDeVosPartenairesApparaitront')} icon="star-outline" /> : (
                <View style={styles.list}>
                  {items.map((review, index) => (
                    <Reveal key={review.id} index={index} variant="up">
                      <Card tone="white" style={styles.row}>
                        <View style={styles.rowBody}>
                          <Text preset="bodySm">{review.comment ?? t('ui.aucunCommentaire')}</Text>
                          <Text preset="caption" color={COLORS.slateGray}>{formatDate(review.createdAt, locale)}</Text>
                        </View>
                        <Chip label={`${review.rating}/5`} tone="neutral" size="sm" />
                      </Card>
                    </Reveal>
                  ))}
                </View>
              )}
            </>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, card: { gap: 4 }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 } });
