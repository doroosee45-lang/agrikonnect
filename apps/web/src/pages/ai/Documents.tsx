import { ResourcePage } from '@/components/pages';
import { aiApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { AiAnalysis } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** AI — documents générés (AI-06 → AI-09), langue et type explicites. */
export default function AiDocuments() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<AiAnalysis>
      title={t('ui.documentsGeneres')}
      subtitle={t('ui.fichesTechniquesSynthesesEtPlansDe')}
      icon="📄"
      queryKey={queryKeys.ai.list({ limit: 100, type: 'DOCUMENT' })}
      fetch={() => aiApi.list({ limit: 100, type: 'DOCUMENT' }).then((result) => result.data)}
      rowKey={(document) => document.id}
      notice={t('ui.lesDocumentsSontGeneresParUne')}
      columns={[
        { key: 'type', label: t('ui.type'), render: (document) => <Chip label={document.type} tone="neutral" size="sm" /> },
        { key: 'status', label: t('ui.statut'), render: (document) => <Chip label={document.status} tone="neutral" size="sm" /> },
        { key: 'createdAt', label: t('ui.genereLe'), render: (document) => formatDate(document.createdAt, locale) },
      ]}
      emptyTitle={t('ui.aucunDocument')}
      emptyDescription={t('ui.lesDocumentsGeneresApparaitrontIci')}
    />
  );
}
