import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Card, Chip, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { verificationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

/** FARMER — demandes de vérification et leur statut (VERIF-01 → VERIF-06). */
export default function FarmerVerification() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const { locale } = useI18n();

  const query = useQuery({
    queryKey: queryKeys.verifications.mine,
    queryFn: () => verificationApi.mine().then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
  });

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Vérification" description="Demandes de vérification et leur statut." icon="✅">
        <Text preset="h1" style={{ marginBottom: 8 }}>
          Vérification
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
          Une exploitation ou une production vérifiée a fait l'objet d'un contrôle horodaté. Une exploitation déclarée repose sur une saisie.
        </Text>

        {query.isLoading ? (
          <LoadingState count={2} height={110} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} showRequestId />
        ) : !query.data || query.data.items.length === 0 ? (
          <EmptyState title="Aucune demande" description="Aucune demande de vérification n'a été déposée." icon="✅" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {query.data.items.map((request, index) => (
              <motion.div
                key={String(request.id)}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: Math.min(index, 8) * 0.04, ease: EASE.out }}
              >
                <Card tone="white">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                    <div>
                      <Text preset="h4" style={{ marginBottom: 4 }}>
                        {request.subjectType} · {request.subjectId}
                      </Text>
                      <Text preset="caption">{formatDate(request.createdAt, locale)}</Text>
                    </div>
                    <Chip label={request.status} tone={request.status === 'VERIFIED' ? 'success' : request.status === 'REJECTED' ? 'error' : 'warning'} size="sm" />
                  </div>
                  {request.reason ? <Text preset="bodySm" color={COLORS.slateGray}>{request.reason}</Text> : null}
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </AuthGate>
    </Section>
  );
}
