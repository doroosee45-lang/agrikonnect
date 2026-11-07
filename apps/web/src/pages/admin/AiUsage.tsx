import { ResourcePage } from '@/components/pages';
import { aiApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { AiAnalysis } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** ADMIN — usage de l'IA : analyses, escalades, statuts. */
export default function AdminAiUsage() {
  const { locale } = useI18n();
  return (
    <ResourcePage<AiAnalysis>
      title="Usage IA"
      subtitle="Analyses générées, avec leur statut et leur consentement."
      icon="✨"
      queryKey={queryKeys.ai.list({ limit: 100 })}
      fetch={() => aiApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(analysis) => analysis.id}
      columns={[
        { key: 'type', label: 'Type', render: (analysis) => analysis.type },
        { key: 'prompt', label: 'Question', render: (analysis) => analysis.prompt ?? '—' },
        { key: 'status', label: 'Statut', render: (analysis) => <Chip label={analysis.status} tone={analysis.status === 'ESCALATED' ? 'warning' : 'info'} size="sm" /> },
        { key: 'createdAt', label: 'Créée le', render: (analysis) => formatDate(analysis.createdAt, locale) },
      ]}
      emptyTitle="Aucune analyse"
      emptyDescription="Aucune analyse IA n'a été générée."
      notice="Aucune analyse n'est générée sans consentement explicite, daté et réversible."
    />
  );
}
