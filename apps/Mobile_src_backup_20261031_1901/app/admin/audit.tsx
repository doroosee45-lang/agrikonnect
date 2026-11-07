import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { adminApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function AdminAudit() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.admin.audit({ limit: 50 }),
    queryFn: () => adminApi.audit({ limit: 50 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Journal d'audit" subtitle="Traçabilité des actions administratives." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Journal d'audit" icon="time-outline">
          {query.isLoading ? <LoadingState count={3} height={80} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Journal vide" description="Aucune entrée d'audit." icon="time-outline" /> : (
            <View style={styles.list}>
              {items.map((row, index) => {
                const entry = row as Record<string, unknown>;
                return (
                  <Reveal key={String(entry.id ?? index)} index={index} variant="up">
                    <Card tone="white" style={styles.row}>
                      <View style={styles.rowBody}>
                        <Text preset="bodySm">{String(entry.action ?? '—')}{entry.resource ? ` · ${String(entry.resource)}` : ''}</Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          {entry.at ? formatDate(String(entry.at), locale) : entry.createdAt ? formatDate(String(entry.createdAt), locale) : '—'}
                          {entry.actorId ? ` · ${String(entry.actorId)}` : ''}
                        </Text>
                      </View>
                      <Chip label="tracé" tone="neutral" size="sm" />
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
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md }, rowBody: { flex: 1, gap: 2 } });
