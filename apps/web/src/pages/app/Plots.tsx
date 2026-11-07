import { ResourcePage } from '@/components/pages';
import { plotApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Plot } from '@/services/types';
import { Chip } from '@/components/ui';

/** APP — mes parcelles. */
export default function AppPlots() {
  return (
    <ResourcePage<Plot>
      title="Mes parcelles"
      subtitle="Parcelles rattachées à vos exploitations."
      icon="🗺️"
      queryKey={queryKeys.plots.list({ limit: 100 })}
      fetch={() => plotApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(plot) => plot.id}
      rowHref={(plot) => `/app/plots/${plot.id}`}
      action={{ label: 'Nouvelle parcelle', href: '/farmer/plots/create' }}
      columns={[
        { key: 'name', label: 'Nom', render: (plot) => plot.name },
        { key: 'areaHa', label: 'Surface', render: (plot) => (plot.areaHa !== null ? `${plot.areaHa} ha` : '—') },
        { key: 'geometryType', label: 'Géométrie', render: (plot) => <Chip label={plot.geometryType} tone="neutral" size="sm" /> },
        { key: 'status', label: 'Statut', render: (plot) => <Chip label={plot.status} tone={plot.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm" /> },
        { key: 'source', label: 'Source', render: (plot) => <Chip label={plot.source} tone={plot.source === 'declared' ? 'warning' : 'success'} size="sm" /> },
      ]}
      emptyTitle="Aucune parcelle"
      emptyDescription="Créez votre première parcelle pour suivre vos cultures."
    />
  );
}
