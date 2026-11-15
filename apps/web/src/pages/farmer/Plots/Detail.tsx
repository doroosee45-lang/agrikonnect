import { Link, useParams } from 'react-router-dom';

import { DetailPage } from '@/components/pages';
import { plotApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { PlotDetail as PlotDetailResult } from '@/services/types';
import { Button, Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n, tr } from '@/i18n';

const MODULES = [
  { href: 'soil', get label() { return tr('ui.sol'); } },
  { href: 'recommendations', get label() { return tr('ui.compatibilite'); } },
  { href: 'rotation', get label() { return tr('ui.rotation'); } },
  { href: 'plan', get label() { return tr('ui.planAgricole'); } },
  { href: 'precision-report', get label() { return tr('ui.rapportDePrecision'); } },
  { href: 'zones', get label() { return tr('ui.zonesDeGestion'); } },
  { href: 'sensors', get label() { return tr('ui.capteurs'); } },
  { href: 'satellite', get label() { return tr('ui.satellite_d1ffe'); } },
];

/** FARMER — fiche parcelle et ses huit modules. */
export default function FarmerPlotDetail() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();

  return (
    <DetailPage<PlotDetailResult>
      title={(plot) => plot.name}
      subtitle={t('ui.ficheDeLaParcelleEtSes')}
      backHref="/farmer/plots"
      backLabel={t('ui.retourAuxParcelles_2c89f')}
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
          title: t('ui.identification'),
          fields: [
            { label: t('ui.nom'), value: plot.name },
            { label: t('ui.exploitation_3097d'), value: plot.farm?.name ?? '—' },
            { label: t('ui.surface'), value: plot.areaHa !== null ? `${plot.areaHa} ha` : '—' },
            { label: t('ui.geometrie'), value: <Chip label={plot.geometryType} tone="neutral" size="sm" /> },
            { label: t('ui.statut'), value: <Chip label={plot.status} tone={plot.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm" /> },
            { label: t('ui.source_6da13'), value: <Chip label={plot.source} tone={plot.source === 'declared' ? 'warning' : 'success'} size="sm" /> },
            { label: t('ui.miseAJour'), value: formatDate(plot.updatedAt, locale) },
          ],
        },
        {
          title: t('ui.cultureCourante'),
          notice: t('ui.uneCultureDeclareeResteMarqueeComme'),
          fields: [
            { label: t('ui.culture'), value: plot.currentCrop?.names?.[locale] ?? plot.currentCrop?.names?.fr ?? plot.currentCrop?.slug ?? '—' },
            { label: t('ui.dateDeSemis'), value: plot.plantingDate ? formatDate(plot.plantingDate, locale) : '—' },
          ],
        },
        {
          title: t('ui.historiqueCultural'),
          fields: [
            {
              label: t('ui.frise'),
              value:
                plot.histories.length === 0 ? (
                  t('ui.noHistoryRecorded')
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
