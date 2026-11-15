import { ResourcePage } from '@/components/pages';
import { listingApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Listing } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';

/** ADMIN — annonces publiées sur le marché. */
export default function AdminMarketplace() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<Listing>
      title={t('ui.annonces')}
      subtitle={t('ui.toutesLesAnnoncesDuMarcheTous')}
      icon="🛒"
      queryKey={queryKeys.listings.list({ limit: 100 })}
      fetch={() => listingApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(listing) => listing.id}
      rowHref={(listing) => `/market/listings/${listing.id}`}
      columns={[
        { key: 'title', label: t('ui.titre'), render: (listing) => listing.title },
        { key: 'quantity', label: t('ui.volume'), render: (listing) => `${formatNumber(listing.quantity, locale, 1)} ${listing.unit}` },
        { key: 'countryCode', label: t('ui.pays'), render: (listing) => listing.countryCode },
        { key: 'status', label: t('ui.statut'), render: (listing) => <Chip label={listing.status} tone={listing.status === 'PUBLISHED' ? 'success' : listing.status === 'EXPIRED' ? 'warning' : 'neutral'} size="sm" /> },
      ]}
      emptyTitle={t('ui.aucuneAnnonce')}
      emptyDescription={t('ui.aucuneAnnonceNAEteRenvoyee')}
    />
  );
}
