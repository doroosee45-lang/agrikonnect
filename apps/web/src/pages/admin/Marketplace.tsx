import { ResourcePage } from '@/components/pages';
import { listingApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Listing } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';

/** ADMIN — annonces publiées sur le marché. */
export default function AdminMarketplace() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Listing>
      title="Annonces"
      subtitle="Toutes les annonces du marché, tous statuts confondus."
      icon="🛒"
      queryKey={queryKeys.listings.list({ limit: 100 })}
      fetch={() => listingApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(listing) => listing.id}
      rowHref={(listing) => `/market/listings/${listing.id}`}
      columns={[
        { key: 'title', label: 'Titre', render: (listing) => listing.title },
        { key: 'quantity', label: 'Volume', render: (listing) => `${formatNumber(listing.quantity, locale, 1)} ${listing.unit}` },
        { key: 'countryCode', label: 'Pays', render: (listing) => listing.countryCode },
        { key: 'status', label: 'Statut', render: (listing) => <Chip label={listing.status} tone={listing.status === 'PUBLISHED' ? 'success' : listing.status === 'EXPIRED' ? 'warning' : 'neutral'} size="sm" /> },
      ]}
      emptyTitle="Aucune annonce"
      emptyDescription="Aucune annonce n'a été renvoyée par l'API."
    />
  );
}
