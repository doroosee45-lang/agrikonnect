import { ResourcePage } from '@/components/pages';
import { plotApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Plot } from '@/services/types';
import { Chip } from '@/components/ui';
import { useI18n } from '@/i18n';

/** FARMER — mes parcelles. */
export default function FarmerPlots() {
  const { t } = useI18n();
  return (
    <ResourcePage<Plot>
      title={t('ui.mesParcelles')}
      subtitle={t('ui.parcellesRattacheesAVosExploitations')}
      icon="🗺️"
      queryKey={queryKeys.plots.list({ limit: 100 })}
      fetch={() => plotApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(plot) => plot.id}
      rowHref={(plot) => `/farmer/plots/${plot.id}`}
      action={{ label: t('ui.nouvelleParcelle'), href: '/farmer/plots/create' }}
      columns={[
        { key: 'name', label: t('ui.nom'), render: (plot) => plot.name },
        { key: 'areaHa', label: t('ui.surface'), render: (plot) => (plot.areaHa !== null ? `${plot.areaHa} ha` : '—') },
        { key: 'geometryType', label: t('ui.geometrie'), render: (plot) => <Chip label={plot.geometryType} tone="neutral" size="sm" /> },
        { key: 'status', label: t('ui.statut'), render: (plot) => <Chip label={plot.status} tone={plot.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm" /> },
        { key: 'source', label: t('ui.source_6da13'), render: (plot) => <Chip label={plot.source} tone={plot.source === 'declared' ? 'warning' : 'success'} size="sm" /> },
      ]}
      emptyTitle={t('ui.aucuneParcelle')}
      emptyDescription={t('ui.creezVotrePremiereParcellePourSuivre')}
    />
  );
}
