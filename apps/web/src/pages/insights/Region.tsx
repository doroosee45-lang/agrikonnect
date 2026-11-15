import { motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Card, Chip, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { insightsApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { formatNumber } from '@/lib/format';
import { COLORS, DURATION, EASE } from '@/theme';
import { useI18n, tr } from '@/i18n';

const INDICATORS: Array<{ key: string; label: string; unit?: string }> = [
  { key: 'producers', get label() { return tr('ui.producteurs'); } },
  { key: 'cultivatedAreaHa', get label() { return tr('ui.surfaceCultivee'); }, unit: 'ha' },
  { key: 'volumeKg', get label() { return tr('ui.volume'); }, unit: 'kg' },
  { key: 'listings', get label() { return tr('ui.annonces'); } },
  { key: 'projects', get label() { return tr('ui.projets'); } },
  { key: 'exportValue', get label() { return tr('ui.valeurExport'); }, unit: 'USD' },
];

/** INSIGHTS — vue régionale agrégée, seuil de divulgation affiché. */
export default function InsightsRegion() {
  const { t } = useI18n();
  const { region } = useParams<{ region: string }>();

  const overview = useQuery({
    queryKey: queryKeys.insights.overview({ countryCode: region ?? '' }),
    queryFn: () => insightsApi.overview({ countryCode: region ?? '' }).then((result) => result.data),
    enabled: Boolean(region),
    retry: false,
  });

  const disclosure = overview.data?.disclosure;
  const indicators = (overview.data?.indicators ?? {}) as Record<string, unknown>;

  return (
    <Section>
      <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.region', { value: region ?? '—' })}</Text>
      <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>{t('ui.indicateursAgregesUnIndicateurNEst', { value: disclosure?.minGroupSize ?? '—' })}</Text>

      {disclosure ? (
        <Card tone="pale" style={{ marginBottom: 24 }}>
          <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>{t('ui.politiqueDeDivulgationSeuilMinimumEntites', { minGroupSize: disclosure.minGroupSize })}</Text>
        </Card>
      ) : null}

      {overview.isLoading ? (
        <LoadingState count={2} height={110} />
      ) : overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} showRequestId />
      ) : Object.keys(indicators).length === 0 ? (
        <EmptyState title={t('ui.aucunIndicateur')} description={t('ui.aucunIndicateurAgregeNEstDisponible')} icon="📊" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {INDICATORS.map((indicator, index) => {
            const value = indicators[indicator.key];
            const suppressed = value === null || value === undefined;
            return (
              <motion.div
                key={indicator.key}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 6) * 0.05, ease: EASE.out }}
              >
                <Card tone="white" hover>
                  <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 8 }}>
                    {indicator.label}
                  </Text>
                  {suppressed ? (
                    <Chip label={t('ui.masque_ca7ce')} tone="neutral" size="sm" />
                  ) : (
                    <Text preset="numeric" color={COLORS.forestGreen}>
                      {typeof value === 'number' ? formatNumber(value) : String(value)}
                      {indicator.unit ? <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 4 }}>{indicator.unit}</span> : null}
                    </Text>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
