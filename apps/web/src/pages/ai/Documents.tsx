import { ResourcePage } from '@/components/pages';
import { aiApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { AiAnalysis } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** AI — documents générés (AI-06 → AI-09), langue et type explicites. */
export default function AiDocuments() {
  const { locale } = useI18n();
  return (
    <ResourcePage<AiAnalysis>
      title="Documents générés"
      subtitle="Fiches techniques, synthèses et plans de campagne générés par l'IA."
      icon="📄"
      queryKey={queryKeys.ai.list({ limit: 100, type: 'DOCUMENT' })}
      fetch={() => aiApi.list({ limit: 100, type: 'DOCUMENT' }).then((result) => result.data)}
      rowKey={(document) => document.id}
      notice="Les documents sont générés par une IA. Ils doivent être relus et validés par un expert avant toute utilisation."
      columns={[
        { key: 'type', label: 'Type', render: (document) => <Chip label={document.type} tone="neutral" size="sm" /> },
        { key: 'status', label: 'Statut', render: (document) => <Chip label={document.status} tone="neutral" size="sm" /> },
        { key: 'createdAt', label: 'Généré le', render: (document) => formatDate(document.createdAt, locale) },
      ]}
      emptyTitle="Aucun document"
      emptyDescription="Les documents générés apparaîtront ici."
    />
  );
}
