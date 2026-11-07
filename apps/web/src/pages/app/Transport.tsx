import { ResourcePage } from '@/components/pages';
import { transportApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { TransportRequest } from '@/services/types';
import { StatusChip } from '@/components/pages';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** APP — demandes de transport. */
export default function AppTransport() {
  const { locale } = useI18n();
  return (
    <ResourcePage<TransportRequest>
      title="Transport"
      subtitle="Demandes de transport, offres et preuves de livraison."
      icon="🚚"
      queryKey={queryKeys.transport.list({ limit: 100 })}
      fetch={() => transportApi.requests({ limit: 100 }).then((result) => result.data)}
      rowKey={(request) => request.id}
      columns={[
        { key: 'orderId', label: 'Commande', render: (request) => request.orderId },
        { key: 'status', label: 'Statut', render: (request) => <StatusChip value={request.status} /> },
        { key: 'transporterOrgId', label: 'Transporteur', render: (request) => request.transporterOrgId ?? 'non attribué' },
        { key: 'createdAt', label: 'Créée le', render: (request) => formatDate(request.createdAt, locale) },
      ]}
      emptyTitle="Aucune demande"
      emptyDescription="Aucune demande de transport n'est enregistrée."
    />
  );
}
