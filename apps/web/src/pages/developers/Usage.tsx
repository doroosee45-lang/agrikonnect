import { ResourcePage } from '@/components/pages';
import { apiClientApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { ApiClient } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** DEVELOPERS — consommation API : quotas et historique des appels. */
export default function DevelopersUsage() {
  const { locale } = useI18n();
  return (
    <ResourcePage<ApiClient>
      title="Consommation API"
      subtitle="Quotas et historique des appels par clé."
      icon="📊"
      queryKey={queryKeys.apiClients.all}
      fetch={() => apiClientApi.clients().then((result) => result.data)}
      rowKey={(client) => client.id}
      columns={[
        { key: 'name', label: 'Client', render: (client) => client.name },
        { key: 'status', label: 'Statut', render: (client) => <Chip label={client.status} tone="neutral" size="sm" /> },
        { key: 'createdAt', label: 'Créé le', render: (client) => formatDate(client.createdAt, locale) },
      ]}
      emptyTitle="Aucun client"
      emptyDescription="Aucun client API n'a encore été créé."
    />
  );
}
