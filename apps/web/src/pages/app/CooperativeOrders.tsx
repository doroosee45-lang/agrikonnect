import { ResourcePage } from '@/components/pages';
import { orderApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Order } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** APP — commandes passées au nom de la coopérative. */
export default function AppCooperativeOrders() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Order>
      title="Commandes de la coopérative"
      subtitle="Commandes consolidées issues des offres groupées."
      icon="🧾"
      queryKey={queryKeys.orders.list({ limit: 100 })}
      fetch={() => orderApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(order) => order.id}
      rowHref={(order) => `/app/orders/${order.id}`}
      columns={[
        { key: 'number', label: 'Numéro', render: (order) => order.number },
        { key: 'status', label: 'Statut', render: (order) => <Chip label={order.status} tone={order.status === 'COMPLETED' ? 'success' : 'info'} size="sm" /> },
        { key: 'totalAmount', label: 'Montant', render: (order) => (order.totalAmount !== null ? formatCurrency(order.totalAmount, order.currency, locale) : '—') },
        { key: 'createdAt', label: 'Passée le', render: (order) => formatDate(order.createdAt, locale) },
      ]}
      emptyTitle="Aucune commande"
      emptyDescription="Aucune commande n'a été passée au nom de la coopérative."
    />
  );
}
