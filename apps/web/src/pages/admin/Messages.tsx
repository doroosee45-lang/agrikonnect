import { ResourcePage } from '@/components/pages';
import { messagingApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Conversation } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** ADMIN — conversations et modération. */
export default function AdminMessages() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<Conversation>
      title={t('ui.conversations')}
      subtitle={t('ui.conversationsEntreProducteursEtAcheteurs')}
      icon="💬"
      queryKey={queryKeys.messaging.conversations}
      fetch={() => messagingApi.conversations({ limit: 100 }).then((result) => result.data.items)}
      rowKey={(conversation) => conversation.id}
      columns={[
        { key: 'id', label: 'ID', render: (conversation) => <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{conversation.id}</span> },
        { key: 'status', label: t('ui.statut'), render: (conversation) => <Chip label={conversation.status} tone={conversation.status === 'BLOCKED' ? 'error' : 'neutral'} size="sm" /> },
        { key: 'lastMessage', label: t('ui.dernierMessage'), render: (conversation) => (conversation.lastMessage ? formatDate(conversation.lastMessage.createdAt, locale) : '—') },
        { key: 'unread', label: t('ui.nonLus'), render: (conversation) => conversation.unread },
      ]}
      emptyTitle={t('ui.aucuneConversation')}
      emptyDescription={t('ui.aucuneConversationNAEncoreEte')}
    />
  );
}
