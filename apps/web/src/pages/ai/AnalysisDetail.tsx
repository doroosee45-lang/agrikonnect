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
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();

  return (
    <DetailPage<AiAnalysis>
      title={() => t('ui.analyse')}
      subtitle={t('ui.detailDeLAnalyseEtAvertissement')}
      backHref="/ai/analyses"
      backLabel={t('ui.retourAuxAnalyses')}
      queryKey={queryKeys.ai.one(id ?? '')}
      fetch={() => aiApi.get(id ?? '').then((result) => result.data)}
      actions={() => (
        <Link to="/ai/assistant">
          <Button label={t('ui.nouvelleAnalyse')} variant="outline" size="sm" />
        </Link>
      )}
      sections={(analysis) => [
        {
          title: t('ui.metadonnees'),
          fields: [
            { label: t('ui.type'), value: <Chip label={analysis.type} tone="neutral" size="sm" /> },
            { label: t('ui.statut'), value: <Chip label={analysis.status} tone={analysis.status === 'ESCALATED' ? 'warning' : 'neutral'} size="sm" /> },
            { label: t('ui.creeeLe'), value: formatDate(analysis.createdAt, locale) },
            { label: t('ui.escaladeeLe'), value: analysis.escalatedAt ? formatDate(analysis.escalatedAt, locale) : '—' },
          ],
        },
        {
          title: t('ui.question'),
          fields: [{ label: t('ui.prompt'), value: <Text preset="bodySm" style={{ lineHeight: 1.7 }}>{analysis.prompt}</Text> }],
        },
        {
          title: t('ui.avertissementProduit'),
          notice: analysis.disclaimer ?? undefined,
          fields: [
            {
              label: t('ui.rappel'),
              value: (
                <Card tone="pale">
                  <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>{t('ui.cetteReponseEstGenereeParUne')}</Text>
                </Card>
              ),
            },
          ],
        },
      ]}
    />
  );
}
