import { ResourcePage } from '@/components/pages';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

type FundingRequest = Record<string, unknown>;

/** INVESTMENT — demandes de financement déposées. */
export default function InvestmentRequests() {
  const { locale } = useI18n();
  return (
    <ResourcePage<FundingRequest>
      title="Mes demandes"
      subtitle="Demandes de financement que vous avez déposées."
      icon="💼"
      queryKey={['invest', 'requests'] as unknown[]}
      fetch={async () => [] as FundingRequest[]}
      rowKey={(request) => String(request.id)}
      columns={[
        { key: 'projectTitle', label: 'Projet', render: (request) => String(request.projectTitle ?? request.projectId ?? '—') },
        { key: 'amount', label: 'Montant', render: (request) => (request.amount !== null && request.amount !== undefined ? `${String(request.amount)} ${String(request.currency ?? '')}` : '—') },
        { key: 'status', label: 'Statut', render: (request) => <Chip label={String(request.status ?? '—')} tone="neutral" size="sm" /> },
        { key: 'createdAt', label: 'Déposée le', render: (request) => (request.createdAt ? formatDate(String(request.createdAt), locale) : '—') },
      ]}
      emptyTitle="Aucune demande"
      emptyDescription="Vos demandes de financement apparaîtront ici."
    />
  );
}
