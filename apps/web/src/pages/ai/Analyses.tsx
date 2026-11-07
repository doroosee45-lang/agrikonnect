import { ResourcePage } from '@/components/pages';
import { aiApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { AiAnalysis } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** AI — historique des analyses (AI-01 → AI-05), disclaimer obligatoire. */
export default function AiAnalyses() {
  const { locale } = useI18n();
  return (
    <ResourcePage<AiAnalysis>
      title="Analyses IA"
      subtitle="Historique de vos analyses. Chaque réponse est accompagnée d'un avertissement produit."
      icon="🤖"
      queryKey={queryKeys.ai.list({ limit: 100 })}
      fetch={() => aiApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(analysis) => analysis.id}
      rowHref={(analysis) => `/ai/analyses/${analysis.id}`}
      notice="Les réponses sont générées par une IA. Elles ne remplacent pas un avis agronomique et doivent être confrontées au terrain."
      columns={[
        { key: 'type', label: 'Type', render: (analysis) => <Chip label={analysis.type} tone="neutral" size="sm" /> },
        { key: 'status', label: 'Statut', render: (analysis) => <Chip label={analysis.status} tone={analysis.status === 'ESCALATED' ? 'warning' : 'neutral'} size="sm" /> },
        { key: 'createdAt', label: 'Créée le', render: (analysis) => formatDate(analysis.createdAt, locale) },
      ]}
      emptyTitle="Aucune analyse"
      emptyDescription="Vos analyses apparaîtront ici."
    />
  );
}
