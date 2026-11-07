import { ResourcePage } from '@/components/pages';
import { farmApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Farm } from '@/services/types';
import { Chip } from '@/components/ui';

/** ORGANIZATION — exploitations rattachées à l'organisation. */
export default function OrganizationFarms() {
  return (
    <ResourcePage<Farm>
      title="Exploitations"
      subtitle="Exploitations rattachées à votre organisation."
      icon="🏡"
      queryKey={queryKeys.farms.list({ limit: 100 })}
      fetch={() => farmApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(farm) => farm.id}
      rowHref={(farm) => `/farmer/farms/${farm.id}`}
      columns={[
        { key: 'name', label: 'Nom', render: (farm) => farm.name },
        { key: 'countryCode', label: 'Pays', render: (farm) => `${farm.countryCode}${farm.province ? ` · ${farm.province}` : ''}` },
        { key: 'totalAreaHa', label: 'Surface', render: (farm) => (farm.totalAreaHa !== null ? `${farm.totalAreaHa} ha` : '—') },
        { key: 'isPublic', label: 'Publication', render: (farm) => <Chip label={farm.isPublic ? 'publique' : 'privée'} tone={farm.isPublic ? 'success' : 'neutral'} size="sm" /> },
      ]}
      emptyTitle="Aucune exploitation"
      emptyDescription="Aucune exploitation n'est rattachée à votre organisation."
    />
  );
}
