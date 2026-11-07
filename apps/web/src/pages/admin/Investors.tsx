import { ResourcePage } from '@/components/pages';
import { adminApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';

import { DateCell, StatusChip, render, type Row } from '@/components/pages';

/** ADMIN — comptes investisseurs. */
export default function AdminInvestors() {
  return (
    <ResourcePage<Row>
      title="Investisseurs"
      subtitle="Comptes inscrits comme investisseurs ou bailleurs."
      icon="📈"
      queryKey={queryKeys.admin.users({ role: 'INVESTOR', limit: 100 })}
      fetch={() => adminApi.users({ role: 'INVESTOR', limit: 100 }).then((result) => result.data)}
      rowKey={(row) => String(row.id)}
      columns={[
        { key: 'email', label: 'Email', render: render('email') },
        { key: 'name', label: 'Nom', render: (row) => `${String(row.firstName ?? '')} ${String(row.lastName ?? '')}`.trim() || '—' },
        { key: 'status', label: 'Statut', render: (row) => <StatusChip value={row.status} /> },
        { key: 'createdAt', label: 'Créé le', render: (row) => <DateCell value={row.createdAt} /> },
      ]}
      emptyTitle="Aucun investisseur"
      emptyDescription="Aucun compte investisseur n'a été renvoyé."
    />
  );
}
