import { ResourcePage } from '@/components/pages';
import { aiApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { AiAnalysis } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** AI — historique des analyses (AI-01 → AI-05), disclaimer obligatoire. */
export default function AiAnalyses() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<AiAnalysis>
      title={t('ui.analysesIa')}
      subtitle={t('ui.historiqueDeVosAnalysesChaqueReponse')}
      icon="🤖"
      queryKey={queryKeys.ai.list({ limit: 100 })}
      fetch={() => aiApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(analysis) => analysis.id}
      rowHref={(analysis) => `/ai/analyses/${analysis.id}`}
      notice={t('ui.lesReponsesSontGenereesParUne')}
      columns={[
        { key: 'type', label: t('ui.type'), render: (analysis) => <Chip label={analysis.type} tone="neutral" size="sm" /> },
        { key: 'status', label: t('ui.statut'), render: (analysis) => <Chip label={analysis.status} tone={analysis.status === 'ESCALATED' ? 'warning' : 'neutral'} size="sm" /> },
        { key: 'createdAt', label: t('ui.creeeLe'), render: (analysis) => formatDate(analysis.createdAt, locale) },
      ]}
      emptyTitle={t('ui.aucuneAnalyse')}
      emptyDescription={t('ui.vosAnalysesApparaitrontIci')}
    />
  );
}
