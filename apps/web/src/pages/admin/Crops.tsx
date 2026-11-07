import { ResourcePage } from '@/components/pages';
import { referenceApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Crop } from '@/services/types';
import { Chip } from '@/components/ui';
import { useI18n } from '@/i18n';

/** ADMIN — référentiel des cultures. */
export default function AdminCrops() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Crop>
      title="Cultures"
      subtitle="Référentiel des cultures utilisées par la plateforme."
      icon="🌱"
      queryKey={queryKeys.crops.list({})}
      fetch={() => referenceApi.crops().then((result) => result.data)}
      rowKey={(crop) => crop.id}
      columns={[
        { key: 'slug', label: 'Slug', render: (crop) => crop.slug },
        { key: 'names', label: 'Nom', render: (crop) => crop.names?.[locale] ?? crop.names?.fr ?? crop.slug },
        { key: 'category', label: 'Catégorie', render: (crop) => (crop.category ? <Chip label={crop.category} tone="neutral" size="sm" /> : '—') },
        { key: 'seasonMonths', label: 'Mois de saison', render: (crop) => (crop.seasonMonths?.length ? crop.seasonMonths.join(', ') : '—') },
      ]}
      emptyTitle="Aucune culture"
      emptyDescription="Le référentiel n'a renvoyé aucune culture."
    />
  );
}
