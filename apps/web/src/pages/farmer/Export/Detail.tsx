import { Link, useParams } from 'react-router-dom';

import { DetailPage } from '@/components/pages';
import { exportApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { ExportOrderDetail } from '@/services/types';
import { Button, Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { VERT } from '../../../theme/agrikonnect';

/**
 * FARMER — dossier d'exportation (EXP-02).
 *
 * `GET /exports/:id` renvoie le dossier, son état de conformité documentaire et
 * la conversion de change. Deux règles d'affichage en découlent :
 *  - `canBeCertified` est calculé **côté serveur** — l'interface ne le redevine pas ;
 *  - sans taux daté et sourcé, `finance.conversion.amount` reste `null` et le
 *    message du serveur est repris tel quel : aucune conversion n'est inventée.
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

export default function FarmerExportDetail() {
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();

  return (
    <DetailPage<ExportOrderDetail>
      title={(detail) => detail.exportOrder.reference}
      subtitle="Dossier d'exportation : conformité documentaire et change appliqué."
      backHref="/farmer/export"
      backLabel="Retour aux exportations"
      queryKey={queryKeys.exports.one(id ?? '')}
      fetch={() => exportApi.get(id ?? '').then((result) => result.data)}
      actions={(detail) => (
        <Link to={`/farmer/export/${detail.exportOrder.id}/documents`}>
          <Button label="Documents du dossier" variant="outline" size="sm" />
        </Link>
      )}
      sections={(detail) => {
        const { exportOrder, compliance, finance } = detail;
        return [
          {
            title: 'Dossier',
            fields: [
              {
                label: 'Référence',
                value: <span style={{ fontFamily: 'monospace', fontSize: 14 }}>{exportOrder.reference}</span>,
              },
              {
                label: 'Statut',
                value: <Chip label={exportOrder.status} tone={STATUS_TONE[exportOrder.status]} size="sm" />,
              },
              { label: 'Créé le', value: formatDate(exportOrder.createdAt, locale) },
              { label: 'Mis à jour le', value: formatDate(exportOrder.updatedAt, locale) },
            ],
          },
          {
            title: 'Logistique',
            fields: [
              { label: 'Destination', value: exportOrder.destinationCountry },
              { label: 'Incoterm', value: exportOrder.incoterm ?? 'non précisé' },
              { label: 'Acheteur', value: exportOrder.buyerOrgId ?? '—' },
              { label: 'Transporteur', value: exportOrder.logisticsPartnerOrgId ?? 'non désigné' },
              { label: 'Appel d’offres', value: exportOrder.tenderId ?? '—' },
            ],
          },
          {
            title: 'Conformité documentaire',
            notice:
              compliance.canBeCertified
                ? 'Les quatre pièces obligatoires sont présentes : le dossier peut être certifié.'
                : `Certification impossible tant que ${compliance.missing.join(', ')} manque(nt). Ce contrôle est appliqué côté serveur.`,
            fields: compliance.required.map((item) => ({
              label: item.label,
              value: (
                <Chip
                  label={item.present ? 'présent' : 'manquant'}
                  tone={item.present ? 'success' : 'error'}
                  size="sm"
                />
              ),
            })),
          },
          {
            title: 'Montant et change',
            notice: finance.conversion.error ?? undefined,
            fields: [
              {
                label: 'Montant',
                value:
                  finance.totalAmount !== null ? `${finance.totalAmount} ${finance.currency}` : 'non renseigné',
              },
              { label: 'Devise', value: finance.currency },
              {
                label: 'Taux de change',
                value: finance.fxRate ? JSON.stringify(finance.fxRate) : 'aucun taux enregistré',
              },
              {
                label: 'Conversion',
                value: finance.conversion.amount !== null ? String(finance.conversion.amount) : 'non converti',
              },
            ],
          },
          {
            title: 'Pièces rattachées',
            fields: [
              {
                label: 'Documents',
                value: (
                  <Link to={`/farmer/export/${exportOrder.id}/documents`} style={{ color: VERT[800] }}>
                    {exportOrder.documents.length > 0
                      ? `${exportOrder.documents.length} pièce(s) — consulter`
                      : 'Aucune pièce rattachée — consulter'}
                  </Link>
                ),
              },
            ],
          },
        ];
      }}
    />
  );
}
