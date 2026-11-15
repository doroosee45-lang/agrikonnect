import { ResourcePage } from '@/components/pages';
import { organizationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { OrganizationDetail } from '@/services/types';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** ADMIN — coopératives enregistrées. */
export default function AdminCooperatives() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<OrganizationDetail>
      title={t('ui.cooperatives')}
      subtitle={t('ui.organisationsDeTypeCooperative')}
      icon="👥"
      queryKey={queryKeys.organizations.all}
      fetch={() => organizationApi.list({ type: 'COOPERATIVE', limit: 100 }).then((result) => result.data)}
      rowKey={(organization) => organization.id}
      rowHref={(organization) => `/organization/${organization.id}`}
      columns={[
        { key: 'name', label: t('ui.nom'), render: (organization) => organization.name },
        { key: 'countryCode', label: t('ui.pays'), render: (organization) => organization.countryCode },
        { key: 'type', label: t('ui.type'), render: (organization) => organization.type },
        { key: 'createdAt', label: t('ui.creeeLe'), render: (organization) => formatDate(organization.createdAt, locale) },
      ]}
      emptyTitle={t('ui.aucuneCooperative')}
      emptyDescription={t('ui.aucuneCooperativeNAEteRenvoyee')}
    />
  );
}
