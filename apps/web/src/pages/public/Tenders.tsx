import { ResourcePage } from '@/components/pages';
import { tenderApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Tender } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate, formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';

/** PUBLIC — appels d'offres publiés. */
export default function PublicTenders() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<Tender>
      title={t('ui.appelsDOffres_907ea')}
      subtitle={t('ui.appelsDOffresPubliesParDes')}
      icon="📄"
      public
      queryKey={queryKeys.tenders.list({ limit: 100 })}
      fetch={() => tenderApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(tender) => tender.id}
      columns={[
        { key: 'title', label: t('ui.titre'), render: (tender) => tender.title },
        { key: 'quantity', label: t('ui.volume'), render: (tender) => `${formatNumber(tender.quantity, locale, 0)} ${tender.unit}` },
        { key: 'destinationCountry', label: t('ui.destination'), render: (tender) => <Chip label={tender.destinationCountry} tone="neutral" size="sm" /> },
        { key: 'deadline', label: t('ui.echeance'), render: (tender) => (tender.deadline ? formatDate(tender.deadline, locale) : '—') },
        { key: 'status', label: t('ui.statut'), render: (tender) => <Chip label={tender.status} tone={tender.status === 'OPEN' || tender.status === 'PUBLISHED' ? 'success' : 'neutral'} size="sm" /> },
      ]}
      emptyTitle={t('ui.aucunAppelDOffres')}
      emptyDescription={t('ui.aucunAppelDOffresNEst_c5213')}
      notice={t('ui.repondreAUnAppelDOffres')}
    />
  );
}
