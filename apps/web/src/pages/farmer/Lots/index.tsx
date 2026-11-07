import { ResourcePage } from '@/components/pages';
import { lotApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { Chip } from '@/components/ui';

type Lot = Record<string, unknown>;

/** FARMER — mes lots et codes QR de traçabilité (TRC-01 → TRC-06). */
export default function FarmerLots() {
  return (
    <ResourcePage<Lot>
      title="Mes lots"
      subtitle="Lots de traçabilité générés pour vos productions. Chaque code est vérifiable publiquement."
      icon="🏷️"
      queryKey={queryKeys.lots.list({ limit: 100 })}
      fetch={() => lotApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(lot) => String(lot.code ?? lot.id)}
      rowHref={(lot) => `/farmer/lots/${String(lot.code ?? lot.id)}`}
      columns={[
        { key: 'code', label: 'Code', render: (lot) => <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{String(lot.code ?? '—')}</span> },
        { key: 'status', label: 'Statut', render: (lot) => <Chip label={String(lot.status ?? '—')} tone="neutral" size="sm" /> },
      ]}
      emptyTitle="Aucun lot"
      emptyDescription="Les lots apparaissent ici dès qu'ils sont générés à partir de vos productions."
    />
  );
}
