import { ResourcePage } from '@/components/pages';
import { requestApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { PurchaseRequest } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** MARKET — demandes d'achat publiées. */
export default function MarketRequests() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<PurchaseRequest>
      title={t('ui.demandesDAchat')}
      subtitle={t('ui.demandesDAchatPublieesParLes')}
      icon="📋"
      queryKey={queryKeys.requests.list({ limit: 100 })}
      fetch={() => requestApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(request) => request.id}
      rowHref={(request) => `/market/requests/${request.id}`}
      action={{ label: t('ui.nouvelleDemande'), href: '/market/requests/new' }}
      columns={[
        { key: 'cropId', label: t('ui.culture'), render: (request) => request.cropId },
        { key: 'quantity', label: t('ui.quantite'), render: (request) => `${request.quantity} ${request.unit}` },
        { key: 'status', label: t('ui.statut'), render: (request) => <Chip label={request.status} tone={request.status === 'OPEN' ? 'success' : 'neutral'} size="sm" /> },
        { key: 'createdAt', label: t('ui.publieeLe'), render: (request) => formatDate(request.createdAt, locale) },
      ]}
      emptyTitle={t('ui.aucuneDemande')}
      emptyDescription={t('ui.aucuneDemandeDAchatNEst')}
    />
  );
}
