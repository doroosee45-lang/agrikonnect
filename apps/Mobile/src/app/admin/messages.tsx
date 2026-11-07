import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Reveal, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { messagingApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function AdminMessages() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const query = useQuery({
    queryKey: queryKeys.messaging.conversations,
    queryFn: () => messagingApi.conversations({ limit: 100 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const items = query.data?.items ?? [];
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Conversations" subtitle="Messagerie interne." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Conversations" icon="chatbubbles-outline">
          {query.isLoading ? <LoadingState count={3} height={80} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="Aucune conversation" description="Aucune conversation." icon="chatbubbles-outline" /> : (
            <View style={styles.list}>
              {items.map((conversation, index) => (
                <Reveal key={conversation.id} index={index} variant="up">
                  <Card tone="white" style={styles.row}>
                    <View style={styles.rowBody}>
                      <Text preset="bodySm">{conversation.subjectType ?? '—'}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {conversation.lastMessage ? formatDate(conversation.lastMessage.createdAt, locale) : '—'}
                      </Text>
                    </View>
                    <View style={styles.rowAside}>
                      <Chip label={conversation.status} tone={conversation.status === 'BLOCKED' ? 'error' : 'neutral'} size="sm" />
                      {conversation.unread > 0 ? <Chip label={`${conversation.unread} non lus`} tone="warning" size="sm" /> : null}
                    </View>
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
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { gap: SPACING.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rowBody: { flex: 1, gap: 2 }, rowAside: { alignItems: 'flex-end', gap: 4 } });
