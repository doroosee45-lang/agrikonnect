import { ResourcePage } from '@/components/pages';
import { adminApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';

import { DateCell, StatusChip, render, type Row } from '@/components/pages';

/** ADMIN — comptes producteurs. */
export default function AdminFarmers() {
  return (
    <ResourcePage<Row>
      title="Producteurs"
      subtitle="Comptes dont le rôle inclut la production agricole."
      icon="🧑‍🌾"
      queryKey={queryKeys.admin.users({ role: 'FARMER', limit: 100 })}
      fetch={() => adminApi.users({ role: 'FARMER', limit: 100 }).then((result) => result.data)}
      rowKey={(row) => String(row.id)}
      columns={[
        { key: 'email', label: 'Email', render: render('email') },
        { key: 'name', label: 'Nom', render: (row) => `${String(row.firstName ?? '')} ${String(row.lastName ?? '')}`.trim() || '—' },
        { key: 'countryCode', label: 'Pays', render: render('countryCode') },
        { key: 'status', label: 'Statut', render: (row) => <StatusChip value={row.status} /> },
        { key: 'createdAt', label: 'Créé le', render: (row) => <DateCell value={row.createdAt} /> },
      ]}
      emptyTitle="Aucun producteur"
      emptyDescription="Aucun compte producteur n'a été renvoyé par l'API."
    />
  );
}
