import { useParams } from 'react-router-dom';

import { DetailPage } from '@/components/pages';
import { organizationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { OrganizationDetail } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** PUBLIC — profil publié d'une coopérative. */
export default function PublicCooperativeProfile() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();

  return (
    <DetailPage<OrganizationDetail>
      public
      title={(organization) => organization.name}
      subtitle={t('ui.profilPublieDeLaCooperative')}
      backHref="/public/cooperatives"
      backLabel={t('ui.retourAuxCooperatives')}
      queryKey={queryKeys.organizations.one(id ?? '')}
      fetch={() => organizationApi.get(id ?? '').then((result) => result.data)}
      sections={(organization) => [
        {
          title: t('ui.identite'),
          fields: [
            { label: t('ui.nom'), value: organization.name },
            { label: t('ui.type'), value: <Chip label={organization.type} tone="neutral" size="sm" /> },
            { label: t('ui.pays'), value: organization.countryCode },
            { label: t('ui.identifiant'), value: <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{organization.id}</span> },
            { label: t('ui.enregistreeLe'), value: formatDate(organization.createdAt, locale) },
          ],
        },
        {
          title: t('ui.description'),
          fields: [{ label: t('ui.presentation'), value: organization.description ?? t('ui.aucuneDescriptionPubliee') }],
        },
      ]}
      notFoundTitle={t('ui.cooperativeIntrouvable')}
      notFoundDescription={t('ui.ceProfilNEstPasPublie')}
    />
  );
}
