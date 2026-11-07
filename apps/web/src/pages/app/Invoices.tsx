import { ResourcePage } from '@/components/pages';
import { orderApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Order } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** APP — factures : commandes avec leur état de paiement. */
export default function AppInvoices() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Order>
      title="Factures"
      subtitle="Commandes et leur état de paiement."
      icon="🧾"
      queryKey={queryKeys.orders.list({ limit: 100 })}
      fetch={() => orderApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(order) => order.id}
      rowHref={(order) => `/app/orders/${order.id}`}
      columns={[
        { key: 'number', label: 'Numéro', render: (order) => order.number },
        { key: 'paymentStatus', label: 'Paiement', render: (order) => <Chip label={order.paymentStatus} tone={order.paymentStatus === 'PAID' ? 'success' : 'warning'} size="sm" /> },
        { key: 'totalAmount', label: 'Montant', render: (order) => (order.totalAmount !== null ? formatCurrency(order.totalAmount, order.currency, locale) : '—') },
        { key: 'createdAt', label: 'Émise le', render: (order) => formatDate(order.createdAt, locale) },
      ]}
      emptyTitle="Aucune facture"
      emptyDescription="Aucune commande n'a encore généré de facture."
      notice="Le montant d'une facture correspond à l'instantané figé à la validation de la commande."
    />
  );
}
