import { ResourcePage } from '@/components/pages';
import { orderApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Order } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** INTERNATIONAL — commandes en flux d'exportation. */
export default function InternationalOrders() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Order>
      title="Commandes internationales"
      subtitle="Commandes en flux d'exportation et leur suivi."
      icon="🚢"
      queryKey={queryKeys.orders.list({ limit: 100 })}
      fetch={() => orderApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(order) => order.id}
      rowHref={(order) => `/app/orders/${order.id}`}
      columns={[
        { key: 'number', label: 'Référence', render: (order) => <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{order.number}</span> },
        { key: 'status', label: 'Statut', render: (order) => <Chip label={order.status} tone="neutral" size="sm" /> },
        { key: 'totalAmount', label: 'Montant', render: (order) => (order.totalAmount !== null ? `${order.totalAmount} ${order.currency}` : '—') },
        { key: 'createdAt', label: 'Créée le', render: (order) => formatDate(order.createdAt, locale) },
      ]}
      emptyTitle="Aucune commande"
      emptyDescription="Les commandes internationales apparaissent ici."
    />
  );
}
