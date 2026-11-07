import { Link, useParams } from 'react-router-dom';

import { DetailPage } from '@/components/pages';
import { aiApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { AiAnalysis } from '@/services/types';
import { Button, Card, Chip, Text } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS } from '@/theme';

/** AI — détail d'une analyse et son disclaimer produit. */
export default function AiAnalysisDetail() {
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();

  return (
    <DetailPage<AiAnalysis>
      title={() => 'Analyse'}
      subtitle="Détail de l'analyse et avertissement produit."
      backHref="/ai/analyses"
      backLabel="Retour aux analyses"
      queryKey={queryKeys.ai.one(id ?? '')}
      fetch={() => aiApi.get(id ?? '').then((result) => result.data)}
      actions={() => (
        <Link to="/ai/assistant">
          <Button label="Nouvelle analyse" variant="outline" size="sm" />
        </Link>
      )}
      sections={(analysis) => [
        {
          title: 'Métadonnées',
          fields: [
            { label: 'Type', value: <Chip label={analysis.type} tone="neutral" size="sm" /> },
            { label: 'Statut', value: <Chip label={analysis.status} tone={analysis.status === 'ESCALATED' ? 'warning' : 'neutral'} size="sm" /> },
            { label: 'Créée le', value: formatDate(analysis.createdAt, locale) },
            { label: 'Escaladée le', value: analysis.escalatedAt ? formatDate(analysis.escalatedAt, locale) : '—' },
          ],
        },
        {
          title: 'Question',
          fields: [{ label: 'Prompt', value: <Text preset="bodySm" style={{ lineHeight: 1.7 }}>{analysis.prompt}</Text> }],
        },
        {
          title: 'Avertissement produit',
          notice: analysis.disclaimer ?? undefined,
          fields: [
            {
              label: 'Rappel',
              value: (
                <Card tone="pale">
                  <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
                    Cette réponse est générée par une IA. Elle ne constitue pas un avis agronomique et ne remplace pas un contrôle de terrain.
                  </Text>
                </Card>
              ),
            },
          ],
        },
      ]}
    />
  );
}
