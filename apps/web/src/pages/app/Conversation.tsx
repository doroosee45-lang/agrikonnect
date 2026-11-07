import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthGate, Button, Card, Chip, EmptyState, ErrorState, Input, LoadingState, Section, Text } from '@/components/ui';
import { messagingApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatRelative } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

/** APP — fil d'une conversation rattachée à un objet métier. */
export default function AppConversation() {
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<unknown>(null);

  const thread = useQuery({
    queryKey: queryKeys.messaging.messages(id ?? ''),
    queryFn: () => messagingApi.messages(id ?? '', { limit: 100 }).then((result) => result.data),
    enabled: isAuthenticated && Boolean(id),
  });

  const send = useMutation({
    mutationFn: () => messagingApi.send(id ?? '', { body: draft.trim() }),
    onSuccess: () => {
      setError(null);
      setDraft('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.messaging.messages(id ?? '') });
      void queryClient.invalidateQueries({ queryKey: queryKeys.messaging.conversations });
    },
    onError: (caught) => setError(caught),
  });

  const messages = thread.data?.items ?? [];

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Conversation" description="Fil de discussion." icon="💬">
        <div style={{ marginBottom: 24 }}>
          <Link to="/app/messages" style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>
            ← Retour à la messagerie
          </Link>
        </div>

        <Card tone="white" style={{ display: 'flex', flexDirection: 'column', minHeight: 480 }}>
          {thread.isLoading ? (
            <LoadingState count={4} height={60} />
          ) : thread.isError ? (
            <ErrorState error={thread.error} onRetry={() => void thread.refetch()} showRequestId />
          ) : (
            <>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16, maxHeight: 460 }}>
                {messages.length === 0 ? (
                  <EmptyState title="Aucun message" description="Envoyez le premier message de cette conversation." icon="✉️" />
                ) : (
                  messages.map((message, index) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: DURATION.fast / 1000, delay: Math.min(index, 12) * 0.02, ease: EASE.out }}
                      style={{ alignSelf: 'flex-start', maxWidth: '80%', padding: '10px 14px', backgroundColor: COLORS.paleGreen, borderRadius: 'var(--radius-md)' }}
                    >
                      <Text preset="bodySm" color={COLORS.textPrimary} style={{ lineHeight: 1.6 }}>
                        {message.body}
                      </Text>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                        <Text preset="caption" color={COLORS.slateGray}>
                          {formatRelative(message.createdAt, locale)}
                        </Text>
                        {message.attachments.length > 0 ? <Chip label={`${message.attachments.length} pièce(s)`} tone="neutral" size="sm" /> : null}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {error ? (
                <div style={{ marginBottom: 12 }}>
                  <ErrorState error={error} showRequestId />
                </div>
              ) : null}

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (draft.trim()) send.mutate();
                }}
                style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}
              >
                <div style={{ flex: 1 }}>
                  <Input label="Message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Écrivez votre message…" maxLength={3000} />
                </div>
                <Button label="Envoyer" type="submit" loading={send.isPending} disabled={!draft.trim()} />
              </form>
            </>
          )}
        </Card>
      </AuthGate>
    </Section>
  );
}
