import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthGate, Button, Card, Chip, ChipRow, EmptyState, ErrorState, LoadingState, Section, Text, TextArea } from '@/components/ui';
import { aiApi, certificationApi, orderApi, verificationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

export default function Reviewer() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [decisionFor, setDecisionFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);

  const queue = useQuery({
    queryKey: queryKeys.verifications.queue({ limit: 30 }),
    queryFn: () => verificationApi.adminQueue({ limit: 30 }).then((result) => result.data.items),
    enabled: isAuthenticated,
  });
  const escalations = useQuery({
    queryKey: queryKeys.ai.list({ status: 'ESCALATED' }),
    queryFn: () => aiApi.list({ status: 'ESCALATED', limit: 20 }).then((result) => result.data),
    enabled: isAuthenticated,
  });
  const disputes = useQuery({
    queryKey: [...queryKeys.orders.all, 'disputes'],
    queryFn: () => orderApi.adminDisputes().then((result) => result.data),
    enabled: isAuthenticated,
  });
  const certifications = useQuery({
    queryKey: queryKeys.certifications.all,
    queryFn: () => certificationApi.list({ limit: 30 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  const decide = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      verificationApi.decide(id, { status, reason: reason.trim() || undefined }),
    onSuccess: () => {
      setError(null);
      setReason('');
      setDecisionFor(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.verifications.queue({ limit: 30 }) });
    },
    onError: (caught) => setError(caught),
  });

  const moderateCert = useMutation({
    mutationFn: (id: string) => certificationApi.verify(id, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.certifications.all }),
    onError: (caught) => setError(caught),
  });

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title="Accès vérificateur"
        description="Connectez-vous avec un rôle vérificateur ou administrateur pour instruire les demandes."
        icon="🛡️"
      >
        <div style={{ marginBottom: 32 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Vérification
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray}>
            File de contrôle, escalades IA, litiges et certifications.
          </Text>
        </div>

        <Card tone="pale" style={{ marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 20 }}>🛡️</span>
          <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
            Chaque décision est tracée : auteur, date, motif. Un refus doit être motivé pour être notifié à
            l'organisation concernée. Aucune validation automatique n'est possible.
          </Text>
        </Card>

        {error ? (
          <div style={{ marginBottom: 24 }}>
            <ErrorState error={error} showRequestId />
          </div>
        ) : null}

        <Text preset="h3" style={{ marginBottom: 16 }}>
          File de vérification
        </Text>
        {queue.isLoading ? (
          <LoadingState count={2} height={100} />
        ) : queue.isError ? (
          <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />
        ) : (queue.data ?? []).length === 0 ? (
          <EmptyState title="File vide" description="Aucune demande de vérification en attente." icon="✅" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            {(queue.data ?? []).map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: index * 0.03, ease: EASE.out }}
              >
                <Card tone="white">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 8 }}>
                    <div>
                      <Text preset="bodyMd" color={COLORS.textPrimary} style={{ fontWeight: 600 }}>
                        {item.subjectType} · niveau {item.level}
                      </Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        demandée le {formatDate(item.createdAt, locale)} · organisation {item.organizationId}
                      </Text>
                    </div>
                    <Chip
                      label={item.status}
                      tone={item.status === 'APPROVED' ? 'success' : item.status === 'REJECTED' ? 'error' : 'warning'}
                      size="sm"
                    />
                  </div>

                  {item.reason ? (
                    <Text preset="caption" color={COLORS.slateGray} style={{ lineHeight: 1.6, marginBottom: 8 }}>
                      Motif : {item.reason}
                    </Text>
                  ) : null}

                  {(item.documents ?? []).length > 0 ? (
                    <ChipRow style={{ marginBottom: 12 }}>
                      {(item.documents ?? []).map((document) => (
                        <Chip key={document.id} label={`${document.kind} · ${document.status}`} tone="neutral" size="sm" />
                      ))}
                    </ChipRow>
                  ) : null}

                  {item.status === 'PENDING' ? (
                    decisionFor === item.id ? (
                      <div>
                        <TextArea
                          label="Motif de la décision"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Pièces conformes / manquantes…"
                          minHeight={70}
                          optionalLabel="recommandé"
                        />
                        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                          <Button label="Approuver" onClick={() => decide.mutate({ id: item.id, status: 'APPROVED' })} loading={decide.isPending} />
                          <Button label="Rejeter" onClick={() => decide.mutate({ id: item.id, status: 'REJECTED' })} variant="ghost" loading={decide.isPending} />
                        </div>
                      </div>
                    ) : (
                      <Button label="Instruire" onClick={() => setDecisionFor(item.id)} variant="outline" size="sm" />
                    )
                  ) : null}
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        <Text preset="h3" style={{ marginBottom: 16 }}>
          Analyses IA escaladées
        </Text>
        {escalations.isLoading ? (
          <LoadingState count={1} height={90} />
        ) : escalations.isError ? (
          <ErrorState error={escalations.error} onRetry={() => void escalations.refetch()} />
        ) : (escalations.data ?? []).length === 0 ? (
          <EmptyState title="Aucune escalade" description="Les analyses IA envoyées vers un humain apparaissent ici." icon="✨" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            {(escalations.data ?? []).map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: index * 0.03, ease: EASE.out }}
              >
                <Card tone="white">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div>
                      <Text preset="bodyMd" color={COLORS.textPrimary} style={{ fontWeight: 600 }}>
                        {item.prompt ?? `Analyse ${item.type}`}
                      </Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {item.type} · {formatDate(item.createdAt, locale)}
                        {item.escalatedAt ? ` · escaladée le ${formatDate(item.escalatedAt, locale)}` : ''}
                      </Text>
                    </div>
                    <Chip label={item.status} tone="info" size="sm" />
                  </div>
                  {item.disclaimer ? (
                    <Text preset="caption" color={COLORS.warning} style={{ marginTop: 8, lineHeight: 1.6 }}>
                      {item.disclaimer}
                    </Text>
                  ) : null}
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        <Text preset="h3" style={{ marginBottom: 16 }}>
          Litiges
        </Text>
        {disputes.isLoading ? (
          <LoadingState count={1} height={90} />
        ) : disputes.isError ? (
          <ErrorState error={disputes.error} onRetry={() => void disputes.refetch()} />
        ) : (disputes.data ?? []).length === 0 ? (
          <EmptyState title="Aucun litige" description="Les litiges ouverts sur les commandes arrivent ici." icon="⚠️" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            {(disputes.data ?? []).map((dispute, index) => (
              <motion.div
                key={dispute.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: index * 0.03, ease: EASE.out }}
              >
                <Card tone="white" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <Text preset="bodyMd" color={COLORS.textPrimary} style={{ fontWeight: 600 }}>
                      Commande {dispute.orderId}
                    </Text>
                    <Text preset="caption" color={COLORS.slateGray}>
                      ouvert le {formatDate(dispute.createdAt, locale)} · {dispute.reason}
                    </Text>
                  </div>
                  <Chip label={dispute.status} tone={dispute.status === 'RESOLVED' ? 'success' : 'error'} size="sm" />
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        <Text preset="h3" style={{ marginBottom: 16 }}>
          Certifications à contrôler
        </Text>
        {certifications.isLoading ? (
          <LoadingState count={1} height={90} />
        ) : certifications.isError ? (
          <ErrorState error={certifications.error} onRetry={() => void certifications.refetch()} />
        ) : (certifications.data ?? []).length === 0 ? (
          <EmptyState title="Aucune certification" description="Les certifications déclarées apparaîtront ici pour contrôle documentaire." icon="🏅" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(certifications.data ?? []).map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: index * 0.03, ease: EASE.out }}
              >
                <Card tone="white" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <Text preset="bodyMd" color={COLORS.textPrimary} style={{ fontWeight: 600 }}>
                      {item.type} · {item.issuer}
                    </Text>
                    <Text preset="caption" color={COLORS.slateGray}>
                      {item.reference ? `réf. ${item.reference} · ` : ''}
                      {item.expiresAt ? `expire le ${formatDate(item.expiresAt, locale)}` : 'sans échéance'}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <Chip label={item.status === 'VERIFIED' ? 'Vérifiée' : 'Déclarée'} tone={item.status === 'VERIFIED' ? 'success' : 'warning'} size="sm" />
                    {item.status !== 'VERIFIED' ? (
                      <Button
                        label="Marquer vérifiée"
                        onClick={() => moderateCert.mutate(item.id)}
                        variant="outline"
                        size="sm"
                        loading={moderateCert.isPending && moderateCert.variables === item.id}
                      />
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
