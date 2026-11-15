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
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();

  return (
    <DetailPage<ExportOrderDetail>
      title={(detail) => detail.exportOrder.reference}
      subtitle={t('ui.dossierDExportationConformiteDocumentaireEt')}
      backHref="/farmer/export"
      backLabel={t('ui.retourAuxExportations')}
      queryKey={queryKeys.exports.one(id ?? '')}
      fetch={() => exportApi.get(id ?? '').then((result) => result.data)}
      actions={(detail) => (
        <Link to={`/farmer/export/${detail.exportOrder.id}/documents`}>
          <Button label={t('ui.documentsDuDossier')} variant="outline" size="sm" />
        </Link>
      )}
      sections={(detail) => {
        const { exportOrder, compliance, finance } = detail;
        return [
          {
            title: t('ui.dossier'),
            fields: [
              {
                label: t('ui.reference'),
                value: <span style={{ fontFamily: 'monospace', fontSize: 14 }}>{exportOrder.reference}</span>,
              },
              {
                label: t('ui.statut'),
                value: <Chip label={exportOrder.status} tone={STATUS_TONE[exportOrder.status]} size="sm" />,
              },
              { label: t('ui.creeLe'), value: formatDate(exportOrder.createdAt, locale) },
              { label: t('ui.misAJourLe'), value: formatDate(exportOrder.updatedAt, locale) },
            ],
          },
          {
            title: t('ui.logistique'),
            fields: [
              { label: t('ui.destination'), value: exportOrder.destinationCountry },
              { label: t('ui.incoterm'), value: exportOrder.incoterm ?? t('ui.nonPrecise') },
              { label: t('ui.acheteur'), value: exportOrder.buyerOrgId ?? '—' },
              { label: t('ui.transporteur'), value: exportOrder.logisticsPartnerOrgId ?? t('ui.nonDesigne') },
              { label: t('ui.appelDOffres'), value: exportOrder.tenderId ?? '—' },
            ],
          },
          {
            title: t('ui.conformiteDocumentaire'),
            notice:
              compliance.canBeCertified
                ? t('ui.lesQuatrePiecesObligatoiresSontPresentes')
                : t('ui.certificationImpossibleTantQueManqueNt', { value: compliance.missing.join(', ') }),
            fields: compliance.required.map((item) => ({
              label: item.label,
              value: (
                <Chip
                  label={item.present ? t('ui.present') : t('ui.manquant')}
                  tone={item.present ? 'success' : 'error'}
                  size="sm"
                />
              ),
            })),
          },
          {
            title: t('ui.montantEtChange'),
            notice: finance.conversion.error ?? undefined,
            fields: [
              {
                label: t('ui.montant'),
                value:
                  finance.totalAmount !== null ? `${finance.totalAmount} ${finance.currency}` : t('ui.valueNotProvided'),
              },
              { label: t('ui.devise'), value: finance.currency },
              {
                label: t('ui.tauxDeChange'),
                value: finance.fxRate ? JSON.stringify(finance.fxRate) : t('ui.noRateRecorded'),
              },
              {
                label: t('ui.conversion'),
                value: finance.conversion.amount !== null ? String(finance.conversion.amount) : t('ui.notConvertedValue'),
              },
            ],
          },
          {
            title: t('ui.piecesRattachees'),
            fields: [
              {
                label: t('ui.documents'),
                value: (
                  <Link to={`/farmer/export/${exportOrder.id}/documents`} style={{ color: VERT[800] }}>
                    {exportOrder.documents.length > 0
                      ? t('ui.pieceSConsulter', { length: exportOrder.documents.length })
                      : t('ui.aucunePieceRattacheeConsulter')}
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
