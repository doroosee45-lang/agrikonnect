import { ResourcePage } from '@/components/pages';
import { productionApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Production } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** FARMER — productions déclarées ou mesurées, avec provenance. */
export default function FarmerProductions() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<Production>
      title={t('ui.mesProductions')}
      subtitle={t('ui.recoltesEnregistreesSurVosParcelles')}
      icon="🌾"
      queryKey={queryKeys.productions.list({ limit: 100 })}
      fetch={() => productionApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(production) => production.id}
      columns={[
        { key: 'cropId', label: t('ui.culture'), render: (production) => production.cropId },
        { key: 'season', label: t('ui.campagne'), render: (production) => production.season },
        { key: 'quantity', label: t('ui.quantite'), render: (production) => `${production.quantity} ${production.unit}` },
        { key: 'quantityKg', label: t('ui.kg'), render: (production) => (production.quantityKg !== null ? `${production.quantityKg} kg` : '—') },
        { key: 'source', label: t('ui.source_6da13'), render: (production) => <Chip label={production.source} tone={production.source === 'declared' ? 'warning' : 'success'} size="sm" /> },
        { key: 'harvestedAt', label: t('ui.recolte'), render: (production) => formatDate(production.harvestedAt, locale) },
      ]}
      emptyTitle={t('ui.aucuneProduction')}
      emptyDescription={t('ui.enregistrezVosRecoltesPourSuivreVos')}
    />
  );
}
