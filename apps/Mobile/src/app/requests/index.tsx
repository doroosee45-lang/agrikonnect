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
  const { t } = useI18n();
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
      <AppHeader title={t('ui.demandesDAchat')} subtitle={t('ui.besoinsExprimesParLesAcheteursAvec')} />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title={t('ui.connexionRequise_37a92')}
          description={t('ui.connectezVousPourPublierUneDemande')}
          icon="cart-outline"
        >
          <View style={styles.toolbar}>
            <Button
              label={creating ? t('common.close') : t('ui.nouvelleDemande')}
              onPress={() => setCreating((value) => !value)}
              variant={creating ? 'ghost' : 'primary'}
              size="sm"
              icon={creating ? 'close' : 'add'}
            />
          </View>

          {creating ? (
            <Animated.View entering={FadeInDown.duration(DURATION.slow)} exiting={FadeOutUp.duration(DURATION.fast)}>
              <Card tone="white" style={styles.form}>
                <Input label={t('ui.titre')} value={title} onChangeText={setTitle} placeholder={t('ui.anacardeBrute40T')} icon="cart-outline" autoCapitalize="sentences" />

                <View style={styles.block}>
                  <Text preset="caption" color={COLORS.textPrimary}>{t('ui.culture')}</Text>
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
                  <Input label={t('ui.quantite')} value={quantity} onChangeText={setQuantity} placeholder="40" icon="scale-outline" keyboardType="decimal-pad" />
                  <Input label={t('ui.unite')} value={unit} onChangeText={setUnit} placeholder="tonnes" icon="cube-outline" />
                </View>
                <View style={styles.row}>
                  <Input label={t('ui.budgetUnitaire')} value={budget} onChangeText={setBudget} placeholder="650 000" icon="cash-outline" keyboardType="decimal-pad" optionalLabel={t('common.optional')} />
                  <Input label={t('ui.devise')} value={currency} onChangeText={(v) => setCurrency(v.toUpperCase().slice(0, 3))} placeholder="XOF" icon="wallet-outline" maxLength={3} />
                </View>
                <View style={styles.row}>
                  <Input label={t('ui.paysDeLivraison')} value={country} onChangeText={(v) => setCountry(v.toUpperCase().slice(0, 2))} placeholder="CI" icon="globe-outline" maxLength={2} />
                  <Input label={t('ui.besoinAvantLe')} value={neededBy} onChangeText={setNeededBy} placeholder="2026-06-30" icon="calendar-outline" optionalLabel={t('common.optional')} />
                </View>
                <TextArea label={t('ui.cahierDesCharges')} value={description} onChangeText={setDescription} placeholder={t('ui.qualiteHumiditeConditionnementIncoterm')} minHeight={100} optionalLabel={t('common.optional')} />

                {error ? <ErrorState error={error} showRequestId /> : null}

                <Button
                  label={t('ui.publierLaDemande')}
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
              title={t('ui.aucuneDemandePubliee')}
              description={t('ui.publiezUnBesoinLesVendeursCompatibles')}
              icon="cart-outline"
              action={{ label: t('ui.nouvelleDemande'), onPress: () => setCreating(true) }}
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
                          {item.neededBy ? t('ui.avantLe', { neededBy: formatDate(item.neededBy, locale) }) : ''}
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
                        {item.budgetPrice !== null ? formatCurrency(item.budgetPrice, item.currency, locale) : t('ui.budgetNonCommunique')}
                      </Text>
                      <View style={styles.actions}>
                        <Button label={t('ui.detail')} onPress={() => router.push(`/requests/${item.id}` as never)} variant="outline" size="sm" />
                      </View>
                    </View>

                    <View style={styles.meta}>
                      <Ionicons name="time-outline" size={12} color={COLORS.slateGray} />
                      <Text preset="caption" color={COLORS.slateGray}>{t('ui.publieeLeVersion', { createdAt: formatDate(item.createdAt, locale), version: item.version })}</Text>
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
