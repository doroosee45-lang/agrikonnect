import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { notificationApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function FarmerNotifications() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.notifications.list({ limit: 100 }),
    queryFn: () => notificationApi.list({ limit: 100 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data?.items ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title="Notifications" subtitle="Vos notifications." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Notifications" icon="notifications-outline">
          {query.isLoading ? <LoadingState count={3} height={80} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucune notification" description="Vos notifications apparaîtront ici." icon="notifications-outline" /> : (
            <View style={styles.list}>
              {items.map((notification, index) => (
                <Reveal key={notification.id} index={index} variant="up">
                  <Card tone={notification.readAt ? 'white' : 'pale'} style={styles.row}>
                    <View style={styles.rowBody}>
                      <Text preset="bodySm">{notification.title}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>{formatDate(notification.createdAt, locale)}</Text>
                    </View>
                    {!notification.readAt ? <Chip label="nouveau" tone="warning" size="sm" /> : null}
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
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 } });
