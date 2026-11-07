import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Card, ErrorState, Input, LoadingState, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { messagingApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function ConversationDetail() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const userId = useAuthStore((state) => state.user?.id);
  const [body, setBody] = useState('');
  const [error, setError] = useState<unknown>(null);

  const query = useQuery({
    queryKey: queryKeys.messaging.messages(conversationId ?? ''),
    queryFn: () => messagingApi.messages(conversationId ?? '', { limit: 50 }).then((r) => r.data),
    enabled: isAuthenticated && Boolean(conversationId),
    retry: false,
  });

  const send = useMutation({
    mutationFn: () => messagingApi.send(conversationId ?? '', { body }),
    onSuccess: () => { setBody(''); setError(null); void query.refetch(); },
    onError: (caught) => setError(caught),
  });

  const messages = query.data?.items ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Conversation" subtitle="Fil de discussion." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Conversation" icon="chatbubbles-outline">
          {query.isLoading ? <LoadingState count={3} height={80} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : (
            <>
              <FlatList
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Card tone={item.senderId === userId ? 'pale' : 'white'} style={styles.message}>
                    <Text preset="bodySm">{item.body}</Text>
                    <Text preset="caption" color={COLORS.slateGray}>{formatDate(item.createdAt, locale)}</Text>
                  </Card>
                )}
                style={styles.list}
              />
              <Card tone="white">
                <View style={styles.inputRow}>
                  <Input label="" value={body} onChangeText={setBody} placeholder="Écrire un message…" containerStyle={styles.input} />
                  <Button label="Envoyer" onPress={() => send.mutate()} loading={send.isPending} disabled={body.trim().length === 0} />
                </View>
                {error ? <ErrorState error={error} /> : null}
              </Card>
            </>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, list: { maxHeight: 400, marginBottom: SPACING.md }, message: { gap: 4 }, inputRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-end' }, input: { flex: 1 } });
