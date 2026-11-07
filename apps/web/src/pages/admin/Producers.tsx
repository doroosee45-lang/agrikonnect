import { ResourcePage } from '@/components/pages';
import { adminApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';

import { DateCell, StatusChip, render, type Row } from '@/components/pages';

/** ADMIN — organisations de production. */
export default function AdminProducers() {
  return (
    <ResourcePage<Row>
      title="Organisations de production"
      subtitle="Exploitations, coopératives et entreprises agricoles enregistrées."
      icon="🏭"
      queryKey={queryKeys.admin.users({ role: 'PRODUCER', limit: 100 })}
      fetch={() => adminApi.users({ role: 'PRODUCER', limit: 100 }).then((result) => result.data)}
      rowKey={(row) => String(row.id)}
      columns={[
        { key: 'email', label: 'Contact', render: render('email') },
        { key: 'name', label: 'Nom', render: (row) => `${String(row.firstName ?? '')} ${String(row.lastName ?? '')}`.trim() || '—' },
        { key: 'status', label: 'Statut', render: (row) => <StatusChip value={row.status} /> },
        { key: 'createdAt', label: 'Créé le', render: (row) => <DateCell value={row.createdAt} /> },
      ]}
      emptyTitle="Aucune organisation"
      emptyDescription="Aucune organisation de production n'a été renvoyée."
    />
  );
}
