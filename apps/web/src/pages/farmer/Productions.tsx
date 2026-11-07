import { ResourcePage } from '@/components/pages';
import { productionApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Production } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** FARMER — productions déclarées ou mesurées, avec provenance. */
export default function FarmerProductions() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Production>
      title="Mes productions"
      subtitle="Récoltes enregistrées sur vos parcelles."
      icon="🌾"
      queryKey={queryKeys.productions.list({ limit: 100 })}
      fetch={() => productionApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(production) => production.id}
      columns={[
        { key: 'cropId', label: 'Culture', render: (production) => production.cropId },
        { key: 'season', label: 'Campagne', render: (production) => production.season },
        { key: 'quantity', label: 'Quantité', render: (production) => `${production.quantity} ${production.unit}` },
        { key: 'quantityKg', label: 'Kg', render: (production) => (production.quantityKg !== null ? `${production.quantityKg} kg` : '—') },
        { key: 'source', label: 'Source', render: (production) => <Chip label={production.source} tone={production.source === 'declared' ? 'warning' : 'success'} size="sm" /> },
        { key: 'harvestedAt', label: 'Récolte', render: (production) => formatDate(production.harvestedAt, locale) },
      ]}
      emptyTitle="Aucune production"
      emptyDescription="Enregistrez vos récoltes pour suivre vos rendements."
    />
  );
}
