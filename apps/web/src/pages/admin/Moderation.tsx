import { ResourcePage } from '@/components/pages';
import { orderApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Dispute } from '@/services/types';
import { StatusChip } from '@/components/pages';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** ADMIN — litiges à instruire. */
export default function AdminModeration() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<Dispute>
      title={t('ui.moderationEtLitiges')}
      subtitle={t('ui.litigesOuvertsSurLesCommandes')}
      icon="⚖️"
      queryKey={[...queryKeys.orders.all, 'disputes']}
      fetch={() => orderApi.adminDisputes().then((result) => result.data)}
      rowKey={(dispute) => dispute.id}
      columns={[
        { key: 'orderId', label: t('ui.commande'), render: (dispute) => dispute.orderId },
        { key: 'reason', label: t('ui.motif'), render: (dispute) => dispute.reason },
        { key: 'status', label: t('ui.statut'), render: (dispute) => <StatusChip value={dispute.status} /> },
        { key: 'createdAt', label: t('ui.ouvertLe'), render: (dispute) => formatDate(dispute.createdAt, locale) },
      ]}
      emptyTitle={t('ui.aucunLitige')}
      emptyDescription={t('ui.aucunLitigeNEstOuvert')}
    />
  );
}
