import { ResourcePage } from '@/components/pages';
import { exportApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { ExportOrderList } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/**
 * FARMER — dossiers d'exportation (EXP-01).
 *
 * Un dossier d'export n'est pas une commande : il porte l'incoterm, le pays de
 * destination, le taux de change appliqué et sa propre chaîne de statuts
 * (DRAFT → CONFIRMED → IN_CONTROL → CERTIFIED → IN_TRANSIT → DELIVERED).
 * Afficher ici la liste des commandes ferait croire à un suivi documentaire qui
 * n'existerait pas.
 */

const STATUS_TONE = {
  DRAFT: 'neutral',
  CONFIRMED: 'info',
  IN_CONTROL: 'warning',
  CERTIFIED: 'info',
  IN_TRANSIT: 'warning',
  DELIVERED: 'success',
  CLOSED: 'neutral',
  CANCELLED: 'error',
} as const;

export default function FarmerExport() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<ExportOrderList['items'][number]>
      title={t('ui.exportations')}
      subtitle={t('ui.dossiersDExportationIncotermDestinationConformit')}
      icon="🚢"
      queryKey={queryKeys.exports.list({ limit: 100 })}
      fetch={() => exportApi.list({ limit: 100 }).then((result) => result.data.items)}
      rowKey={(order) => order.id}
      rowHref={(order) => `/farmer/export/${order.id}`}
      columns={[
        {
          key: 'reference',
          label: t('ui.reference'),
          render: (order) => <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{order.reference}</span>,
        },
        {
          key: 'status',
          label: t('ui.statut'),
          render: (order) => <Chip label={order.status} tone={STATUS_TONE[order.status]} size="sm" />,
        },
        { key: 'destinationCountry', label: t('ui.destination'), render: (order) => order.destinationCountry },
        { key: 'incoterm', label: t('ui.incoterm'), render: (order) => order.incoterm ?? '—' },
        {
          key: 'totalAmount',
          label: t('ui.montant'),
          render: (order) => (order.totalAmount !== null ? `${order.totalAmount} ${order.currency}` : '—'),
        },
        {
          key: 'documents',
          label: t('ui.pieces'),
          render: (order) => `${order._count.documents}/4`,
        },
        { key: 'createdAt', label: t('ui.creeLe'), render: (order) => formatDate(order.createdAt, locale) },
      ]}
      emptyTitle={t('ui.aucunDossierDExportation')}
      emptyDescription={t('ui.aucunDossierNAEteOuvert')}
      notice={t('ui.leTauxDeChangeAfficheEst')}
    />
  );
}
