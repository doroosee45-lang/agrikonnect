import { ResourcePage } from '@/components/pages';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

type FundingRequest = Record<string, unknown>;

/** INVESTMENT — demandes de financement déposées. */
export default function InvestmentRequests() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<FundingRequest>
      title={t('ui.mesDemandes')}
      subtitle={t('ui.demandesDeFinancementQueVousAvez')}
      icon="💼"
      queryKey={['invest', 'requests'] as unknown[]}
      fetch={async () => [] as FundingRequest[]}
      rowKey={(request) => String(request.id)}
      columns={[
        { key: 'projectTitle', label: t('ui.projet'), render: (request) => String(request.projectTitle ?? request.projectId ?? '—') },
        { key: 'amount', label: t('ui.montant'), render: (request) => (request.amount !== null && request.amount !== undefined ? `${String(request.amount)} ${String(request.currency ?? '')}` : '—') },
        { key: 'status', label: t('ui.statut'), render: (request) => <Chip label={String(request.status ?? '—')} tone="neutral" size="sm" /> },
        { key: 'createdAt', label: t('ui.deposeeLe'), render: (request) => (request.createdAt ? formatDate(String(request.createdAt), locale) : '—') },
      ]}
      emptyTitle={t('ui.aucuneDemande')}
      emptyDescription={t('ui.vosDemandesDeFinancementApparaitrontIci')}
    />
  );
}
