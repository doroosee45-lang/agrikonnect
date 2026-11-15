import { ResourcePage } from '@/components/pages';
import { tenderApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Tender } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** INTERNATIONAL — appels d'offres internationaux. */
export default function InternationalTenders() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<Tender>
      title={t('ui.appelsDOffres_907ea')}
      subtitle={t('ui.appelsDOffresInternationauxPubliesSur')}
      icon="🌍"
      public
      queryKey={queryKeys.tenders.list({ limit: 100 })}
      fetch={() => tenderApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(tender) => tender.id}
      columns={[
        { key: 'title', label: t('ui.titre'), render: (tender) => tender.title },
        { key: 'destinationCountry', label: t('ui.pays'), render: (tender) => <Chip label={tender.destinationCountry} tone="neutral" size="sm" /> },
        { key: 'quantity', label: t('ui.quantite'), render: (tender) => `${tender.quantity} ${tender.unit}` },
        { key: 'deadline', label: t('ui.cloture'), render: (tender) => (tender.deadline ? formatDate(tender.deadline, locale) : '—') },
        { key: 'status', label: t('ui.statut'), render: (tender) => <Chip label={tender.status} tone={tender.status === 'OPEN' ? 'success' : 'neutral'} size="sm" /> },
      ]}
      emptyTitle={t('ui.aucunAppelDOffres')}
      emptyDescription={t('ui.aucunAppelDOffresNEst')}
    />
  );
}
