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
  const { code } = useParams<{ code: string }>();
  const { locale } = useI18n();

  return (
    <DetailPage<PublicLot>
      title={(lot) => lot.code}
      subtitle="Fiche de traçabilité du lot."
      backHref="/farmer/lots"
      backLabel="Retour aux lots"
      queryKey={queryKeys.lots.one(code ?? '')}
      fetch={() => lotApi.get(code ?? '').then((result) => result.data as unknown as PublicLot)}
      actions={(lot) => (
        <>
          <Button label="QR code" variant="outline" size="sm" onClick={() => window.open(`/api/v1/public/lots/${lot.code}/qr.png`, '_blank')} />
          <Button label="Fiche publique" variant="ghost" size="sm" onClick={() => window.open(`/public/lots/${lot.code}`, '_blank')} />
        </>
      )}
      sections={(lot) => [
        {
          title: 'Identification',
          fields: [
            { label: 'Code', value: <span style={{ fontFamily: 'monospace', fontSize: 14 }}>{lot.code}</span> },
            { label: 'Culture', value: lot.crop?.name ?? lot.crop?.slug ?? '—' },
            { label: 'Statut', value: <Chip label={lot.status} tone="neutral" size="sm" /> },
            { label: 'Créé le', value: formatDate(lot.createdAt, locale) },
          ],
        },
        {
          title: 'Chaîne de traçabilité',
          notice: lot.verification.certification === false ? "Aucune certification n'est associée à ce lot. La mention « certification » reste désactivée tant qu'un certificat validé n'est pas joint." : undefined,
          fields: [
            {
              label: 'Étapes',
              value:
                lot.timeline.length === 0 ? (
                  'Aucune étape enregistrée.'
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
          title: 'Divulgation',
          notice: `Règle appliquée : ${lot.disclosure.rule}.`,
          fields: [
            { label: 'Champs masqués', value: lot.disclosure.hiddenFields.length > 0 ? lot.disclosure.hiddenFields.join(', ') : 'aucun' },
          ],
        },
      ]}
    />
  );
}
