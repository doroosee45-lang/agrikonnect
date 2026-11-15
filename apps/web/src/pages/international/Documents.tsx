import { ResourcePage } from '@/components/pages';
import { Chip } from '@/components/ui';
import { useI18n } from '@/i18n';

type Document = Record<string, unknown>;

/** INTERNATIONAL — documents d'exportation (certificats, factures, connaissements). */
export default function InternationalDocuments() {
  const { t } = useI18n();
  return (
    <ResourcePage<Document>
      title={t('ui.documentsDExportation')}
      subtitle={t('ui.certificatsFacturesEtConnaissementsRattachesA')}
      icon="📎"
      queryKey={['international', 'documents'] as unknown[]}
      fetch={async () => [] as Document[]}
      rowKey={(document) => String(document.id)}
      columns={[
        { key: 'name', label: t('ui.fichier'), render: (document) => String(document.name ?? '—') },
        { key: 'kind', label: t('ui.type'), render: (document) => <Chip label={String(document.kind ?? '—')} tone="neutral" size="sm" /> },
        { key: 'status', label: t('ui.statut'), render: (document) => <Chip label={String(document.status ?? '—')} tone="neutral" size="sm" /> },
      ]}
      emptyTitle={t('ui.aucunDocument')}
      emptyDescription={t('ui.lesDocumentsDExportationApparaissentIci')}
    />
  );
}
