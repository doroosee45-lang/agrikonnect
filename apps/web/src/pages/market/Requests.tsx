import { ResourcePage } from '@/components/pages';
import { requestApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { PurchaseRequest } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** MARKET — demandes d'achat publiées. */
export default function MarketRequests() {
  const { locale } = useI18n();
  return (
    <ResourcePage<PurchaseRequest>
      title="Demandes d'achat"
      subtitle="Demandes d'achat publiées par les acheteurs."
      icon="📋"
      queryKey={queryKeys.requests.list({ limit: 100 })}
      fetch={() => requestApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(request) => request.id}
      rowHref={(request) => `/market/requests/${request.id}`}
      action={{ label: 'Nouvelle demande', href: '/market/requests/new' }}
      columns={[
        { key: 'cropId', label: 'Culture', render: (request) => request.cropId },
        { key: 'quantity', label: 'Quantité', render: (request) => `${request.quantity} ${request.unit}` },
        { key: 'status', label: 'Statut', render: (request) => <Chip label={request.status} tone={request.status === 'OPEN' ? 'success' : 'neutral'} size="sm" /> },
        { key: 'createdAt', label: 'Publiée le', render: (request) => formatDate(request.createdAt, locale) },
      ]}
      emptyTitle="Aucune demande"
      emptyDescription="Aucune demande d'achat n'est actuellement publiée."
    />
  );
}
