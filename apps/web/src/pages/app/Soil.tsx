import { motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Card, EmptyState, ErrorState, LoadingState, ProvenanceTag, Section, Text } from '@/components/ui';
import { soilApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';
import { StatCard } from '@/design-system';

/** APP — profil de sol fusionné (SOIL-10 → SOIL-13). */
export default function AppSoil() {
  const { plotId } = useParams<{ plotId: string }>();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const { locale } = useI18n();

  const query = useQuery({
    queryKey: queryKeys.soil.profile(plotId ?? ''),
    queryFn: () => soilApi.profile(plotId ?? '').then((result) => result.data),
    enabled: isAuthenticated && Boolean(plotId),
    retry: false,
  });

  const soil = query.data;

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Sol" description="Profil de sol fusionné." icon="🧪">
        <Text preset="h1" style={{ marginBottom: 8 }}>
          Sol
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
          Profil fusionné à partir de vos analyses. Les paramètres manquants sont signalés, jamais estimés.
        </Text>

        {!plotId ? (
          <EmptyState title="Aucune parcelle" description="Sélectionnez une parcelle pour voir son profil de sol." icon="🧪" />
        ) : query.isLoading ? (
          <LoadingState count={2} height={110} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} showRequestId />
        ) : !soil ? (
          <EmptyState title="Aucun profil" description="Aucun profil de sol n'est disponible pour cette parcelle." icon="🧪" />
        ) : (
          <>
            <Card tone="pale" style={{ marginBottom: 24 }}>
              <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
                {soil.disclaimer}
              </Text>
            </Card>

            {soil.missingParameters.length > 0 ? (
              <Card tone="white" style={{ marginBottom: 24 }}>
                <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
                  Paramètres manquants : {soil.missingParameters.join(', ')}. Aucune valeur n'est inventée pour les compléter.
                </Text>
              </Card>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              {Object.entries(soil.fusedProfile).map(([key, parameter], index) => (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 8) * 0.04, ease: EASE.out }}
                >
                  <StatCard
                    label={key}
                    valeur={String(parameter.value ?? '—')}
                    unite={parameter.unit || undefined}
                    pied={(
                      <ProvenanceTag
                        kind={parameter.source === 'declared' ? 'DECLARED' : parameter.source.startsWith('measured') ? 'MEASURED' : 'MODEL'}
                        source={parameter.source}
                        measuredAt={parameter.measuredAt ? formatDate(parameter.measuredAt, locale) : undefined}
                      />
                    )}
                  />
                </motion.div>
              ))}
            </div>
          </>
        )}
      </AuthGate>
    </Section>
  );
}
