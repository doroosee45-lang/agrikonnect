import { ResourcePage } from '@/components/pages';
import { orderApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Order } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** APP — commandes passées au nom de la coopérative. */
export default function AppCooperativeOrders() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<Order>
      title={t('ui.commandesDeLaCooperative')}
      subtitle={t('ui.commandesConsolideesIssuesDesOffresGroupees')}
      icon="🧾"
      queryKey={queryKeys.orders.list({ limit: 100 })}
      fetch={() => orderApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(order) => order.id}
      rowHref={(order) => `/app/orders/${order.id}`}
      columns={[
        { key: 'number', label: t('ui.numero'), render: (order) => order.number },
        { key: 'status', label: t('ui.statut'), render: (order) => <Chip label={order.status} tone={order.status === 'COMPLETED' ? 'success' : 'info'} size="sm" /> },
        { key: 'totalAmount', label: t('ui.montant'), render: (order) => (order.totalAmount !== null ? formatCurrency(order.totalAmount, order.currency, locale) : '—') },
        { key: 'createdAt', label: t('ui.passeeLe'), render: (order) => formatDate(order.createdAt, locale) },
      ]}
      emptyTitle={t('ui.aucuneCommande')}
      emptyDescription={t('ui.aucuneCommandeNAEtePassee')}
    />
  );
}
