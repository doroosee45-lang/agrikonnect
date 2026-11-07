import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  ProvenanceTag,
  Reveal,
  Screen,
  Section,
  TextArea,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatCurrency, formatDate } from '@/lib/format';
import { orderApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

const NEXT_STATUS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PAID', 'CANCELLED'],
  PAID: ['SHIPPED', 'DISPUTED'],
  SHIPPED: ['DELIVERED', 'DISPUTED'],
  DELIVERED: ['COMPLETED', 'DISPUTED'],
  COMPLETED: [],
  CANCELLED: [],
  DISPUTED: ['CONFIRMED'],
};

/** Détail commande : transitions, paiement, litige et journal d'événements. */
export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [error, setError] = useState<unknown>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [paymentRef, setPaymentRef] = useState('');

  const order = useQuery({
    queryKey: queryKeys.orders.one(id),
    queryFn: () => orderApi.get(id).then((result) => result.data),
    enabled: isAuthenticated && Boolean(id),
  });
  const events = useQuery({
    queryKey: [...queryKeys.orders.one(id), 'events'],
    queryFn: () => orderApi.events(id).then((result) => result.data),
    enabled: isAuthenticated && Boolean(id),
  });

  const setStatus = useMutation({
    mutationFn: (status: string) => orderApi.setStatus(id, status),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.one(id) });
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.orders.one(id), 'events'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
    onError: (caught) => setError(caught),
  });

  const setPayment = useMutation({
    mutationFn: () => orderApi.setPayment(id, { paymentStatus: 'PAID', reference: paymentRef.trim() || undefined }),
    onSuccess: () => {
      setError(null);
      setPaymentRef('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.one(id) });
    },
    onError: (caught) => setError(caught),
  });

  const openDispute = useMutation({
    mutationFn: () => orderApi.dispute(id, { reason: disputeReason.trim() }),
    onSuccess: () => {
      setError(null);
      setDisputeReason('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.one(id) });
    },
    onError: (caught) => setError(caught),
  });

  const data = order.data;
  const snapshot = (data?.snapshot ?? {}) as Record<string, unknown>;

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={data?.number ?? 'Commande'} subtitle="Transitions validées côté serveur, journal complet." />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title="Connexion requise"
          description="Connectez-vous pour suivre cette commande."
          icon="receipt-outline"
        >
          {order.isLoading ? (
            <LoadingState count={2} height={130} />
          ) : order.isError || !data ? (
            <ErrorState error={order.error} onRetry={() => void order.refetch()} />
          ) : (
            <>
              <Card tone="white" style={styles.card}>
                <View style={styles.chips}>
                  <Chip label={data.status} tone="info" size="sm" />
                  <Chip label={data.paymentStatus} tone={data.paymentStatus === 'PAID' ? 'success' : 'warning'} size="sm" />
                  <ProvenanceTag kind="verified" />
                </View>

                <View style={styles.facts}>
                  <View style={styles.fact}>
                    <Text preset="caption" color={COLORS.slateGray}>
                      Montant
                    </Text>
                    <Text preset="bodyMedium" color={COLORS.textPrimary}>
                      {data.totalAmount !== null ? formatCurrency(data.totalAmount, data.currency, locale) : 'à confirmer'}
                    </Text>
                  </View>
                  <View style={styles.fact}>
                    <Text preset="caption" color={COLORS.slateGray}>
                      Passée le
                    </Text>
                    <Text preset="bodyMedium" color={COLORS.textPrimary}>
                      {formatDate(data.createdAt, locale)}
                    </Text>
                  </View>
                  <View style={styles.fact}>
                    <Text preset="caption" color={COLORS.slateGray}>
                      Mise à jour
                    </Text>
                    <Text preset="bodyMedium" color={COLORS.textPrimary}>
                      {formatDate(data.updatedAt, locale)}
                    </Text>
                  </View>
                </View>

                <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                  Instantané figé à la commande : {Object.keys(snapshot).length > 0 ? Object.keys(snapshot).join(', ') : 'aucun champ supplémentaire'}.
                  Les prix et quantités ne varient plus après validation.
                </Text>
              </Card>

              <Card tone="white" style={styles.card}>
                <Text preset="overline" color={COLORS.forestGreen}>
                  Faire avancer la commande
                </Text>
                {error ? <ErrorState error={error} showRequestId /> : null}
                {(NEXT_STATUS[data.status] ?? []).length === 0 ? (
                  <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                    Cette commande est close : aucune transition supplémentaire n’est possible.
                  </Text>
                ) : (
                  <View style={styles.actions}>
                    {(NEXT_STATUS[data.status] ?? []).map((status) => (
                      <Button
                        key={status}
                        label={status}
                        onPress={() => setStatus.mutate(status)}
                        variant={status === 'CANCELLED' || status === 'DISPUTED' ? 'ghost' : 'primary'}
                        size="sm"
                        loading={setStatus.isPending && setStatus.variables === status}
                      />
                    ))}
                  </View>
                )}
              </Card>

              <Card tone="white" style={styles.card}>
                <Text preset="overline" color={COLORS.forestGreen}>
                  Paiement
                </Text>
                <Input label="Référence de paiement" value={paymentRef} onChangeText={setPaymentRef} placeholder="Mobile Money / virement" icon="card-outline" optionalLabel="facultatif" />
                <Button
                  label="Marquer comme payé"
                  onPress={() => setPayment.mutate()}
                  variant="outline"
                  size="sm"
                  icon="checkmark-circle-outline"
                  loading={setPayment.isPending}
                  disabled={data.paymentStatus === 'PAID'}
                />
              </Card>

              <Card tone="white" style={styles.card}>
                <Text preset="overline" color={COLORS.forestGreen}>
                  Ouvrir un litige
                </Text>
                <TextArea label="Motif" value={disputeReason} onChangeText={setDisputeReason} placeholder="Quantité non conforme, retard de livraison…" minHeight={80} />
                <Button
                  label="Ouvrir le litige"
                  onPress={() => openDispute.mutate()}
                  variant="ghost"
                  size="sm"
                  icon="alert-circle-outline"
                  loading={openDispute.isPending}
                  disabled={disputeReason.trim().length < 5}
                />
                <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                  Un litige gèle la commande et alerte la modération : aucune décision automatique n’est prise.
                </Text>
              </Card>

              <Text preset="overline" color={COLORS.forestGreen}>
                Journal
              </Text>
              {events.isLoading ? (
                <LoadingState count={2} height={70} />
              ) : events.isError ? (
                <ErrorState error={events.error} onRetry={() => void events.refetch()} />
              ) : (events.data ?? []).length === 0 ? (
                <EmptyState title="Aucun événement" description="Chaque transition alimente ce journal." icon="time-outline" />
              ) : (
                <View style={styles.timeline}>
                  {(events.data ?? []).map((event, index) => (
                    <Reveal key={event.id} index={index} variant="up">
                      <View style={styles.eventRow}>
                        <View style={[styles.dot, index === 0 ? styles.dotActive : null]} />
                        <View style={styles.eventBody}>
                          <Text preset="bodySm" color={COLORS.textPrimary}>
                            {event.from ? `${event.from} → ` : ''}
                            {event.to}
                          </Text>
                          <Text preset="caption" color={COLORS.slateGray}>
                            {formatDate(event.at, locale)}
                            {event.reason ? ` · ${event.reason}` : ''}
                          </Text>
                        </View>
                      </View>
                    </Reveal>
                  ))}
                </View>
              )}
            </>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  lineHeight: { lineHeight: 18 },
  card: { gap: SPACING.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.lg },
  fact: { minWidth: 140, gap: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  timeline: { gap: SPACING.md },
  eventRow: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: RADIUS.pill, backgroundColor: COLORS.lightBorder, marginTop: 6 },
  dotActive: { backgroundColor: COLORS.livingGreen },
  eventBody: { flex: 1, gap: 2 },
});
