import { useParams } from 'react-router-dom';

import { ResourcePage } from '@/components/pages';
import { exportApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { ExportDocument } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n, tr } from '@/i18n';

/**
 * FARMER — pièces rattachées à un dossier d'exportation (accès tracé).
 *
 * Les documents viennent du dossier lui-même (`GET /exports/:id` →
 * `exportOrder.documents`), pas des données d'un projet : ce sont deux corpus
 * distincts. Le champ `type` est l'un des quatre types obligatoires, jamais une
 * catégorie libre.
 */

const TYPE_LABEL: Record<string, string> = {
  get INVOICE() { return tr('ui.factureCommerciale'); },
  get CERTIFICATE_OF_ORIGIN() { return tr('ui.certificatDOrigine'); },
  get PHYTOSANITARY() { return tr('ui.certificatPhytosanitaire'); },
  get BILL_OF_LADING() { return tr('ui.connaissementLta'); },
};

export default function FarmerExportDocuments() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();

  return (
    <ResourcePage<ExportDocument>
      title={t('ui.documentsDuDossier')}
      subtitle={t('ui.piecesRattacheesACeDossierD')}
      icon="📎"
      queryKey={queryKeys.exports.one(id ?? '')}
      fetch={() => exportApi.get(id ?? '').then((result) => result.data.exportOrder.documents)}
      rowKey={(document) => document.id}
      columns={[
        { key: 'name', label: t('ui.fichier'), render: (document) => document.name },
        {
          key: 'type',
          label: t('ui.type'),
          render: (document) => (
            <Chip label={TYPE_LABEL[document.type] ?? document.type} tone="neutral" size="sm" />
          ),
        },
        {
          key: 'storageKey',
          label: t('ui.stockage'),
          render: (document) => (document.storageKey ? t('ui.depose') : t('ui.referenceSeule')),
        },
        { key: 'issuedAt', label: t('ui.emisLe'), render: (document) => formatDate(document.issuedAt, locale) },
      ]}
      emptyTitle={t('ui.aucunDocument')}
      emptyDescription={t('ui.aucunePieceNEstRattacheeA')}
      notice={t('ui.lesQuatrePiecesObligatoiresFactureCommerciale')}
    />
  );
}
