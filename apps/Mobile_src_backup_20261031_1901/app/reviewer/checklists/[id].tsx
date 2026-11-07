import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Card, Chip, ErrorState, Input, LoadingState, Screen, Section, Text } from '@/components/ui';
import { verificationApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * Checklist de vérification.
 *
 * Le backend n'expose pas de `GET /verifications/:id` : la fiche est lue dans la
 * file d'arbitrage (`GET /verifications?status=PENDING`) puis filtrée sur l'ID.
 * La décision (APPROVED / REJECTED) passe par `POST /verifications/:id/decide`.
 */
export default function ReviewerChecklist() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);

  const query = useQuery({
    queryKey: queryKeys.verifications.one(id ?? ''),
    queryFn: () => verificationApi.adminQueue({ limit: 100 }).then((r) => r.data),
    enabled: isAuthenticated && Boolean(id),
    retry: false,
  });

  const decide = useMutation({
    mutationFn: (decision: 'APPROVED' | 'REJECTED') => verificationApi.decide(id ?? '', { decision, reason: reason.trim() || undefined }),
    onSuccess: () => { setError(null); setReason(''); void query.refetch(); },
    onError: (caught) => setError(caught),
  });

  const verification = (query.data ?? []).find((item) => item.id === id);

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Checklist de vérification" subtitle="Évaluez la demande." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Checklist" icon="checkmark-done-outline">
          {query.isLoading ? <LoadingState count={1} height={140} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !verification ? <Text preset="body">Vérification introuvable ou déjà traitée.</Text> : (
            <>
              <Card tone="white" style={styles.card}>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Objet</Text>
                  <Text preset="bodyMedium">{verification.subjectType}</Text>
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Niveau demandé</Text>
                  <Text preset="bodySm">{verification.level}</Text>
                </View>
                <View style={styles.field}>
                  <Text preset="caption" color={COLORS.slateGray}>Statut</Text>
                  <Chip label={verification.status} tone={verification.status === 'APPROVED' ? 'success' : 'neutral'} size="sm" />
                </View>
                {verification.documents && verification.documents.length > 0 ? (
                  <View style={styles.field}>
                    <Text preset="caption" color={COLORS.slateGray}>Pièces ({verification.documents.length})</Text>
                    <View style={styles.chips}>
                      {verification.documents.map((doc) => (
                        <Chip key={doc.id} label={`${doc.kind} · ${doc.status}`} tone="neutral" size="sm" />
                      ))}
                    </View>
                  </View>
                ) : null}
              </Card>
              <Card tone="white">
                <View style={styles.form}>
                  <Input label="Motif (optionnel)" value={reason} onChangeText={setReason} multiline />
                  {error ? <ErrorState error={error} /> : null}
                  <View style={styles.actions}>
                    <Button label="Approuver" variant="primary" onPress={() => decide.mutate('APPROVED')} loading={decide.isPending && decide.variables === 'APPROVED'} />
                    <Button label="Rejeter" variant="outline" onPress={() => decide.mutate('REJECTED')} loading={decide.isPending && decide.variables === 'REJECTED'} />
                  </View>
                </View>
              </Card>
            </>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, card: { gap: SPACING.sm }, field: { gap: 4 }, chips: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' }, form: { gap: SPACING.md }, actions: { flexDirection: 'row', gap: SPACING.sm } });
