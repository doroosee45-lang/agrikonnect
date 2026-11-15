import { ResourcePage } from '@/components/pages';
import { lotApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { Chip } from '@/components/ui';
import { useI18n } from '@/i18n';

type Lot = Record<string, unknown>;

/** FARMER — mes lots et codes QR de traçabilité (TRC-01 → TRC-06). */
export default function FarmerLots() {
  const { t } = useI18n();
  return (
    <ResourcePage<Lot>
      title={t('ui.mesLots')}
      subtitle={t('ui.lotsDeTracabiliteGeneresPourVos')}
      icon="🏷️"
      queryKey={queryKeys.lots.list({ limit: 100 })}
      fetch={() => lotApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(lot) => String(lot.code ?? lot.id)}
      rowHref={(lot) => `/farmer/lots/${String(lot.code ?? lot.id)}`}
      columns={[
        { key: 'code', label: t('ui.code'), render: (lot) => <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{String(lot.code ?? '—')}</span> },
        { key: 'status', label: t('ui.statut'), render: (lot) => <Chip label={String(lot.status ?? '—')} tone="neutral" size="sm" /> },
      ]}
      emptyTitle={t('ui.aucunLot')}
      emptyDescription={t('ui.lesLotsApparaissentIciDesQu')}
    />
  );
}
