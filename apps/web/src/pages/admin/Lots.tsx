import { ResourcePage } from '@/components/pages';
import { lotApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { StatusChip, type Row } from '@/components/pages';

/** ADMIN — lots de traçabilité. */
export default function AdminLots() {
  return (
    <ResourcePage<Row>
      title="Lots"
      subtitle="Lots générés et leurs codes de traçabilité."
      icon="📦"
      queryKey={queryKeys.lots.list({ limit: 100 })}
      fetch={() => lotApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(lot) => String(lot.id ?? lot.code)}
      rowHref={(lot) => `/public-site/lot/${String(lot.code ?? lot.id)}`}
      columns={[
        { key: 'code', label: 'Code', render: (lot) => String(lot.code ?? '—') },
        { key: 'status', label: 'Statut', render: (lot) => <StatusChip value={lot.status} /> },
        { key: 'createdAt', label: 'Créé le', render: (lot) => String(lot.createdAt ?? '—') },
      ]}
      emptyTitle="Aucun lot"
      emptyDescription="Aucun lot n'a été généré pour le moment."
      notice="Un code de lot est immuable : les événements s'y ajoutent, ils ne le modifient jamais."
    />
  );
}
