import { useParams } from 'react-router-dom';

import { ResourcePage } from '@/components/pages';
import { projectDataApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

type AccessEntry = Record<string, unknown>;

/** FARMER — journal des accès à la salle de données (DATA-06). */
export default function FarmerProjectAccessLog() {
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();

  return (
    <ResourcePage<AccessEntry>
      title="Journal d'accès"
      subtitle="Consultations de la salle de données : qui, quand, quel document."
      icon="🔐"
      queryKey={[...queryKeys.projects.one(id ?? ''), 'access-log'] as unknown[]}
      fetch={() => projectDataApi.accessLog(id ?? '').then((result) => result.data as unknown as AccessEntry[])}
      rowKey={(entry) => String(entry.id)}
      notice="Ce journal est conservé et consultable : tout accès à un document partagé est tracé."
      columns={[
        { key: 'document', label: 'Document', render: (entry) => String(entry.documentName ?? entry.documentId ?? '—') },
        { key: 'actor', label: 'Par', render: (entry) => String(entry.actorName ?? entry.actorId ?? '—') },
        { key: 'action', label: 'Action', render: (entry) => <Chip label={String(entry.action ?? '—')} tone="neutral" size="sm" /> },
        { key: 'at', label: 'Le', render: (entry) => (entry.accessedAt ? formatDate(String(entry.accessedAt), locale) : '—') },
      ]}
      emptyTitle="Aucun accès"
      emptyDescription="Aucune consultation n'a encore été enregistrée."
    />
  );
}
