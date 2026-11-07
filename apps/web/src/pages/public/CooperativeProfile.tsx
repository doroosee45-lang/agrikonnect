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
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();

  return (
    <DetailPage<OrganizationDetail>
      public
      title={(organization) => organization.name}
      subtitle="Profil publié de la coopérative."
      backHref="/public/cooperatives"
      backLabel="Retour aux coopératives"
      queryKey={queryKeys.organizations.one(id ?? '')}
      fetch={() => organizationApi.get(id ?? '').then((result) => result.data)}
      sections={(organization) => [
        {
          title: 'Identité',
          fields: [
            { label: 'Nom', value: organization.name },
            { label: 'Type', value: <Chip label={organization.type} tone="neutral" size="sm" /> },
            { label: 'Pays', value: organization.countryCode },
            { label: 'Identifiant', value: <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{organization.id}</span> },
            { label: 'Enregistrée le', value: formatDate(organization.createdAt, locale) },
          ],
        },
        {
          title: 'Description',
          fields: [{ label: 'Présentation', value: organization.description ?? 'Aucune description publiée.' }],
        },
      ]}
      notFoundTitle="Coopérative introuvable"
      notFoundDescription="Ce profil n'est pas publié ou n'existe pas."
    />
  );
}
