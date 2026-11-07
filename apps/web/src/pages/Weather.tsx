import { motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Card, Chip, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { weatherApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

/** Météo par parcelle (WTH-01 → WTH-05), fraîcheur et confiance affichées. */
export default function Weather() {
  const { plotId } = useParams<{ plotId: string }>();
  const { locale } = useI18n();

  const query = useQuery({
    queryKey: [...queryKeys.weather.forPlot(plotId ?? '', {})] as unknown[],
    queryFn: () => weatherApi.forPlot(plotId ?? '', {}).then((result) => result.data),
    enabled: Boolean(plotId),
    retry: false,
  });

  const weather = query.data;

  return (
    <Section>
      <Text preset="h1" style={{ marginBottom: 8 }}>
        Météo
      </Text>
      <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
        Prévisions météorologiques pour vos parcelles. La fraîcheur des données est affichée explicitement.
      </Text>

      {!plotId ? (
        <EmptyState title="Aucune parcelle" description="Sélectionnez une parcelle pour voir sa météo." icon="🌤️" />
      ) : query.isLoading ? (
        <LoadingState count={2} height={110} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} showRequestId />
      ) : !weather || !weather.available ? (
        <EmptyState title="Aucune donnée" description={weather?.message ?? 'Aucune donnée météo n\'est disponible.'} icon="🌤️" />
      ) : (
        <>
          {weather.freshness ? (
            <Card tone={weather.freshness.stale ? 'pale' : 'white'} style={{ marginBottom: 24 }}>
              <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
                Fraîcheur : {weather.freshness.ageHours.toFixed(1)} heure(s){weather.freshness.stale ? ' · données périmées' : ''}
                {weather.freshness.warning ? ` · ${weather.freshness.warning}` : ''}
              </Text>
            </Card>
          ) : null}

          {weather.latest ? (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}>
              <Card tone="white" style={{ marginBottom: 24 }}>
                <Text preset="h3" style={{ marginBottom: 12 }}>
                  Dernière observation
                </Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Text preset="bodySm">Observée le : {formatDate(weather.latest.observedAt, locale)}</Text>
                  <Text preset="bodySm">Source : {weather.latest.source}</Text>
                  {weather.latest.confidence ? <Chip label={`Confiance ${weather.latest.confidence}`} tone="neutral" size="sm" /> : null}
                </div>
              </Card>
            </motion.div>
          ) : null}

          {weather.actionSuggestion ? (
            <Card tone="pale" style={{ marginBottom: 24 }}>
              <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
                Suggestion : {weather.actionSuggestion}
              </Text>
            </Card>
          ) : null}

          {weather.records && weather.records.length > 0 ? (
            <Card tone="white">
              <Text preset="h3" style={{ marginBottom: 16 }}>
                Historique
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {weather.records.map((record, index) => (
                  <motion.div
                    key={record.id}
                    initial={{ opacity: 0, x: -12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: DURATION.fast / 1000, delay: Math.min(index, 12) * 0.02, ease: EASE.out }}
                    style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}
                  >
                    <Text preset="caption" style={{ minWidth: 96 }}>
                      {formatDate(record.observedAt, locale)}
                    </Text>
                    <Chip label={record.source} tone="neutral" size="sm" />
                    {record.confidence ? <Chip label={record.confidence} tone="neutral" size="sm" /> : null}
                  </motion.div>
                ))}
              </div>
            </Card>
          ) : null}
        </>
      )}
    </Section>
  );
}
