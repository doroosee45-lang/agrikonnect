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

/** Membres de l'organisation active (adhésions + rôles + consentements). */
export default function OrganizationMembers() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const me = useQuery({ queryKey: queryKeys.me, queryFn: () => authApi.me().then((r) => r.data), enabled: isAuthenticated, retry: false });
  const organizationId = me.data?.activeOrganizationId ?? null;
  const query = useQuery({
    queryKey: queryKeys.organizations.one(organizationId ?? ''),
    queryFn: () => organizationApi.get(organizationId ?? '').then((r) => r.data),
    enabled: isAuthenticated && Boolean(organizationId),
    retry: false,
  });
  const items = query.data?.memberships ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Membres" subtitle="Accès, rôles et consentements." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Membres" icon="people-outline">
          {query.isLoading ? <LoadingState count={3} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucun membre" description="Aucune adhésion enregistrée." icon="people-outline" /> : (
            <View style={styles.list}>
              {items.map((membership, index) => (
                <Reveal key={membership.id} index={index} variant="up">
                  <Card tone="white" style={styles.row}>
                    <View style={styles.rowBody}>
                      <Text preset="bodyMedium">{membership.user ? `${membership.user.firstName} ${membership.user.lastName}` : 'Membre'}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {membership.roles.join(', ') || 'sans rôle'} · depuis {formatDate(membership.joinedAt, locale)}
                      </Text>
                      {membership.consentScopes && membership.consentScopes.length > 0 ? (
                        <Text preset="caption" color={COLORS.slateGray}>Consentements : {membership.consentScopes.join(', ')}</Text>
                      ) : null}
                    </View>
                    <Chip label={membership.status} tone={membership.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm" />
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
