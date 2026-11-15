import { ResourcePage } from '@/components/pages';
import { productionApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Production } from '@/services/types';
import { ProvenanceTag } from '@/components/ui';
import { formatDate, formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';

/** ADMIN — récoltes déclarées et mesurées. */
export default function AdminProductions() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<Production>
      title={t('ui.recoltes')}
      subtitle={t('ui.volumesRecoltesAvecLeurProvenanceReelle')}
      icon="🌾"
      queryKey={queryKeys.productions.list({ limit: 100 })}
      fetch={() => productionApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(production) => production.id}
      columns={[
        { key: 'season', label: t('ui.saison'), render: (production) => `${production.season} · ${formatDate(production.harvestedAt, locale)}` },
        { key: 'quantity', label: t('ui.volume'), render: (production) => `${formatNumber(production.quantity, locale, 1)} ${production.unit}` },
        { key: 'quality', label: t('ui.qualite'), render: (production) => production.quality ?? '—' },
        { key: 'source', label: t('ui.provenance'), render: (production) => <ProvenanceTag kind={production.source === 'declared' ? 'DECLARED' : 'MEASURED'} source={production.source} /> },
      ]}
      emptyTitle={t('ui.aucuneRecolte')}
      emptyDescription={t('ui.aucuneRecolteNAEteRenvoyee')}
      notice={t('ui.uneRecolteDeclareeParLeProducteur')}
    />
  );
}
