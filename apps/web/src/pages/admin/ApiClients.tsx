import { ResourcePage } from '@/components/pages';
import { apiClientApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { ApiClient } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** ADMIN — clients API enregistrés. */
export default function AdminApiClients() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<ApiClient>
      title={t('ui.clientsApi')}
      subtitle={t('ui.integrationsTiercesAvecFinaliteDeclareeEt')}
      icon="🔑"
      queryKey={queryKeys.apiClients.all}
      fetch={() => apiClientApi.clients().then((result) => result.data)}
      rowKey={(client) => client.id}
      columns={[
        { key: 'name', label: t('ui.nom'), render: (client) => client.name },
        { key: 'contactEmail', label: t('ui.contact'), render: (client) => client.contactEmail ?? '—' },
        { key: 'dataPurpose', label: t('ui.finalite'), render: (client) => client.dataPurpose ?? <Chip label={t('ui.nonDeclaree')} tone="warning" size="sm" /> },
        { key: 'status', label: t('ui.statut'), render: (client) => <Chip label={client.status} tone={client.status === 'ACTIVE' ? 'success' : 'warning'} size="sm" /> },
        { key: 'createdAt', label: t('ui.creeLe'), render: (client) => formatDate(client.createdAt, locale) },
      ]}
      emptyTitle={t('ui.aucunClient')}
      emptyDescription={t('ui.aucunClientApiNEstEnregistre')}
      notice={t('ui.uneFinaliteNonApprouveeBloqueL')}
    />
  );
}
