import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { authApi, organizationApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** Adhésions en attente : le backend ne sépare pas « invitation » et « adhésion PENDING ». */
export default function OrganizationInvitations() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const me = useQuery({ queryKey: queryKeys.me, queryFn: () => authApi.me().then((r) => r.data), enabled: isAuthenticated, retry: false });
  const organizationId = me.data?.activeOrganizationId ?? null;
  const query = useQuery({
    queryKey: [...queryKeys.organizations.one(organizationId ?? ''), 'invitations'] as unknown[],
    queryFn: () => organizationApi.get(organizationId ?? '').then((r) => r.data),
    enabled: isAuthenticated && Boolean(organizationId),
    retry: false,
  });
  const items = (query.data?.memberships ?? []).filter((m) => m.status !== 'ACTIVE');
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Invitations" subtitle="Adhésions en attente de confirmation." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Invitations" icon="mail-outline">
          {query.isLoading ? <LoadingState count={2} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucune invitation" description="Aucune adhésion en attente." icon="mail-outline" /> : (
            <View style={styles.list}>
              {items.map((membership, index) => (
                <Reveal key={membership.id} index={index} variant="up">
                  <Card tone="white" style={styles.row}>
                    <View style={styles.rowBody}>
                      <Text preset="bodyMedium">{membership.user ? `${membership.user.firstName} ${membership.user.lastName}` : 'Invitation'}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>{membership.user?.email ?? 'adresse non renseignée'} · {formatDate(membership.joinedAt, locale)}</Text>
                    </View>
                    <Chip label={membership.status} tone="warning" size="sm" />
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
