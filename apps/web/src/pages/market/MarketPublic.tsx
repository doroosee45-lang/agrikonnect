import { ResourcePage } from '@/components/pages';
import { listingApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Listing } from '@/services/types';

import { listingColumns } from './common';
import { useI18n } from '@/i18n';

/** MARKET — annonces publiques (contacts masqués par défaut). */
export default function MarketPublic() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<Listing>
      title={t('ui.annonces')}
      subtitle={t('ui.annoncesDeVentePublieesParLes')}
      icon="🛒"
      public
      queryKey={queryKeys.listings.list({ limit: 100 })}
      fetch={() => listingApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(listing) => listing.id}
      rowHref={(listing) => `/market/listings/${listing.id}`}
      notice={t('ui.lesCoordonneesDuProducteurNeSont')}
      columns={listingColumns(locale)}
      emptyTitle={t('ui.aucuneAnnonce')}
      emptyDescription={t('ui.aucuneAnnonceNEstActuellementPubliee')}
    />
  );
}
