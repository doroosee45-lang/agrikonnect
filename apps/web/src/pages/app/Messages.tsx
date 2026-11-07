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

export default function Messages() {
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<unknown>(null);

  const conversations = useQuery({
    queryKey: queryKeys.messaging.conversations,
    queryFn: () => messagingApi.conversations({ limit: 50 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  const thread = useQuery({
    queryKey: queryKeys.messaging.messages(id!),
    queryFn: () => messagingApi.messages(id!, { limit: 100 }).then((result) => result.data),
    enabled: isAuthenticated && Boolean(id),
  });

  const send = useMutation({
    mutationFn: () => messagingApi.send(id!, { body: draft.trim() }),
    onSuccess: () => {
      setError(null);
      setDraft('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.messaging.messages(id!) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.messaging.conversations });
    },
    onError: (caught) => setError(caught),
  });

  const items = conversations.data?.items ?? [];
  const messages = thread.data?.items ?? [];

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title="Messagerie"
        description="Connectez-vous pour échanger avec les autres organisations."
        icon="💬"
      >
        <div style={{ marginBottom: 32 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Messagerie
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray}>
            Chaque conversation est rattachée à un objet métier : annonce, commande, transport, litige ou projet.
          </Text>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 340px) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
          <Card tone="white" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${COLORS.lightBorder}` }}>
              <Text preset="overline" color={COLORS.forestGreen}>
                Conversations
              </Text>
            </div>

            {conversations.isLoading ? (
              <div style={{ padding: 20 }}>
                <LoadingState count={3} height={60} />
              </div>
            ) : conversations.isError ? (
              <div style={{ padding: 20 }}>
                <ErrorState error={conversations.error} onRetry={() => void conversations.refetch()} />
              </div>
            ) : items.length === 0 ? (
              <EmptyState title="Aucune conversation" description="Contactez un vendeur depuis une annonce pour ouvrir un fil." icon="💬" />
            ) : (
              <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                {items.map((conversation) => {
                  const active = conversation.id === id;
                  return (
                    <Link
                      key={conversation.id}
                      to={`/messages/${conversation.id}`}
                      style={{
                        display: 'block',
                        padding: '14px 20px',
                        borderBottom: `1px solid ${COLORS.lightBorder}`,
                        backgroundColor: active ? COLORS.paleGreen : 'transparent',
                        textDecoration: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                        <Text preset="bodySm" color={COLORS.textPrimary} style={{ fontWeight: conversation.unread > 0 ? 600 : 400 }}>
                          {conversation.subjectType ?? 'Conversation'}
                        </Text>
                        {conversation.unread > 0 ? <Chip label={String(conversation.unread)} tone="forest" size="sm" /> : null}
                      </div>
                      <Text preset="caption" color={COLORS.slateGray} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conversation.lastMessage?.body ?? 'Aucun message'}
                      </Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {formatRelative(conversation.updatedAt, locale)}
                      </Text>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>

          <Card tone="white" style={{ display: 'flex', flexDirection: 'column', minHeight: 480 }}>
            {!id ? (
              <EmptyState title="Sélectionnez une conversation" description="Choisissez un fil dans la liste pour afficher les messages." icon="💬" />
            ) : thread.isLoading ? (
              <LoadingState count={4} height={60} />
            ) : thread.isError ? (
              <ErrorState error={thread.error} onRetry={() => void thread.refetch()} />
            ) : (
              <>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16, maxHeight: 420 }}>
                  {messages.length === 0 ? (
                    <EmptyState title="Aucun message" description="Envoyez le premier message de cette conversation." icon="✉️" />
                  ) : (
                    messages.map((message, index) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: DURATION.fast / 1000, delay: index * 0.02, ease: EASE.out }}
                        style={{
                          alignSelf: 'flex-start',
                          maxWidth: '80%',
                          padding: '10px 14px',
                          backgroundColor: COLORS.paleGreen,
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <Text preset="bodySm" color={COLORS.textPrimary} style={{ lineHeight: 1.6 }}>
                          {message.body}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 4 }}>
                          {formatRelative(message.createdAt, locale)}
                        </Text>
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
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (draft.trim()) send.mutate();
                  }}
                  style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}
                >
                  <div style={{ flex: 1 }}>
                    <Input
                      label="Message"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Écrivez votre message…"
                      maxLength={3000}
                    />
                  </div>
                  <Button label="Envoyer" type="submit" loading={send.isPending} disabled={!draft.trim()} />
                </form>
              </>
            )}
          </Card>
        </div>
      </AuthGate>
    </Section>
  );
}
