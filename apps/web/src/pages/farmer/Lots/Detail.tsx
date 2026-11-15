import { useParams } from 'react-router-dom';

import { DetailPage } from '@/components/pages';
import { lotApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { PublicLot } from '@/services/types';
import { Button, Card, Chip, Text } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** FARMER — détail d'un lot et ses étapes de traçabilité horodatées. */
export default function FarmerLotDetail() {
  const { t } = useI18n();
  const { code } = useParams<{ code: string }>();
  const { locale } = useI18n();

  return (
    <DetailPage<PublicLot>
      title={(lot) => lot.code}
      subtitle={t('ui.ficheDeTracabiliteDuLot')}
      backHref="/farmer/lots"
      backLabel={t('ui.retourAuxLots')}
      queryKey={queryKeys.lots.one(code ?? '')}
      fetch={() => lotApi.get(code ?? '').then((result) => result.data as unknown as PublicLot)}
      actions={(lot) => (
        <>
          <Button label={t('ui.qrCode')} variant="outline" size="sm" onClick={() => window.open(`/api/v1/public/lots/${lot.code}/qr.png`, '_blank')} />
          <Button label={t('ui.fichePublique')} variant="ghost" size="sm" onClick={() => window.open(`/public/lots/${lot.code}`, '_blank')} />
        </>
      )}
      sections={(lot) => [
        {
          title: t('ui.identification'),
          fields: [
            { label: t('ui.code'), value: <span style={{ fontFamily: 'monospace', fontSize: 14 }}>{lot.code}</span> },
            { label: t('ui.culture'), value: lot.crop?.name ?? lot.crop?.slug ?? '—' },
            { label: t('ui.statut'), value: <Chip label={lot.status} tone="neutral" size="sm" /> },
            { label: t('ui.creeLe'), value: formatDate(lot.createdAt, locale) },
          ],
        },
        {
          title: t('ui.chaineDeTracabilite'),
          notice: lot.verification.certification === false ? t('ui.aucuneCertificationNEstAssocieeA') : undefined,
          fields: [
            {
              label: t('ui.etapes'),
              value:
                lot.timeline.length === 0 ? (
                  t('ui.noStepRecordedYet')
                ) : (
                  <Card tone="pale">
                    {lot.timeline.map((step, index) => (
                      <div key={`${step.type}-${index}`} style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 8 }}>
                        <Text preset="caption" style={{ minWidth: 96 }}>
                          {formatDate(step.at, locale)}
                        </Text>
                        <Text preset="bodySm" style={{ fontWeight: 600 }}>
                          {step.type}
                        </Text>
                      </div>
                    ))}
                  </Card>
                ),
            },
          ],
        },
        {
          title: t('ui.divulgation'),
          notice: t('ui.regleAppliquee', { rule: lot.disclosure.rule }),
          fields: [
            { label: t('ui.champsMasques'), value: lot.disclosure.hiddenFields.length > 0 ? lot.disclosure.hiddenFields.join(', ') : t('ui.aucun') },
          ],
        },
      ]}
    />
  );
}
