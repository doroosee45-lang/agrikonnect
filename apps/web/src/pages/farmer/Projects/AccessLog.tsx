import { useParams } from 'react-router-dom';

import { ResourcePage } from '@/components/pages';
import { projectDataApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

type AccessEntry = Record<string, unknown>;

/** FARMER — journal des accès à la salle de données (DATA-06). */
export default function FarmerProjectAccessLog() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();

  return (
    <ResourcePage<AccessEntry>
      title={t('ui.journalDAcces')}
      subtitle={t('ui.consultationsDeLaSalleDeDonnees')}
      icon="🔐"
      queryKey={[...queryKeys.projects.one(id ?? ''), 'access-log'] as unknown[]}
      fetch={() => projectDataApi.accessLog(id ?? '').then((result) => result.data as unknown as AccessEntry[])}
      rowKey={(entry) => String(entry.id)}
      notice={t('ui.ceJournalEstConserveEtConsultable')}
      columns={[
        { key: 'document', label: t('ui.document'), render: (entry) => String(entry.documentName ?? entry.documentId ?? '—') },
        { key: 'actor', label: t('ui.par'), render: (entry) => String(entry.actorName ?? entry.actorId ?? '—') },
        { key: 'action', label: t('ui.action'), render: (entry) => <Chip label={String(entry.action ?? '—')} tone="neutral" size="sm" /> },
        { key: 'at', label: t('ui.le'), render: (entry) => (entry.accessedAt ? formatDate(String(entry.accessedAt), locale) : '—') },
      ]}
      emptyTitle={t('ui.aucunAcces')}
      emptyDescription={t('ui.aucuneConsultationNAEncoreEte')}
    />
  );
}
