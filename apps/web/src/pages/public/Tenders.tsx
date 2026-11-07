import { ResourcePage } from '@/components/pages';
import { tenderApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { Tender } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate, formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';

/** PUBLIC — appels d'offres publiés. */
export default function PublicTenders() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Tender>
      title="Appels d'offres"
      subtitle="Appels d'offres publiés par des acheteurs, nationaux et export."
      icon="📄"
      public
      queryKey={queryKeys.tenders.list({ limit: 100 })}
      fetch={() => tenderApi.list({ limit: 100 }).then((result) => result.data)}
      rowKey={(tender) => tender.id}
      columns={[
        { key: 'title', label: 'Titre', render: (tender) => tender.title },
        { key: 'quantity', label: 'Volume', render: (tender) => `${formatNumber(tender.quantity, locale, 0)} ${tender.unit}` },
        { key: 'destinationCountry', label: 'Destination', render: (tender) => <Chip label={tender.destinationCountry} tone="neutral" size="sm" /> },
        { key: 'deadline', label: 'Échéance', render: (tender) => (tender.deadline ? formatDate(tender.deadline, locale) : '—') },
        { key: 'status', label: 'Statut', render: (tender) => <Chip label={tender.status} tone={tender.status === 'OPEN' || tender.status === 'PUBLISHED' ? 'success' : 'neutral'} size="sm" /> },
      ]}
      emptyTitle="Aucun appel d'offres"
      emptyDescription="Aucun appel d'offres n'est publié pour le moment."
      notice="Répondre à un appel d'offres engage sur les volumes déclarés : ils restent marqués comme déclarés tant qu'aucun contrôle n'a eu lieu."
    />
  );
}
