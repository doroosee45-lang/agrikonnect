import { ResourcePage } from '@/components/pages';
import { orderApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Order } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** ADMIN — commandes passées sur la plateforme. */
export default function AdminOrders() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Order>
      title="Commandes"
      subtitle="Toutes les commandes, avec leur état et leur paiement."
      icon="🧾"
      queryKey={queryKeys.orders.list({ limit: 100 })}
      fetch={() => orderApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(order) => order.id}
      rowHref={(order) => `/app/orders/${order.id}`}
      columns={[
        { key: 'number', label: 'Numéro', render: (order) => order.number },
        { key: 'status', label: 'Statut', render: (order) => <Chip label={order.status} tone={order.status === 'COMPLETED' ? 'success' : 'info'} size="sm" /> },
        { key: 'paymentStatus', label: 'Paiement', render: (order) => <Chip label={order.paymentStatus} tone={order.paymentStatus === 'PAID' ? 'success' : 'warning'} size="sm" /> },
        { key: 'totalAmount', label: 'Montant', render: (order) => (order.totalAmount !== null ? formatCurrency(order.totalAmount, order.currency, locale) : '—') },
        { key: 'createdAt', label: 'Passée le', render: (order) => formatDate(order.createdAt, locale) },
      ]}
      emptyTitle="Aucune commande"
      emptyDescription="Aucune commande n'a été renvoyée par l'API."
    />
  );
}
