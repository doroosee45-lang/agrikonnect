import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { adminApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function AdminUsers() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.admin.users({ limit: 100 }),
    queryFn: () => adminApi.users({ limit: 100 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Utilisateurs" subtitle="Tous les comptes." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Utilisateurs" icon="people-outline">
          {query.isLoading ? <LoadingState count={3} height={90} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucun utilisateur" description="Aucun compte." icon="people-outline" /> : (
            <View style={styles.list}>
              {items.map((row, index) => {
                const user = row as Record<string, unknown>;
                return (
                  <Reveal key={String(user.id ?? index)} index={index} variant="up">
                    <Card tone="white" style={styles.row}>
                      <View style={styles.rowBody}>
                        <Text preset="bodyMedium">{String(user.firstName ?? '')} {String(user.lastName ?? '')}</Text>
                        <Text preset="caption" color={COLORS.slateGray}>{String(user.email ?? user.phone ?? '—')}</Text>
                      </View>
                      <Chip label={String(user.status ?? '—')} tone={String(user.status) === 'ACTIVE' ? 'success' : 'neutral'} size="sm" />
                    </Card>
                  </Reveal>
                );
              })}
            </View>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 } });
