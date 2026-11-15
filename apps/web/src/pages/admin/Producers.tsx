import { ResourcePage } from '@/components/pages';
import { adminApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';

import { DateCell, StatusChip, render, type Row } from '@/components/pages';
import { useI18n } from '@/i18n';

/** ADMIN — organisations de production. */
export default function AdminProducers() {
  const { t } = useI18n();
  return (
    <ResourcePage<Row>
      title={t('ui.organisationsDeProduction')}
      subtitle={t('ui.exploitationsCooperativesEtEntreprisesAgricolesE')}
      icon="🏭"
      queryKey={queryKeys.admin.users({ role: 'PRODUCER', limit: 100 })}
      fetch={() => adminApi.users({ role: 'PRODUCER', limit: 100 }).then((result) => result.data)}
      rowKey={(row) => String(row.id)}
      columns={[
        { key: 'email', label: t('ui.contact'), render: render('email') },
        { key: 'name', label: t('ui.nom'), render: (row) => `${String(row.firstName ?? '')} ${String(row.lastName ?? '')}`.trim() || '—' },
        { key: 'status', label: t('ui.statut'), render: (row) => <StatusChip value={row.status} /> },
        { key: 'createdAt', label: t('ui.creeLe'), render: (row) => <DateCell value={row.createdAt} /> },
      ]}
      emptyTitle={t('ui.aucuneOrganisation')}
      emptyDescription={t('ui.aucuneOrganisationDeProductionNA')}
    />
  );
}
