import { ResourcePage } from '@/components/pages';
import { listingApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Listing } from '@/services/types';

import { listingColumns } from './common';
import { useI18n } from '@/i18n';

/** MARKET — annonces publiques (contacts masqués par défaut). */
export default function MarketPublic() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Listing>
      title="Annonces"
      subtitle="Annonces de vente publiées par les producteurs."
      icon="🛒"
      public
      queryKey={queryKeys.listings.list({ limit: 100 })}
      fetch={() => listingApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(listing) => listing.id}
      rowHref={(listing) => `/market/listings/${listing.id}`}
      notice="Les coordonnées du producteur ne sont pas affichées. Pour le contacter, passez par la messagerie interne après avoir créé un compte."
      columns={listingColumns(locale)}
      emptyTitle="Aucune annonce"
      emptyDescription="Aucune annonce n'est actuellement publiée."
    />
  );
}
