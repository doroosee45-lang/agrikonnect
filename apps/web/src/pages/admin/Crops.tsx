import { ResourcePage } from '@/components/pages';
import { referenceApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Crop } from '@/services/types';
import { Chip } from '@/components/ui';
import { useI18n } from '@/i18n';

/** ADMIN — référentiel des cultures. */
export default function AdminCrops() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<Crop>
      title={t('ui.cultures')}
      subtitle={t('ui.referentielDesCulturesUtiliseesParLa')}
      icon="🌱"
      queryKey={queryKeys.crops.list({})}
      fetch={() => referenceApi.crops().then((result) => result.data)}
      rowKey={(crop) => crop.id}
      columns={[
        { key: 'slug', label: t('ui.slug'), render: (crop) => crop.slug },
        { key: 'names', label: t('ui.nom'), render: (crop) => crop.names?.[locale] ?? crop.names?.fr ?? crop.slug },
        { key: 'category', label: t('ui.categorie'), render: (crop) => (crop.category ? <Chip label={crop.category} tone="neutral" size="sm" /> : '—') },
        { key: 'seasonMonths', label: t('ui.moisDeSaison'), render: (crop) => (crop.seasonMonths?.length ? crop.seasonMonths.join(', ') : '—') },
      ]}
      emptyTitle={t('ui.aucuneCulture')}
      emptyDescription={t('ui.leReferentielNARenvoyeAucune')}
    />
  );
}
