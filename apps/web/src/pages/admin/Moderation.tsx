import { ResourcePage } from '@/components/pages';
import { orderApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Dispute } from '@/services/types';
import { StatusChip } from '@/components/pages';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** ADMIN — litiges à instruire. */
export default function AdminModeration() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Dispute>
      title="Modération et litiges"
      subtitle="Litiges ouverts sur les commandes."
      icon="⚖️"
      queryKey={[...queryKeys.orders.all, 'disputes']}
      fetch={() => orderApi.adminDisputes().then((result) => result.data)}
      rowKey={(dispute) => dispute.id}
      columns={[
        { key: 'orderId', label: 'Commande', render: (dispute) => dispute.orderId },
        { key: 'reason', label: 'Motif', render: (dispute) => dispute.reason },
        { key: 'status', label: 'Statut', render: (dispute) => <StatusChip value={dispute.status} /> },
        { key: 'createdAt', label: 'Ouvert le', render: (dispute) => formatDate(dispute.createdAt, locale) },
      ]}
      emptyTitle="Aucun litige"
      emptyDescription="Aucun litige n'est ouvert."
    />
  );
}
