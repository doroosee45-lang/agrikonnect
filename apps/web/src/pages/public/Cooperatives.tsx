import { ResourcePage } from '@/components/pages';
import { organizationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { OrganizationDetail } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** PUBLIC — coopératives dont le profil est publié. */
export default function PublicCooperatives() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<OrganizationDetail>
      title={t('ui.cooperatives')}
      subtitle={t('ui.cooperativesDontLeProfilEstPublie')}
      icon="👥"
      public
      queryKey={queryKeys.organizations.all}
      fetch={() => organizationApi.list({ type: 'COOPERATIVE', limit: 100 }).then((result) => result.data)}
      rowKey={(organization) => organization.id}
      rowHref={(organization) => `/public/cooperatives/${organization.id}`}
      columns={[
        { key: 'name', label: t('ui.nom'), render: (organization) => organization.name },
        { key: 'countryCode', label: t('ui.pays'), render: (organization) => <Chip label={organization.countryCode} tone="neutral" size="sm" /> },
        { key: 'createdAt', label: t('ui.enregistreeLe'), render: (organization) => formatDate(organization.createdAt, locale) },
      ]}
      emptyTitle={t('ui.aucuneCooperativePubliee')}
      emptyDescription={t('ui.aucuneCooperativeNAEncorePublie')}
      notice={t('ui.lesVolumesConsolidesNeSontPublies')}
    />
  );
}
