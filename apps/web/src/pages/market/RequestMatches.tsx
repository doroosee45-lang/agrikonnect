import { motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { requestApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatDate, formatCurrency } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

/** MARKET — annonces correspondant à une demande d'achat. */
export default function MarketRequestMatches() {
  const { id } = useParams<{ id: string }>();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const { locale } = useI18n();

  const query = useQuery({
    queryKey: queryKeys.requests.matches(id ?? ''),
    queryFn: () => requestApi.matches(id ?? '').then((result) => result.data),
    enabled: isAuthenticated && Boolean(id),
    retry: false,
  });

  const matches = (query.data as unknown as Array<Record<string, unknown>>) ?? [];

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Correspondances" description="Annonces correspondant à cette demande." icon="🔍">
        <div style={{ marginBottom: 24 }}>
          <a href={`/market/requests/${id}`} style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>
            ← Retour à la demande
          </a>
        </div>

        <Text preset="h1" style={{ marginBottom: 32 }}>
          Correspondances
        </Text>

        {query.isLoading ? (
          <LoadingState count={2} height={110} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} showRequestId />
        ) : matches.length === 0 ? (
          <EmptyState title="Aucune correspondance" description="Aucune annonce ne correspond actuellement à cette demande." icon="🔍" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {matches.map((match, index) => (
              <motion.div
                key={String(match.id ?? index)}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 8) * 0.04, ease: EASE.out }}
              >
                <Card tone="white" hover>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                    <div>
                      <Text preset="h4" style={{ marginBottom: 4 }}>
                        {String(match.cropId ?? '—')}
                      </Text>
                      <Text preset="caption">{match.createdAt ? formatDate(String(match.createdAt), locale) : '—'}</Text>
                    </div>
                    <Chip label={String(match.status ?? '—')} tone="neutral" size="sm" />
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {match.quantityKg !== null && match.quantityKg !== undefined ? (
                      <Text preset="bodySm">{String(match.quantityKg)} kg</Text>
                    ) : null}
                    {match.unitPrice !== null && match.unitPrice !== undefined ? (
                      <Text preset="bodySm">{formatCurrency(Number(match.unitPrice), String(match.currency ?? 'USD'))}</Text>
                    ) : null}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </AuthGate>
    </Section>
  );
}
