import { ResourcePage } from '@/components/pages';
import { productionApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Production } from '@/services/types';
import { ProvenanceTag } from '@/components/ui';
import { formatDate, formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';

/** APP — mes récoltes. */
export default function AppProductions() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Production>
      title="Mes récoltes"
      subtitle="Volumes récoltés, avec leur provenance réelle."
      icon="🌾"
      queryKey={queryKeys.productions.list({ limit: 100 })}
      fetch={() => productionApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(production) => production.id}
      action={{ label: 'Déclarer une récolte', href: '/farmer/productions' }}
      columns={[
        { key: 'season', label: 'Saison', render: (production) => `${production.season} · ${formatDate(production.harvestedAt, locale)}` },
        { key: 'quantity', label: 'Volume', render: (production) => `${formatNumber(production.quantity, locale, 1)} ${production.unit}` },
        { key: 'quality', label: 'Qualité', render: (production) => production.quality ?? '—' },
        { key: 'source', label: 'Provenance', render: (production) => <ProvenanceTag kind={production.source === 'declared' ? 'DECLARED' : 'MEASURED'} source={production.source} /> },
      ]}
      emptyTitle="Aucune récolte"
      emptyDescription="Déclarez votre première récolte pour alimenter votre historique."
      notice="Une récolte déclarée reste marquée « déclarée » tant qu'aucun contrôle n'a eu lieu."
    />
  );
}
