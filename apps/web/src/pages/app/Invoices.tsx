import { ResourcePage } from '@/components/pages';
import { orderApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Order } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** APP — factures : commandes avec leur état de paiement. */
export default function AppInvoices() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<Order>
      title={t('ui.factures')}
      subtitle={t('ui.commandesEtLeurEtatDePaiement')}
      icon="🧾"
      queryKey={queryKeys.orders.list({ limit: 100 })}
      fetch={() => orderApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(order) => order.id}
      rowHref={(order) => `/app/orders/${order.id}`}
      columns={[
        { key: 'number', label: t('ui.numero'), render: (order) => order.number },
        { key: 'paymentStatus', label: t('ui.paiement'), render: (order) => <Chip label={order.paymentStatus} tone={order.paymentStatus === 'PAID' ? 'success' : 'warning'} size="sm" /> },
        { key: 'totalAmount', label: t('ui.montant'), render: (order) => (order.totalAmount !== null ? formatCurrency(order.totalAmount, order.currency, locale) : '—') },
        { key: 'createdAt', label: t('ui.emiseLe'), render: (order) => formatDate(order.createdAt, locale) },
      ]}
      emptyTitle={t('ui.aucuneFacture')}
      emptyDescription={t('ui.aucuneCommandeNAEncoreGenere')}
      notice={t('ui.leMontantDUneFactureCorrespond')}
    />
  );
}
