import { ResourcePage } from '@/components/pages';
import { farmApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Farm } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** FARMER — mes exploitations. */
export default function FarmerFarms() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Farm>
      title="Mes exploitations"
      subtitle="Exploitations rattachées à votre organisation."
      icon="🏡"
      queryKey={queryKeys.farms.list({ limit: 100 })}
      fetch={() => farmApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(farm) => farm.id}
      rowHref={(farm) => `/farmer/farms/${farm.id}`}
      action={{ label: 'Nouvelle exploitation', href: '/farmer/farms/create' }}
      columns={[
        { key: 'name', label: 'Nom', render: (farm) => farm.name },
        { key: 'countryCode', label: 'Pays', render: (farm) => `${farm.countryCode}${farm.province ? ` · ${farm.province}` : ''}` },
        { key: 'totalAreaHa', label: 'Surface', render: (farm) => (farm.totalAreaHa !== null ? `${farm.totalAreaHa} ha` : '—') },
        { key: 'isPublic', label: 'Publication', render: (farm) => <Chip label={farm.isPublic ? 'publique' : 'privée'} tone={farm.isPublic ? 'success' : 'neutral'} size="sm" /> },
        { key: 'updatedAt', label: 'Mise à jour', render: (farm) => formatDate(farm.updatedAt, locale) },
      ]}
      emptyTitle="Aucune exploitation"
      emptyDescription="Créez votre première exploitation pour commencer."
    />
  );
}
