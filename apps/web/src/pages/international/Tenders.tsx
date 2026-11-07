import { ResourcePage } from '@/components/pages';
import { tenderApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Tender } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** INTERNATIONAL — appels d'offres internationaux. */
export default function InternationalTenders() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Tender>
      title="Appels d'offres"
      subtitle="Appels d'offres internationaux publiés sur la plateforme."
      icon="🌍"
      public
      queryKey={queryKeys.tenders.list({ limit: 100 })}
      fetch={() => tenderApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(tender) => tender.id}
      columns={[
        { key: 'title', label: 'Titre', render: (tender) => tender.title },
        { key: 'destinationCountry', label: 'Pays', render: (tender) => <Chip label={tender.destinationCountry} tone="neutral" size="sm" /> },
        { key: 'quantity', label: 'Quantité', render: (tender) => `${tender.quantity} ${tender.unit}` },
        { key: 'deadline', label: 'Clôture', render: (tender) => (tender.deadline ? formatDate(tender.deadline, locale) : '—') },
        { key: 'status', label: 'Statut', render: (tender) => <Chip label={tender.status} tone={tender.status === 'OPEN' ? 'success' : 'neutral'} size="sm" /> },
      ]}
      emptyTitle="Aucun appel d'offres"
      emptyDescription="Aucun appel d'offres n'est actuellement publié."
    />
  );
}
