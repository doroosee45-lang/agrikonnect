import { ResourcePage } from '@/components/pages';
import { organizationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { OrganizationDetail } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** PUBLIC — coopératives dont le profil est publié. */
export default function PublicCooperatives() {
  const { locale } = useI18n();
  return (
    <ResourcePage<OrganizationDetail>
      title="Coopératives"
      subtitle="Coopératives dont le profil est publié sur la plateforme."
      icon="👥"
      public
      queryKey={queryKeys.organizations.all}
      fetch={() => organizationApi.list({ type: 'COOPERATIVE', limit: 100 }).then((result) => result.data)}
      rowKey={(organization) => organization.id}
      rowHref={(organization) => `/public/cooperatives/${organization.id}`}
      columns={[
        { key: 'name', label: 'Nom', render: (organization) => organization.name },
        { key: 'countryCode', label: 'Pays', render: (organization) => <Chip label={organization.countryCode} tone="neutral" size="sm" /> },
        { key: 'createdAt', label: 'Enregistrée le', render: (organization) => formatDate(organization.createdAt, locale) },
      ]}
      emptyTitle="Aucune coopérative publiée"
      emptyDescription="Aucune coopérative n'a encore publié son profil."
      notice="Les volumes consolidés ne sont publiés qu'avec le consentement explicite de chaque membre."
    />
  );
}
