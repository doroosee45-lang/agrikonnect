import { ResourcePage } from '@/components/pages';
import { inventoryApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { InventoryItem } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate, formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';

/** APP — stock et mouvements. */
export default function AppInventory() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<InventoryItem>
      title={t('ui.stock')}
      subtitle={t('ui.articlesEnStockSeuilsDAlerte')}
      icon="📦"
      queryKey={queryKeys.inventory.all}
      fetch={() => inventoryApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(item) => item.id}
      columns={[
        { key: 'label', label: t('ui.article'), render: (item) => item.label },
        { key: 'stock', label: t('ui.stock'), render: (item) => (item.stock !== undefined ? `${formatNumber(item.stock, locale, 1)} ${item.unit}` : '—') },
        { key: 'lowStockThreshold', label: t('ui.seuil'), render: (item) => (item.lowStockThreshold !== null ? `${item.lowStockThreshold} ${item.unit}` : '—') },
        { key: 'expiresAt', label: t('ui.expireLe'), render: (item) => (item.expiresAt ? formatDate(item.expiresAt, locale) : '—') },
        {
          key: 'alert',
          label: t('ui.alerte_672e2'),
          render: (item) =>
            item.stock !== undefined && item.lowStockThreshold !== null && item.stock <= item.lowStockThreshold ? (
              <Chip label={t('ui.sousLeSeuil')} tone="warning" size="sm" />
            ) : null,
        },
      ]}
      emptyTitle={t('ui.aucunArticle')}
      emptyDescription={t('ui.aucunArticleNEstEnregistreDans')}
    />
  );
}
