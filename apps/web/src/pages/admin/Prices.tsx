import { ResourcePage } from '@/components/pages';
import { priceApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { MarketPrice } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** ADMIN — prix de marché et sources. */
export default function AdminPrices() {
  const { locale } = useI18n();
  return (
    <ResourcePage<MarketPrice>
      title="Prix de marché"
      subtitle="Prix observés et sources de données."
      icon="💰"
      queryKey={queryKeys.prices.list({ limit: 100 })}
      fetch={() => priceApi.list({ limit: 100 }).then((result) => result.data.items)}
      rowKey={(price) => price.id}
      columns={[
        { key: 'cropId', label: 'Culture', render: (price) => price.cropId },
        { key: 'market', label: 'Marché', render: (price) => price.market },
        { key: 'city', label: 'Ville', render: (price) => price.city ?? '—' },
        { key: 'countryCode', label: 'Pays', render: (price) => <Chip label={price.countryCode} tone="neutral" size="sm" /> },
        { key: 'price', label: 'Prix', render: (price) => `${price.price} ${price.currency}/${price.unit}` },
        { key: 'observedAt', label: 'Observé le', render: (price) => formatDate(price.observedAt, locale) },
        { key: 'source', label: 'Source', render: (price) => <Chip label={price.source} tone="neutral" size="sm" /> },
      ]}
      emptyTitle="Aucun prix"
      emptyDescription="Aucun prix de marché n'est actuellement disponible."
    />
  );
}
