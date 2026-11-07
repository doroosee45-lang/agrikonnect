import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  ErrorState,
  LoadingState,
  Reveal,
  Screen,
  Section,
  TextArea,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate, formatNumber } from '@/lib/format';
import { aiApi, certificationApi, orderApi, verificationApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** Espace vérificateur : file de vérification, escalades IA, litiges, certifications. */
export default function Reviewer() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [decisionFor, setDecisionFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);

  const queue = useQuery({
    queryKey: queryKeys.verifications.queue({ limit: 30 }),
    queryFn: () => verificationApi.adminQueue({ limit: 30 }).then((result) => result.data),
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
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Vérification" subtitle="File de contrôle, escalades IA, litiges et certifications." />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title="Accès vérificateur"
          description="Connectez-vous avec un rôle vérificateur ou administrateur pour instruire les demandes."
          icon="shield-checkmark-outline"
        >
          <Card tone="pale" style={styles.note}>
            <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.info} />
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
              Chaque décision est tracée : auteur, date, motif. Un refus doit être motivé pour être notifié à
              l’organisation concernée. Aucune validation automatique n’est possible.
            </Text>
          </Card>

          {error ? <ErrorState error={error} showRequestId /> : null}

          <Text preset="overline" color={COLORS.forestGreen}>
            File de vérification
          </Text>
          {queue.isLoading ? (
            <LoadingState count={2} height={100} />
          ) : queue.isError ? (
            <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />
          ) : (queue.data ?? []).length === 0 ? (
            <EmptyState title="File vide" description="Aucune demande de vérification en attente." icon="checkmark-done-outline" />
          ) : (
            <View style={styles.list}>
              {(queue.data ?? []).map((item, index) => (
                <Reveal key={item.id} index={index} variant="up">
                  <Card tone="white" style={styles.card}>
                    <View style={styles.head}>
                      <View style={styles.headText}>
                        <Text preset="bodyMedium" color={COLORS.textPrimary}>
                          {item.subjectType} · niveau {item.level}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          demandée le {formatDate(item.createdAt, locale)} · organisation {item.organizationId}
                        </Text>
                      </View>
                      <Chip
                        label={item.status}
                        tone={item.status === 'APPROVED' ? 'success' : item.status === 'REJECTED' ? 'error' : 'warning'}
                        size="sm"
                      />
                    </View>

                    {item.reason ? (
                      <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                        Motif : {item.reason}
                      </Text>
                    ) : null}

                    {(item.documents ?? []).length > 0 ? (
                      <ChipRow>
                        {(item.documents ?? []).map((document) => (
                          <Chip key={document.id} label={`${document.kind} · ${document.status}`} tone="neutral" size="sm" />
                        ))}
                      </ChipRow>
                    ) : null}

                    {item.status === 'PENDING' ? (
                      decisionFor === item.id ? (
                        <View style={styles.decision}>
                          <TextArea label="Motif de la décision" value={reason} onChangeText={setReason} placeholder="Pièces conformes / manquantes…" minHeight={70} optionalLabel="recommandé" />
                          <View style={styles.actions}>
                            <Button label="Approuver" onPress={() => decide.mutate({ id: item.id, status: 'APPROVED' })} variant="primary" size="sm" icon="checkmark-outline" loading={decide.isPending} />
                            <Button label="Rejeter" onPress={() => decide.mutate({ id: item.id, status: 'REJECTED' })} variant="ghost" size="sm" icon="close-outline" loading={decide.isPending} />
                          </View>
                        </View>
                      ) : (
                        <Button label="Instruire" onPress={() => setDecisionFor(item.id)} variant="outline" size="sm" icon="document-text-outline" />
                      )
                    ) : null}
                  </Card>
                </Reveal>
              ))}
            </View>
          )}

          <Text preset="overline" color={COLORS.forestGreen}>
            Analyses IA escaladées
          </Text>
          {escalations.isLoading ? (
            <LoadingState count={1} height={90} />
          ) : escalations.isError ? (
            <ErrorState error={escalations.error} onRetry={() => void escalations.refetch()} />
          ) : (escalations.data ?? []).length === 0 ? (
            <EmptyState title="Aucune escalade" description="Les analyses IA envoyées vers un humain apparaissent ici." icon="sparkles-outline" />
          ) : (
            <View style={styles.list}>
              {(escalations.data ?? []).map((item, index) => (
                <Reveal key={item.id} index={index} variant="up">
                  <Card tone="white" style={styles.card}>
                    <View style={styles.head}>
                      <View style={styles.headText}>
                        <Text preset="bodyMedium" color={COLORS.textPrimary} numberOfLines={2}>
                          {item.prompt ?? `Analyse ${item.type}`}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          {item.type} · {formatDate(item.createdAt, locale)}
                          {item.escalatedAt ? ` · escaladée le ${formatDate(item.escalatedAt, locale)}` : ''}
                        </Text>
                      </View>
                      <Chip label={item.status} tone="info" size="sm" />
                    </View>
                    {item.disclaimer ? (
                      <Text preset="caption" color={COLORS.warning} style={styles.lineHeight}>
                        {item.disclaimer}
                      </Text>
                    ) : null}
                  </Card>
                </Reveal>
              ))}
            </View>
          )}

          <Text preset="overline" color={COLORS.forestGreen}>
            Litiges
          </Text>
          {disputes.isLoading ? (
            <LoadingState count={1} height={90} />
          ) : disputes.isError ? (
            <ErrorState error={disputes.error} onRetry={() => void disputes.refetch()} />
          ) : (disputes.data ?? []).length === 0 ? (
            <EmptyState title="Aucun litige" description="Les litiges ouverts sur les commandes arrivent ici." icon="alert-circle-outline" />
          ) : (
            <View style={styles.list}>
              {(disputes.data ?? []).map((dispute, index) => (
                <Reveal key={dispute.id} index={index} variant="up">
                  <Card tone="white" style={styles.card}>
                    <View style={styles.head}>
                      <View style={styles.headText}>
                        <Text preset="bodyMedium" color={COLORS.textPrimary}>
                          Commande {dispute.orderId}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          ouvert le {formatDate(dispute.createdAt, locale)} · {dispute.reason}
                        </Text>
                      </View>
                      <Chip label={dispute.status} tone={dispute.status === 'RESOLVED' ? 'success' : 'error'} size="sm" />
                    </View>
                    {dispute.decision ? (
                      <Text preset="caption" color={COLORS.slateGray}>
                        Décision : {dispute.decision}
                        {dispute.decidedAt ? ` · ${formatDate(dispute.decidedAt, locale)}` : ''}
                      </Text>
                    ) : null}
                  </Card>
                </Reveal>
              ))}
            </View>
          )}

          <Text preset="overline" color={COLORS.forestGreen}>
            Certifications à contrôler
          </Text>
          {certifications.isLoading ? (
            <LoadingState count={1} height={90} />
          ) : certifications.isError ? (
            <ErrorState error={certifications.error} onRetry={() => void certifications.refetch()} />
          ) : (certifications.data ?? []).length === 0 ? (
            <EmptyState title="Aucune certification" description="Les certifications déclarées apparaîtront ici pour contrôle documentaire." icon="ribbon-outline" />
          ) : (
            <View style={styles.list}>
              {(certifications.data ?? []).map((item, index) => (
                <Reveal key={item.id} index={index} variant="up">
                  <Card tone="white" style={styles.card}>
                    <View style={styles.head}>
                      <View style={styles.headText}>
                        <Text preset="bodyMedium" color={COLORS.textPrimary}>
                          {item.type} · {item.issuer}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          {item.reference ? `réf. ${item.reference} · ` : ''}
                          {item.expiresAt ? `expire le ${formatDate(item.expiresAt, locale)}` : 'sans échéance'}
                        </Text>
                      </View>
                      <Chip label={item.status === 'VERIFIED' ? 'Vérifiée' : 'Déclarée'} tone={item.status === 'VERIFIED' ? 'success' : 'warning'} size="sm" />
                    </View>
                    {item.status !== 'VERIFIED' ? (
                      <Button
                        label="Marquer comme vérifiée"
                        onPress={() => moderateCert.mutate(item.id)}
                        variant="outline"
                        size="sm"
                        icon="shield-checkmark-outline"
                        loading={moderateCert.isPending && moderateCert.variables === item.id}
                      />
                    ) : null}
                  </Card>
                </Reveal>
              ))}
            </View>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  lineHeight: { lineHeight: 18 },
  note: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  card: { gap: SPACING.md },
  head: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  headText: { flex: 1, gap: 2 },
  decision: { gap: SPACING.sm },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  list: { gap: SPACING.sm },
});
