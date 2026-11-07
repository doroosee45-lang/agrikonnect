import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PressableCard,
  Reveal,
  Screen,
  Section,
  TextArea,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { DURATION } from '@/theme/motion';
import { requestApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** Détail d'une demande : correspondances réelles et dépôt d'offre. */
export default function RequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [offering, setOffering] = useState(false);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [conditions, setConditions] = useState('');
  const [error, setError] = useState<unknown>(null);

  const request = useQuery({
    queryKey: queryKeys.requests.one(id),
    queryFn: () => requestApi.get(id).then((result) => result.data),
    enabled: isAuthenticated && Boolean(id),
  });
  const matches = useQuery({
    queryKey: queryKeys.requests.matches(id),
    queryFn: () => requestApi.matches(id).then((result) => result.data),
    enabled: isAuthenticated && Boolean(id),
  });
  const offers = useQuery({
    queryKey: queryKeys.requests.offers(id),
    queryFn: () => requestApi.offers(id).then((result) => result.data),
    enabled: isAuthenticated && Boolean(id),
  });

  const submit = useMutation({
    mutationFn: () =>
      requestApi.submitOffer(id, {
        price: Number(price.replace(/[^\d,.]/g, '').replace(',', '.')),
        quantity: Number(quantity.replace(',', '.')),
        unit: request.data?.unit ?? 'tonnes',
        currency: request.data?.currency ?? 'XOF',
        conditions: conditions.trim() || undefined,
      }),
    onSuccess: () => {
      setOffering(false);
      setError(null);
      setPrice('');
      setQuantity('');
      setConditions('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.requests.offers(id) });
    },
    onError: (caught) => setError(caught),
  });

  const decide = useMutation({
    mutationFn: ({ offerId, status }: { offerId: string; status: string }) =>
      requestApi.updateOffer(offerId, { status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.requests.offers(id) }),
    onError: (caught) => setError(caught),
  });

  const data = request.data;

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={data?.title ?? 'Demande d’achat'} subtitle="Correspondances, offres reçues et décision." />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title="Connexion requise"
          description="Connectez-vous pour consulter cette demande et déposer une offre."
          icon="cart-outline"
        >
          {request.isLoading ? (
            <LoadingState count={2} height={130} />
          ) : request.isError || !data ? (
            <ErrorState error={request.error} onRetry={() => void request.refetch()} />
          ) : (
            <>
              <Card tone="white" style={styles.card}>
                <View style={styles.chips}>
                  <Chip label={data.status} tone="neutral" size="sm" />
                  <Chip label={data.deliveryCountry} tone="neutral" size="sm" />
                </View>
                <Text preset="h2" color={COLORS.textPrimary}>
                  {data.title}
                </Text>
                {data.description ? (
                  <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
                    {data.description}
                  </Text>
                ) : null}

                <View style={styles.facts}>
                  <View style={styles.fact}>
                    <Text preset="caption" color={COLORS.slateGray}>
                      Volume recherché
                    </Text>
                    <Text preset="bodyMedium" color={COLORS.textPrimary}>
                      {formatNumber(data.quantity, locale, 1)} {data.unit}
                    </Text>
                  </View>
                  <View style={styles.fact}>
                    <Text preset="caption" color={COLORS.slateGray}>
                      Budget
                    </Text>
                    <Text preset="bodyMedium" color={COLORS.textPrimary}>
                      {data.budgetPrice !== null ? formatCurrency(data.budgetPrice, data.currency, locale) : 'non communiqué'}
                    </Text>
                  </View>
                  <View style={styles.fact}>
                    <Text preset="caption" color={COLORS.slateGray}>
                      Qualité
                    </Text>
                    <Text preset="bodyMedium" color={COLORS.textPrimary}>
                      {data.quality ?? 'non précisée'}
                    </Text>
                  </View>
                  <View style={styles.fact}>
                    <Text preset="caption" color={COLORS.slateGray}>
                      Échéance
                    </Text>
                    <Text preset="bodyMedium" color={COLORS.textPrimary}>
                      {data.neededBy ? formatDate(data.neededBy, locale) : '—'}
                    </Text>
                  </View>
                </View>

                {data.conditions ? (
                  <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                    Conditions : {data.conditions}
                  </Text>
                ) : null}
              </Card>

              <Text preset="overline" color={COLORS.forestGreen}>
                Correspondances
              </Text>
              {matches.isLoading ? (
                <LoadingState count={1} height={90} />
              ) : matches.isError ? (
                <ErrorState error={matches.error} onRetry={() => void matches.refetch()} />
              ) : (matches.data ?? []).length === 0 ? (
                <EmptyState
                  title="Aucune correspondance"
                  description="Aucune annonce publiée ne correspond à ce besoin pour l'instant."
                  icon="search-outline"
                />
              ) : (
                <View style={styles.list}>
                  {(matches.data ?? []).map((match, index) => (
                    <Reveal key={match.id} index={index} variant="up">
                      <Card tone="white" style={styles.matchCard}>
                        <View style={styles.matchBody}>
                          <Text preset="bodyMedium" color={COLORS.textPrimary} numberOfLines={1}>
                            {match.title}
                          </Text>
                          <Text preset="caption" color={COLORS.slateGray}>
                            {formatNumber(match.quantity, locale, 1)} {match.unit} · {match.countryCode}
                            {match.indicativePrice !== null ? ` · ${formatCurrency(match.indicativePrice, match.currency, locale)}` : ''}
                          </Text>
                        </View>
                        <Chip label={match.status} tone="success" size="sm" />
                      </Card>
                    </Reveal>
                  ))}
                </View>
              )}

              <View style={styles.offersHeader}>
                <Text preset="overline" color={COLORS.forestGreen}>
                  Offres
                </Text>
                <Button
                  label={offering ? 'Fermer' : 'Déposer une offre'}
                  onPress={() => setOffering((value) => !value)}
                  variant={offering ? 'ghost' : 'primary'}
                  size="sm"
                  icon={offering ? 'close' : 'add'}
                />
              </View>

              {offering ? (
                <Animated.View entering={FadeInDown.duration(DURATION.slow)} exiting={FadeOutUp.duration(DURATION.fast)}>
                  <Card tone="white" style={styles.form}>
                    <View style={styles.row}>
                      <Input label="Prix" value={price} onChangeText={setPrice} placeholder="640 000" icon="cash-outline" keyboardType="decimal-pad" />
                      <Input label="Quantité proposée" value={quantity} onChangeText={setQuantity} placeholder={String(data.quantity)} icon="scale-outline" keyboardType="decimal-pad" />
                    </View>
                    <TextArea label="Conditions" value={conditions} onChangeText={setConditions} placeholder="Délai, lieu de livraison, modalité de paiement…" minHeight={84} optionalLabel="facultatif" />
                    {error ? <ErrorState error={error} showRequestId /> : null}
                    <Button
                      label="Envoyer l’offre"
                      onPress={() => submit.mutate()}
                      variant="primary"
                      fullWidth
                      loading={submit.isPending}
                      disabled={!price.trim() || !quantity.trim()}
                    />
                  </Card>
                </Animated.View>
              ) : null}

              {offers.isLoading ? (
                <LoadingState count={1} height={90} />
              ) : offers.isError ? (
                <ErrorState error={offers.error} onRetry={() => void offers.refetch()} />
              ) : (offers.data ?? []).length === 0 ? (
                <EmptyState title="Aucune offre" description="Les offres reçues apparaissent ici avec leur statut." icon="document-text-outline" />
              ) : (
                <View style={styles.list}>
                  {(offers.data ?? []).map((offer, index) => (
                    <Reveal key={offer.id} index={index} variant="up">
                      <Card tone="white" style={styles.card}>
                        <View style={styles.offerHead}>
                          <View style={styles.matchBody}>
                            <Text preset="bodyMedium" color={COLORS.textPrimary}>
                              {formatCurrency(offer.price, offer.currency, locale)} · {formatNumber(offer.quantity, locale, 1)} {offer.unit}
                            </Text>
                            <Text preset="caption" color={COLORS.slateGray}>
                              déposée le {formatDate(offer.createdAt, locale)}
                              {offer.validUntil ? ` · valable jusqu’au ${formatDate(offer.validUntil, locale)}` : ''}
                            </Text>
                          </View>
                          <Chip label={offer.status} tone={offer.status === 'ACCEPTED' ? 'success' : offer.status === 'REJECTED' ? 'error' : 'neutral'} size="sm" />
                        </View>

                        {offer.conditions ? (
                          <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                            {offer.conditions}
                          </Text>
                        ) : null}

                        {offer.status === 'PENDING' ? (
                          <View style={styles.actions}>
                            <Button label="Accepter" onPress={() => decide.mutate({ offerId: offer.id, status: 'ACCEPTED' })} variant="primary" size="sm" icon="checkmark-outline" />
                            <Button label="Refuser" onPress={() => decide.mutate({ offerId: offer.id, status: 'REJECTED' })} variant="outline" size="sm" icon="close-outline" />
                          </View>
                        ) : null}
                      </Card>
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
  chips: { flexDirection: 'row', gap: SPACING.xs },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.lg },
  fact: { minWidth: 140, gap: 2 },
  matchCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  matchBody: { flex: 1, gap: 2 },
  offersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  form: { gap: SPACING.md },
  row: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
  offerHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  list: { gap: SPACING.sm },
});
