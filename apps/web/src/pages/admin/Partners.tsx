import { ResourcePage } from '@/components/pages';
import { adminApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';

import { DateCell, StatusChip, render, type Row } from '@/components/pages';

/** ADMIN — partenaires (ONG, bailleurs, institutions). */
export default function AdminPartners() {
  return (
    <ResourcePage<Row>
      title="Partenaires"
      subtitle="Comptes partenaires : ONG, bailleurs, institutions."
      icon="🤝"
      queryKey={queryKeys.admin.users({ role: 'PARTNER', limit: 100 })}
      fetch={() => adminApi.users({ role: 'PARTNER', limit: 100 }).then((result) => result.data)}
      rowKey={(row) => String(row.id)}
      columns={[
        { key: 'email', label: 'Contact', render: render('email') },
        { key: 'name', label: 'Nom', render: (row) => `${String(row.firstName ?? '')} ${String(row.lastName ?? '')}`.trim() || '—' },
        { key: 'status', label: 'Statut', render: (row) => <StatusChip value={row.status} /> },
        { key: 'createdAt', label: 'Créé le', render: (row) => <DateCell value={row.createdAt} /> },
      ]}
      emptyTitle="Aucun partenaire"
      emptyDescription="Aucun compte partenaire n'a été renvoyé."
    />
  );
}
