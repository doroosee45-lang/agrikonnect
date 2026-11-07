import { Link, useParams } from 'react-router-dom';

import { DetailPage } from '@/components/pages';
import { plotApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { PlotDetail as PlotDetailResult } from '@/services/types';
import { Button, Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

const MODULES = [
  { href: 'soil', label: 'Sol' },
  { href: 'recommendations', label: 'Compatibilité' },
  { href: 'rotation', label: 'Rotation' },
  { href: 'plan', label: 'Plan agricole' },
  { href: 'precision-report', label: 'Rapport de précision' },
  { href: 'zones', label: 'Zones de gestion' },
  { href: 'sensors', label: 'Capteurs' },
  { href: 'satellite', label: 'Satellite' },
];

/** FARMER — fiche parcelle et ses huit modules. */
export default function FarmerPlotDetail() {
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();

  return (
    <DetailPage<PlotDetailResult>
      title={(plot) => plot.name}
      subtitle="Fiche de la parcelle et ses modules d'analyse."
      backHref="/farmer/plots"
      backLabel="Retour aux parcelles"
      queryKey={queryKeys.plots.one(id ?? '')}
      fetch={() => plotApi.get(id ?? '').then((result) => result.data)}
      actions={() => (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {MODULES.map((module) => (
            <Link key={module.href} to={`/farmer/plots/${id}/${module.href}`}>
              <Button label={module.label} variant="outline" size="sm" />
            </Link>
          ))}
        </div>
      )}
      sections={(plot) => [
        {
          title: 'Identification',
          fields: [
            { label: 'Nom', value: plot.name },
            { label: 'Exploitation', value: plot.farm?.name ?? '—' },
            { label: 'Surface', value: plot.areaHa !== null ? `${plot.areaHa} ha` : '—' },
            { label: 'Géométrie', value: <Chip label={plot.geometryType} tone="neutral" size="sm" /> },
            { label: 'Statut', value: <Chip label={plot.status} tone={plot.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm" /> },
            { label: 'Source', value: <Chip label={plot.source} tone={plot.source === 'declared' ? 'warning' : 'success'} size="sm" /> },
            { label: 'Mise à jour', value: formatDate(plot.updatedAt, locale) },
          ],
        },
        {
          title: 'Culture courante',
          notice: 'Une culture déclarée reste marquée comme telle tant qu’aucun contrôle n’a eu lieu.',
          fields: [
            { label: 'Culture', value: plot.currentCrop?.names?.[locale] ?? plot.currentCrop?.names?.fr ?? plot.currentCrop?.slug ?? '—' },
            { label: 'Date de semis', value: plot.plantingDate ? formatDate(plot.plantingDate, locale) : '—' },
          ],
        },
        {
          title: 'Historique cultural',
          fields: [
            {
              label: 'Frise',
              value:
                plot.histories.length === 0 ? (
                  'Aucun historique enregistré.'
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {plot.histories.map((history) => (
                      <span key={history.id} style={{ fontSize: 13 }}>
                        {history.cropId} · {history.season}
                      </span>
                    ))}
                  </div>
                ),
            },
          ],
        },
      ]}
    />
  );
}
