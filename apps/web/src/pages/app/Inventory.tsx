import { ResourcePage } from '@/components/pages';
import { inventoryApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { InventoryItem } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate, formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';

/** APP — stock et mouvements. */
export default function AppInventory() {
  const { locale } = useI18n();
  return (
    <ResourcePage<InventoryItem>
      title="Stock"
      subtitle="Articles en stock, seuils d'alerte et échéances."
      icon="📦"
      queryKey={queryKeys.inventory.all}
      fetch={() => inventoryApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(item) => item.id}
      columns={[
        { key: 'label', label: 'Article', render: (item) => item.label },
        { key: 'stock', label: 'Stock', render: (item) => (item.stock !== undefined ? `${formatNumber(item.stock, locale, 1)} ${item.unit}` : '—') },
        { key: 'lowStockThreshold', label: 'Seuil', render: (item) => (item.lowStockThreshold !== null ? `${item.lowStockThreshold} ${item.unit}` : '—') },
        { key: 'expiresAt', label: 'Expire le', render: (item) => (item.expiresAt ? formatDate(item.expiresAt, locale) : '—') },
        {
          key: 'alert',
          label: 'Alerte',
          render: (item) =>
            item.stock !== undefined && item.lowStockThreshold !== null && item.stock <= item.lowStockThreshold ? (
              <Chip label="sous le seuil" tone="warning" size="sm" />
            ) : null,
        },
      ]}
      emptyTitle="Aucun article"
      emptyDescription="Aucun article n'est enregistré dans votre stock."
    />
  );
}
