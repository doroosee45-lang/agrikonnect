import { ResourcePage } from '@/components/pages';
import { organizationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { OrganizationDetail } from '@/services/types';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** ADMIN — coopératives enregistrées. */
export default function AdminCooperatives() {
  const { locale } = useI18n();
  return (
    <ResourcePage<OrganizationDetail>
      title="Coopératives"
      subtitle="Organisations de type coopérative."
      icon="👥"
      queryKey={queryKeys.organizations.all}
      fetch={() => organizationApi.list({ type: 'COOPERATIVE', limit: 100 }).then((result) => result.data)}
      rowKey={(organization) => organization.id}
      rowHref={(organization) => `/organization/${organization.id}`}
      columns={[
        { key: 'name', label: 'Nom', render: (organization) => organization.name },
        { key: 'countryCode', label: 'Pays', render: (organization) => organization.countryCode },
        { key: 'type', label: 'Type', render: (organization) => organization.type },
        { key: 'createdAt', label: 'Créée le', render: (organization) => formatDate(organization.createdAt, locale) },
      ]}
      emptyTitle="Aucune coopérative"
      emptyDescription="Aucune coopérative n'a été renvoyée par l'API."
    />
  );
}
