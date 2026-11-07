import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Card, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { geoApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';

/** ADMIN — règles de compatibilité culturales versionnées. */
export default function AdminRules() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const methods = useQuery({
    queryKey: queryKeys.geoEngine.methods,
    queryFn: () => geoApi.methods().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const entries = Object.entries((methods.data ?? {}) as Record<string, unknown>);

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Règles" description="Règles de compatibilité et seuils du moteur." icon="📐">
        <Text preset="h1" style={{ marginBottom: 8 }}>
          Règles et méthodes
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
          Seuils, méthodes et priorité des sources exposés par le moteur géospatial.
        </Text>

        {methods.isLoading ? (
          <LoadingState count={2} height={100} />
        ) : methods.isError ? (
          <ErrorState error={methods.error} onRetry={() => void methods.refetch()} showRequestId />
        ) : entries.length === 0 ? (
          <Card tone="white">
            <Text preset="bodyMd" color={COLORS.slateGray}>
              Le moteur n'expose aucune règle pour le moment.
            </Text>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {entries.map(([key, value], index) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 8) * 0.04, ease: EASE.out }}
              >
                <Card tone="white">
                  <Text preset="h4" color={COLORS.forestGreen} style={{ marginBottom: 8 }}>
                    {key}
                  </Text>
                  <Text preset="bodySm" color={COLORS.textPrimary} style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.7, wordBreak: 'break-word' }}>
                    {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                  </Text>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </AuthGate>
    </Section>
  );
}
