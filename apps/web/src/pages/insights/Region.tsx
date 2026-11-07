import { motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Card, Chip, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { insightsApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { formatNumber } from '@/lib/format';
import { COLORS, DURATION, EASE } from '@/theme';

const INDICATORS: Array<{ key: string; label: string; unit?: string }> = [
  { key: 'producers', label: 'Producteurs' },
  { key: 'cultivatedAreaHa', label: 'Surface cultivée', unit: 'ha' },
  { key: 'volumeKg', label: 'Volume', unit: 'kg' },
  { key: 'listings', label: 'Annonces' },
  { key: 'projects', label: 'Projets' },
  { key: 'exportValue', label: 'Valeur export', unit: 'USD' },
];

/** INSIGHTS — vue régionale agrégée, seuil de divulgation affiché. */
export default function InsightsRegion() {
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
      <Text preset="h1" style={{ marginBottom: 8 }}>
        Région {region ?? '—'}
      </Text>
      <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
        Indicateurs agrégés. Un indicateur n'est affiché que si le groupe contient au moins {disclosure?.minGroupSize ?? '—'} entités.
      </Text>

      {disclosure ? (
        <Card tone="pale" style={{ marginBottom: 24 }}>
          <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
            Politique de divulgation : seuil minimum {disclosure.minGroupSize} entités. En dessous de ce seuil, l'indicateur est masqué pour
            empêcher toute ré-identification. Aucune valeur n'est extrapolée pour combler un groupe insuffisant.
          </Text>
        </Card>
      ) : null}

      {overview.isLoading ? (
        <LoadingState count={2} height={110} />
      ) : overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} showRequestId />
      ) : Object.keys(indicators).length === 0 ? (
        <EmptyState title="Aucun indicateur" description="Aucun indicateur agrégé n'est disponible pour cette région." icon="📊" />
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
                    <Chip label="masqué" tone="neutral" size="sm" />
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
