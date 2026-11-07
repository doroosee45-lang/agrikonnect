import { useParams } from 'react-router-dom';

import { ResourcePage } from '@/components/pages';
import { exportApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { ExportDocument } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/**
 * FARMER — pièces rattachées à un dossier d'exportation (accès tracé).
 *
 * Les documents viennent du dossier lui-même (`GET /exports/:id` →
 * `exportOrder.documents`), pas des données d'un projet : ce sont deux corpus
 * distincts. Le champ `type` est l'un des quatre types obligatoires, jamais une
 * catégorie libre.
 */

const TYPE_LABEL: Record<string, string> = {
  INVOICE: 'Facture commerciale',
  CERTIFICATE_OF_ORIGIN: "Certificat d'origine",
  PHYTOSANITARY: 'Certificat phytosanitaire',
  BILL_OF_LADING: 'Connaissement / LTA',
};

export default function FarmerExportDocuments() {
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();

  return (
    <ResourcePage<ExportDocument>
      title="Documents du dossier"
      subtitle="Pièces rattachées à ce dossier d'exportation. Chaque consultation est journalisée."
      icon="📎"
      queryKey={queryKeys.exports.one(id ?? '')}
      fetch={() => exportApi.get(id ?? '').then((result) => result.data.exportOrder.documents)}
      rowKey={(document) => document.id}
      columns={[
        { key: 'name', label: 'Fichier', render: (document) => document.name },
        {
          key: 'type',
          label: 'Type',
          render: (document) => (
            <Chip label={TYPE_LABEL[document.type] ?? document.type} tone="neutral" size="sm" />
          ),
        },
        {
          key: 'storageKey',
          label: 'Stockage',
          render: (document) => (document.storageKey ? 'déposé' : 'référence seule'),
        },
        { key: 'issuedAt', label: 'Émis le', render: (document) => formatDate(document.issuedAt, locale) },
      ]}
      emptyTitle="Aucun document"
      emptyDescription="Aucune pièce n'est rattachée à ce dossier. La certification est refusée tant que les quatre pièces obligatoires ne sont pas toutes présentes."
      notice="Les quatre pièces obligatoires : facture commerciale, certificat d'origine, certificat phytosanitaire, connaissement / LTA."
    />
  );
}
