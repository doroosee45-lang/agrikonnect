import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { Card, Chip, EmptyState, ErrorState, Input, LoadingState, Section, Text } from '@/components/ui';
import { insightsApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

/** PUBLIC — agriculture d'un pays : indicateurs agrégés réels. */
export default function PublicAgricultureCountry() {
  const { locale } = useI18n();
  const [countryCode, setCountryCode] = useState('CD');

  const overview = useQuery({
    queryKey: queryKeys.insights.overview({ countryCode }),
    queryFn: () => insightsApi.overview({ countryCode }).then((result) => result.data),
    enabled: countryCode.length === 2,
  });

  const indicators = overview.data?.indicators ?? {};

  return (
    <Section>
      <Text preset="overline" color={COLORS.forestGreen} style={{ marginBottom: 12 }}>
        Pays
      </Text>
      <Text preset="h1" style={{ marginBottom: 8 }}>
        Agriculture par pays
      </Text>
      <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32, maxWidth: 640 }}>
        Indicateurs agrégés, avec leur source, leur méthode et leur date. Les groupes sous le seuil de k-anonymat
        sont masqués.
      </Text>

      <div style={{ maxWidth: 240, marginBottom: 32 }}>
        <Input label="Code pays" value={countryCode} onChange={(event) => setCountryCode(event.target.value.toUpperCase().slice(0, 2))} maxLength={2} placeholder="CD" />
      </div>

      {overview.isLoading ? (
        <LoadingState count={2} height={100} />
      ) : overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} showRequestId />
      ) : Object.keys(indicators).length === 0 ? (
        <EmptyState title="Aucun indicateur" description="Aucune donnée agrégée disponible pour ce pays." icon="🌍" />
      ) : (
        <>
          {overview.data?.disclosure?.message ? (
            <Card tone="pale" style={{ marginBottom: 24 }}>
              <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
                {overview.data.disclosure.message}
              </Text>
            </Card>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {Object.entries(indicators).map(([key, indicator], index) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 8) * 0.04, ease: EASE.out }}
              >
                <Card tone="white" hover>
                  <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 8 }}>
                    {key}
                  </Text>
                  {indicator.value === null ? (
                    <Chip label="masqué" tone="warning" size="sm" />
                  ) : (
                    <Text preset="numeric" color={COLORS.forestGreen}>
                      {formatNumber(indicator.value, locale)}
                      <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 4 }}>{indicator.unit}</span>
                    </Text>
                  )}
                  <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 8 }}>
                    {indicator.source} · {indicator.method}
                  </Text>
                  {indicator.reason ? (
                    <Text preset="caption" color={COLORS.warning} style={{ marginTop: 4 }}>
                      {indicator.reason}
                    </Text>
                  ) : null}
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}
