import { ResourcePage } from '@/components/pages';
import { lotApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { StatusChip, type Row } from '@/components/pages';
import { useI18n } from '@/i18n';

/** ADMIN — lots de traçabilité. */
export default function AdminLots() {
  const { t } = useI18n();
  return (
    <ResourcePage<Row>
      title={t('ui.lots')}
      subtitle={t('ui.lotsGeneresEtLeursCodesDe')}
      icon="📦"
      queryKey={queryKeys.lots.list({ limit: 100 })}
      fetch={() => lotApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(lot) => String(lot.id ?? lot.code)}
      rowHref={(lot) => `/public-site/lot/${String(lot.code ?? lot.id)}`}
      columns={[
        { key: 'code', label: t('ui.code'), render: (lot) => String(lot.code ?? '—') },
        { key: 'status', label: t('ui.statut'), render: (lot) => <StatusChip value={lot.status} /> },
        { key: 'createdAt', label: t('ui.creeLe'), render: (lot) => String(lot.createdAt ?? '—') },
      ]}
      emptyTitle={t('ui.aucunLot')}
      emptyDescription={t('ui.aucunLotNAEteGenere')}
      notice={t('ui.unCodeDeLotEstImmuable')}
    />
  );
}
