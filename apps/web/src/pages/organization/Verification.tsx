import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { AuthGate, Card, Chip, ChipRow, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { verificationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

/**
 * ORGANIZATION — demandes de vérification et critères atteints.
 *
 * VER-05 : le backend renvoie des **critères cochés**, pas un score. On affiche la
 * liste telle quelle — un pourcentage de confiance masquerait ce qui manque
 * réellement et laisserait croire qu'un dossier incomplet est « presque bon ».
 */
export default function OrganizationVerification() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const mine = useQuery({
    queryKey: queryKeys.verifications.mine,
    queryFn: () => verificationApi.mine().then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const done = mine.data?.criteria.filter((criterion) => criterion.done).length ?? 0;
  const total = mine.data?.criteria.length ?? 0;

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title="Vérification"
        description="Demandes de vérification de votre organisation."
        icon="✅"
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}
          style={{ maxWidth: 720 }}
        >
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Vérification
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
            Chaque critère est un fait vérifiable. Aucun score global n'est calculé : ce qui manque est
            listé, pas pondéré.
          </Text>

          {mine.isLoading ? (
            <LoadingState count={3} height={90} />
          ) : mine.isError ? (
            <ErrorState error={mine.error} onRetry={() => void mine.refetch()} showRequestId />
          ) : !mine.data ? (
            <EmptyState title="Aucune donnée" description="Impossible de charger les critères." icon="✅" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Card tone="white">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                  <Text preset="h3">Critères</Text>
                  <Text preset="caption" color={COLORS.slateGray}>
                    {done} sur {total} atteint(s)
                  </Text>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {mine.data.criteria.map((criterion) => (
                    <div
                      key={criterion.key}
                      style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}
                    >
                      <Text preset="bodySm" color={criterion.done ? COLORS.textPrimary : COLORS.slateGray}>
                        {criterion.label}
                      </Text>
                      <Chip
                        label={criterion.done ? 'atteint' : 'manquant'}
                        tone={criterion.done ? 'success' : 'neutral'}
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              </Card>

              <div>
                <Text preset="h3" style={{ marginBottom: 16 }}>
                  Demandes déposées
                </Text>
                {mine.data.items.length === 0 ? (
                  <EmptyState
                    title="Aucune demande"
                    description="Aucune demande de vérification n'a été déposée pour cette organisation."
                    icon="🛡️"
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {mine.data.items.map((request) => (
                      <Card key={request.id} tone="white">
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                          <div>
                            <Text preset="bodyMd" style={{ fontWeight: 600, marginBottom: 4 }}>
                              {request.subjectType} · niveau {request.level}
                            </Text>
                            <Text preset="caption" color={COLORS.slateGray}>
                              Déposée le {formatDate(request.createdAt, locale)}
                              {request.reviewedAt ? ` · traitée le ${formatDate(request.reviewedAt, locale)}` : ''}
                            </Text>
                            {request.reason ? (
                              <Text preset="caption" color={COLORS.textPrimary} style={{ marginTop: 8, lineHeight: 1.7 }}>
                                Motif : {request.reason}
                              </Text>
                            ) : null}
                          </div>
                          <ChipRow>
                            <Chip
                              label={request.status}
                              tone={
                                request.status === 'APPROVED'
                                  ? 'success'
                                  : request.status === 'REJECTED'
                                    ? 'error'
                                    : 'warning'
                              }
                              size="sm"
                            />
                            {request.documents && request.documents.length > 0 ? (
                              <Chip label={`${request.documents.length} pièce(s)`} tone="neutral" size="sm" />
                            ) : null}
                          </ChipRow>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AuthGate>
    </Section>
  );
}
