import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Card, Chip, ChipRow, EmptyState, ErrorState, Input, LoadingState, Section, Text } from '@/components/ui';
import { insightsApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

export default function Insights() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [countryCode, setCountryCode] = useState('CD');

  const overview = useQuery({
    queryKey: queryKeys.insights.overview({ countryCode }),
    queryFn: () => insightsApi.overview({ countryCode }).then((result) => result.data),
    enabled: isAuthenticated && countryCode.length === 2,
  });

  const crops = useQuery({
    queryKey: queryKeys.insights.crops({ countryCode }),
    queryFn: () => insightsApi.crops({ countryCode }).then((result) => result.data),
    enabled: isAuthenticated && countryCode.length === 2,
  });

  const policy = useQuery({
    queryKey: queryKeys.insights.disclosure,
    queryFn: () => insightsApi.disclosurePolicy().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const indicators = overview.data?.indicators ?? {};

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title="Données de marché"
        description="Connectez-vous pour consulter les indicateurs agrégés par pays."
        icon="📊"
      >
        <div style={{ marginBottom: 32 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Données de marché
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray}>
            Indicateurs agrégés avec seuil de k-anonymat : aucune donnée personnelle n'est révélée.
          </Text>
        </div>

        <div style={{ maxWidth: 240, marginBottom: 32 }}>
          <Input
            label="Code pays (ISO 3166-1 alpha-2)"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
            maxLength={2}
            placeholder="CD"
          />
        </div>

        {policy.data ? (
          <Card tone="pale" style={{ marginBottom: 32, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 20 }}>🔒</span>
            <div>
              <Text preset="bodySm" color={COLORS.textPrimary} style={{ fontWeight: 600, marginBottom: 4 }}>
                Politique de divulgation — seuil minimal : {policy.data.minGroupSize}
              </Text>
              <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
                {policy.data.rules.join(' · ')}
              </Text>
            </div>
          </Card>
        ) : null}

        <Text preset="h3" style={{ marginBottom: 16 }}>
          Indicateurs
        </Text>
        {overview.isLoading ? (
          <LoadingState count={2} height={100} />
        ) : overview.isError ? (
          <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
        ) : Object.keys(indicators).length === 0 ? (
          <EmptyState title="Aucun indicateur" description="Aucune donnée agrégée disponible pour ce pays." icon="📊" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 40 }}>
            {Object.entries(indicators).map(([key, indicator], index) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: index * 0.04, ease: EASE.out }}
              >
                <Card tone="white" hover>
                  <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 8 }}>
                    {key}
                  </Text>
                  {indicator.value === null ? (
                    <Text preset="bodyMd" color={COLORS.warning}>
                      Masqué
                    </Text>
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
        )}

        <Text preset="h3" style={{ marginBottom: 16 }}>
          Cultures
        </Text>
        {crops.isLoading ? (
          <LoadingState count={2} height={80} />
        ) : crops.isError ? (
          <ErrorState error={crops.error} onRetry={() => void crops.refetch()} />
        ) : (crops.data?.crops ?? []).length === 0 ? (
          <EmptyState title="Aucune culture" description="Aucune culture agrégée pour ce pays." icon="🌾" />
        ) : (
          <Card tone="white">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(crops.data?.crops ?? []).map((crop) => (
                <div
                  key={crop.crop.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                    padding: '12px 0',
                    borderBottom: `1px solid ${COLORS.lightBorder}`,
                  }}
                >
                  <div>
                    <Text preset="bodyMd" color={COLORS.textPrimary} style={{ fontWeight: 600 }}>
                      {crop.crop.names?.fr ?? crop.crop.names?.en ?? crop.crop.slug ?? 'Culture'}
                    </Text>
                    <Text preset="caption" color={COLORS.slateGray}>
                      {crop.organizations} organisations · {crop.source} · {crop.method}
                    </Text>
                  </div>
                  <Text preset="bodyMd" color={COLORS.forestGreen} style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {formatNumber(crop.volumeKg, locale)} kg
                  </Text>
                </div>
              ))}
            </div>
            {crops.data?.suppressed ? (
              <Text preset="caption" color={COLORS.warning} style={{ marginTop: 16 }}>
                {crops.data.suppressedNote}
              </Text>
            ) : null}
          </Card>
        )}
      </AuthGate>
    </Section>
  );
}
