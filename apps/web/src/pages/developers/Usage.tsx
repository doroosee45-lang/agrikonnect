import { ResourcePage } from '@/components/pages';
import { apiClientApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { ApiClient } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** DEVELOPERS — consommation API : quotas et historique des appels. */
export default function DevelopersUsage() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<ApiClient>
      title={t('ui.consommationApi')}
      subtitle={t('ui.quotasEtHistoriqueDesAppelsPar')}
      icon="📊"
      queryKey={queryKeys.apiClients.all}
      fetch={() => apiClientApi.clients().then((result) => result.data)}
      rowKey={(client) => client.id}
      columns={[
        { key: 'name', label: t('ui.client'), render: (client) => client.name },
        { key: 'status', label: t('ui.statut'), render: (client) => <Chip label={client.status} tone="neutral" size="sm" /> },
        { key: 'createdAt', label: t('ui.creeLe'), render: (client) => formatDate(client.createdAt, locale) },
      ]}
      emptyTitle={t('ui.aucunClient')}
      emptyDescription={t('ui.aucunClientApiNAEncore')}
    />
  );
}
