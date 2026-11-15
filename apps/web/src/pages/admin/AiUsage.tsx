import { ResourcePage } from '@/components/pages';
import { aiApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { AiAnalysis } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** ADMIN — usage de l'IA : analyses, escalades, statuts. */
export default function AdminAiUsage() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<AiAnalysis>
      title={t('ui.usageIa')}
      subtitle={t('ui.analysesGenereesAvecLeurStatutEt')}
      icon="✨"
      queryKey={queryKeys.ai.list({ limit: 100 })}
      fetch={() => aiApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(analysis) => analysis.id}
      columns={[
        { key: 'type', label: t('ui.type'), render: (analysis) => analysis.type },
        { key: 'prompt', label: t('ui.question'), render: (analysis) => analysis.prompt ?? '—' },
        { key: 'status', label: t('ui.statut'), render: (analysis) => <Chip label={analysis.status} tone={analysis.status === 'ESCALATED' ? 'warning' : 'info'} size="sm" /> },
        { key: 'createdAt', label: t('ui.creeeLe'), render: (analysis) => formatDate(analysis.createdAt, locale) },
      ]}
      emptyTitle={t('ui.aucuneAnalyse')}
      emptyDescription={t('ui.aucuneAnalyseIaNAEte')}
      notice={t('ui.aucuneAnalyseNEstGenereeSans')}
    />
  );
}
