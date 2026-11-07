import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { orderApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

/** FARMER — litiges sur commandes (ORD-08 → ORD-12). */
export default function FarmerConflictResolution() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const { locale } = useI18n();

  const query = useQuery({
    queryKey: queryKeys.orders.list({ limit: 100 }),
    queryFn: () => orderApi.list({ limit: 100 }).then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const disputed = query.data?.filter((order) => order.status === 'DISPUTED') ?? [];

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Litiges" description="Litiges ouverts sur vos commandes." icon="⚖️">
        <Text preset="h1" style={{ marginBottom: 8 }}>
          Litiges
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
          Un litige bloque le paiement jusqu'à résolution. Chaque étape est horodatée.
        </Text>

        {query.isLoading ? (
          <LoadingState count={2} height={110} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} showRequestId />
        ) : disputed.length === 0 ? (
          <EmptyState title="Aucun litige" description="Aucun litige n'est ouvert sur vos commandes." icon="⚖️" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {disputed.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 8) * 0.04, ease: EASE.out }}
              >
                <Card tone="white">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                    <div>
                      <Text preset="h4" style={{ marginBottom: 4 }}>
                        {order.number}
                      </Text>
                      <Text preset="caption">{formatDate(order.createdAt, locale)}</Text>
                    </div>
                    <Chip label={order.status} tone="error" size="sm" />
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
