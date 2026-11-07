import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
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
  FilterChip,
  Input,
  LoadingState,
  Reveal,
  Screen,
  Section,
  TextArea,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { DURATION } from '@/theme/motion';
import { referenceApi, requestApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const STATUS_TONES: Record<string, 'neutral' | 'info' | 'success' | 'warning'> = {
  OPEN: 'success',
  PUBLISHED: 'success',
  MATCHED: 'info',
  FULFILLED: 'neutral',
  CLOSED: 'neutral',
  EXPIRED: 'warning',
};

/** Demandes d'achat : expression du besoin, budget, échéance, correspondances. */
export default function Requests() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [cropId, setCropId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('tonnes');
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState('XOF');
  const [country, setCountry] = useState('CI');
  const [neededBy, setNeededBy] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<unknown>(null);

  const requests = useQuery({
    queryKey: queryKeys.requests.list({ limit: 50 }),
    queryFn: () => requestApi.list({ limit: 50 }).then((result) => result.data),
    enabled: isAuthenticated,
  });
  const crops = useQuery({
    queryKey: queryKeys.crops.all,
    queryFn: () => referenceApi.crops().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const create = useMutation({
    mutationFn: () =>
      requestApi.create({
        title: title.trim(),
        cropId: cropId ?? crops.data?.[0]?.id,
        quantity: Number(quantity.replace(',', '.')),
        unit: unit.trim(),
        budgetPrice: budget.trim() ? Number(budget.replace(/[^\d,.]/g, '').replace(',', '.')) : undefined,
        currency: currency.trim().toUpperCase(),
        deliveryCountry: country.trim().toUpperCase(),
        neededBy: neededBy.trim() || undefined,
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      setCreating(false);
      setError(null);
      setTitle('');
      setQuantity('');
      setBudget('');
      setNeededBy('');
      setDescription('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    },
    onError: (caught) => setError(caught),
  });

  const items = requests.data ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Demandes d'achat" subtitle="Besoins exprimés par les acheteurs, avec budget et échéance." />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title="Connexion requise"
          description="Connectez-vous pour publier une demande d'achat ou y répondre par une offre."
          icon="cart-outline"
        >
          <View style={styles.toolbar}>
            <Button
              label={creating ? 'Fermer' : 'Nouvelle demande'}
              onPress={() => setCreating((value) => !value)}
              variant={creating ? 'ghost' : 'primary'}
              size="sm"
              icon={creating ? 'close' : 'add'}
            />
          </View>

          {creating ? (
            <Animated.View entering={FadeInDown.duration(DURATION.slow)} exiting={FadeOutUp.duration(DURATION.fast)}>
              <Card tone="white" style={styles.form}>
                <Input label="Titre" value={title} onChangeText={setTitle} placeholder="Anacarde brute — 40 t" icon="cart-outline" autoCapitalize="sentences" />

                <View style={styles.block}>
                  <Text preset="caption" color={COLORS.textPrimary}>
                    Culture
                  </Text>
                  {crops.isLoading ? (
                    <LoadingState count={1} height={44} />
                  ) : (
                    <ChipRow>
                      {(crops.data ?? []).slice(0, 14).map((crop) => (
                        <FilterChip key={crop.id} label={crop.names?.fr ?? crop.slug} active={(cropId ?? crops.data?.[0]?.id) === crop.id} onPress={() => setCropId(crop.id)} />
                      ))}
                    </ChipRow>
                  )}
                </View>

                <View style={styles.row}>
                  <Input label="Quantité" value={quantity} onChangeText={setQuantity} placeholder="40" icon="scale-outline" keyboardType="decimal-pad" />
                  <Input label="Unité" value={unit} onChangeText={setUnit} placeholder="tonnes" icon="cube-outline" />
                </View>
                <View style={styles.row}>
                  <Input label="Budget unitaire" value={budget} onChangeText={setBudget} placeholder="650 000" icon="cash-outline" keyboardType="decimal-pad" optionalLabel="facultatif" />
                  <Input label="Devise" value={currency} onChangeText={(v) => setCurrency(v.toUpperCase().slice(0, 3))} placeholder="XOF" icon="wallet-outline" maxLength={3} />
                </View>
                <View style={styles.row}>
                  <Input label="Pays de livraison" value={country} onChangeText={(v) => setCountry(v.toUpperCase().slice(0, 2))} placeholder="CI" icon="globe-outline" maxLength={2} />
                  <Input label="Besoin avant le" value={neededBy} onChangeText={setNeededBy} placeholder="2026-06-30" icon="calendar-outline" optionalLabel="facultatif" />
                </View>
                <TextArea label="Cahier des charges" value={description} onChangeText={setDescription} placeholder="Qualité, humidité, conditionnement, incoterm…" minHeight={100} optionalLabel="facultatif" />

                {error ? <ErrorState error={error} showRequestId /> : null}

                <Button
                  label="Publier la demande"
                  onPress={() => create.mutate()}
                  variant="primary"
                  fullWidth
                  loading={create.isPending}
                  disabled={title.trim().length < 3 || !quantity.trim()}
                />
              </Card>
            </Animated.View>
          ) : null}

          {requests.isLoading ? (
            <LoadingState count={3} height={120} />
          ) : requests.isError ? (
            <ErrorState error={requests.error} onRetry={() => void requests.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title="Aucune demande publiée"
              description="Publiez un besoin : les vendeurs compatibles sont mis en correspondance à partir des annonces existantes."
              icon="cart-outline"
              action={{ label: 'Nouvelle demande', onPress: () => setCreating(true) }}
            />
          ) : (
            <View style={styles.list}>
              {items.map((item, index) => (
                <Reveal key={item.id} index={index} variant="up">
                  <Card tone="white" style={styles.card}>
                    <View style={styles.head}>
                      <View style={styles.headText}>
                        <Text preset="h3" color={COLORS.textPrimary} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>
                          {item.crop?.names?.fr ?? item.crop?.slug ?? item.cropId} · {formatNumber(item.quantity, locale, 1)} {item.unit} ·{' '}
                          {item.deliveryCountry}
                          {item.neededBy ? ` · avant le ${formatDate(item.neededBy, locale)}` : ''}
                        </Text>
                      </View>
                      <Chip label={item.status} tone={STATUS_TONES[item.status] ?? 'neutral'} size="sm" />
                    </View>

                    {item.description ? (
                      <Text preset="caption" color={COLORS.slateGray} numberOfLines={3} style={styles.lineHeight}>
                        {item.description}
                      </Text>
                    ) : null}

                    <View style={styles.foot}>
                      <Text preset="bodyMedium" color={COLORS.forestGreen}>
                        {item.budgetPrice !== null ? formatCurrency(item.budgetPrice, item.currency, locale) : 'Budget non communiqué'}
                      </Text>
                      <View style={styles.actions}>
                        <Button label="Détail" onPress={() => router.push(`/requests/${item.id}` as never)} variant="outline" size="sm" />
                      </View>
                    </View>

                    <View style={styles.meta}>
                      <Ionicons name="time-outline" size={12} color={COLORS.slateGray} />
                      <Text preset="caption" color={COLORS.slateGray}>
                        publiée le {formatDate(item.createdAt, locale)} · version {item.version}
                      </Text>
                    </View>
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
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end' },
  form: { gap: SPACING.md },
  block: { gap: SPACING.sm },
  row: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
  list: { gap: SPACING.md },
  card: { gap: SPACING.sm },
  head: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  headText: { flex: 1, gap: 2 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
