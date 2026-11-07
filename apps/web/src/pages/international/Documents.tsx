import { ResourcePage } from '@/components/pages';
import { Chip } from '@/components/ui';

type Document = Record<string, unknown>;

/** INTERNATIONAL — documents d'exportation (certificats, factures, connaissements). */
export default function InternationalDocuments() {
  return (
    <ResourcePage<Document>
      title="Documents d'exportation"
      subtitle="Certificats, factures et connaissements rattachés à vos commandes internationales."
      icon="📎"
      queryKey={['international', 'documents'] as unknown[]}
      fetch={async () => [] as Document[]}
      rowKey={(document) => String(document.id)}
      columns={[
        { key: 'name', label: 'Fichier', render: (document) => String(document.name ?? '—') },
        { key: 'kind', label: 'Type', render: (document) => <Chip label={String(document.kind ?? '—')} tone="neutral" size="sm" /> },
        { key: 'status', label: 'Statut', render: (document) => <Chip label={String(document.status ?? '—')} tone="neutral" size="sm" /> },
      ]}
      emptyTitle="Aucun document"
      emptyDescription="Les documents d'exportation apparaissent ici."
    />
  );
}
