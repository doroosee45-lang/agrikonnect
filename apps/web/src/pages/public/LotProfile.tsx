import { motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Card, Chip, ChipRow, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { publicApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

/** PUBLIC — fiche de lot scannée par QR (TRC-03). Jamais une certification. */
export default function PublicLotProfile() {
  const { code } = useParams<{ code: string }>();
  const { locale } = useI18n();

  const lot = useQuery({
    queryKey: queryKeys.public.lot(code ?? ''),
    queryFn: () => publicApi.lot(code ?? '').then((result) => result.data),
    enabled: Boolean(code),
    retry: false,
  });

  const data = lot.data;

  return (
    <Section>
      <Text preset="overline" color={COLORS.forestGreen} style={{ marginBottom: 12 }}>
        Traçabilité
      </Text>
      <Text preset="h1" style={{ marginBottom: 8 }}>
        Lot {code}
      </Text>

      {lot.isLoading ? (
        <LoadingState count={2} height={140} />
      ) : lot.isError ? (
        <ErrorState error={lot.error} onRetry={() => void lot.refetch()} showRequestId />
      ) : !data ? (
        <EmptyState title="Lot introuvable" description="Ce code ne correspond à aucun lot publié." icon="📦" />
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}>
          <Card tone="pale" style={{ marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
              {data.verification.note}
            </Text>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            <Card tone="white">
              <Text preset="h3" style={{ marginBottom: 16 }}>
                Identification
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <Text preset="caption" color={COLORS.slateGray}>
                    Code
                  </Text>
                  <Text preset="bodyMd" color={COLORS.textPrimary} style={{ fontFamily: 'monospace' }}>
                    {data.code}
                  </Text>
                </div>
                <div>
                  <Text preset="caption" color={COLORS.slateGray}>
                    Statut
                  </Text>
                  <Chip label={data.status} tone={data.status === 'PUBLISHED' ? 'success' : 'neutral'} size="sm" />
                </div>
                {data.crop ? (
                  <div>
                    <Text preset="caption" color={COLORS.slateGray}>
                      Culture
                    </Text>
                    <Text preset="bodyMd" color={COLORS.textPrimary}>
                      {data.crop.name}
                    </Text>
                  </div>
                ) : null}
                <div>
                  <Text preset="caption" color={COLORS.slateGray}>
                    Créé le
                  </Text>
                  <Text preset="bodyMd" color={COLORS.textPrimary}>
                    {formatDate(data.createdAt, locale)}
                  </Text>
                </div>
              </div>
            </Card>

            <Card tone="white">
              <Text preset="h3" style={{ marginBottom: 16 }}>
                Chronologie
              </Text>
              {data.timeline.length === 0 ? (
                <Text preset="caption" color={COLORS.slateGray}>
                  Aucun événement enregistré.
                </Text>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {data.timeline.map((event, index) => (
                    <motion.div
                      key={`${event.type}-${event.at}`}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 8) * 0.05, ease: EASE.out }}
                      style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}
                    >
                      <Chip label={event.type} tone="forest" size="sm" />
                      <Text preset="caption" color={COLORS.slateGray}>
                        {formatDate(event.at, locale)}
                      </Text>
                    </motion.div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {data.disclosure.hiddenFields.length > 0 ? (
            <Card tone="white" style={{ marginTop: 20 }}>
              <Text preset="h4" color={COLORS.forestGreen} style={{ marginBottom: 8 }}>
                Champs masqués
              </Text>
              <Text preset="caption" color={COLORS.slateGray} style={{ lineHeight: 1.7, marginBottom: 12 }}>
                {data.disclosure.rule}
              </Text>
              <ChipRow>
                {data.disclosure.hiddenFields.map((field) => (
                  <Chip key={field} label={field} tone="neutral" size="sm" />
                ))}
              </ChipRow>
            </Card>
          ) : null}
        </motion.div>
      )}
    </Section>
  );
}
