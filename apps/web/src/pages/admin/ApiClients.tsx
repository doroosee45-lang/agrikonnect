import { ResourcePage } from '@/components/pages';
import { apiClientApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { ApiClient } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** ADMIN — clients API enregistrés. */
export default function AdminApiClients() {
  const { locale } = useI18n();
  return (
    <ResourcePage<ApiClient>
      title="Clients API"
      subtitle="Intégrations tierces, avec finalité déclarée et statut."
      icon="🔑"
      queryKey={queryKeys.apiClients.all}
      fetch={() => apiClientApi.clients().then((result) => result.data)}
      rowKey={(client) => client.id}
      columns={[
        { key: 'name', label: 'Nom', render: (client) => client.name },
        { key: 'contactEmail', label: 'Contact', render: (client) => client.contactEmail ?? '—' },
        { key: 'dataPurpose', label: 'Finalité', render: (client) => client.dataPurpose ?? <Chip label="non déclarée" tone="warning" size="sm" /> },
        { key: 'status', label: 'Statut', render: (client) => <Chip label={client.status} tone={client.status === 'ACTIVE' ? 'success' : 'warning'} size="sm" /> },
        { key: 'createdAt', label: 'Créé le', render: (client) => formatDate(client.createdAt, locale) },
      ]}
      emptyTitle="Aucun client"
      emptyDescription="Aucun client API n'est enregistré."
      notice="Une finalité non approuvée bloque l'accès aux jeux de données sensibles."
    />
  );
}
