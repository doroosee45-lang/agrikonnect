import { ResourcePage } from '@/components/pages';
import { priceApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { MarketPrice } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** Prix de marché par culture et zone (PRC-01 → PRC-06). */
export default function Prices() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<MarketPrice>
      title={t('ui.prixDeMarche')}
      subtitle={t('ui.prixObservesParCultureMarcheEt')}
      icon="💰"
      public
      queryKey={queryKeys.prices.list({ limit: 100 })}
      fetch={() => priceApi.list({ limit: 100 }).then((result) => result.data.items)}
      rowKey={(price) => price.id}
      columns={[
        { key: 'cropId', label: t('ui.culture'), render: (price) => price.cropId },
        { key: 'market', label: t('ui.marche'), render: (price) => price.market },
        { key: 'city', label: t('ui.ville'), render: (price) => price.city ?? '—' },
        { key: 'countryCode', label: t('ui.pays'), render: (price) => <Chip label={price.countryCode} tone="neutral" size="sm" /> },
        { key: 'price', label: t('ui.prix'), render: (price) => `${price.price} ${price.currency}/${price.unit}` },
        { key: 'observedAt', label: t('ui.observeLe'), render: (price) => formatDate(price.observedAt, locale) },
        { key: 'source', label: t('ui.source_6da13'), render: (price) => price.sourceLabel ?? price.source },
      ]}
      emptyTitle={t('ui.aucunPrix')}
      emptyDescription={t('ui.aucunPrixDeMarcheNEst')}
    />
  );
}
