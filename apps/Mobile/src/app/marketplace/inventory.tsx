import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate, formatNumber } from '@/lib/format';
import { DURATION } from '@/theme/motion';
import { inventoryApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** Stock : articles, seuils d'alerte et mouvements journalisés. */
export default function Inventory() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [unit, setUnit] = useState('kg');
  const [threshold, setThreshold] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [movementQuantity, setMovementQuantity] = useState('');
  const [movementType, setMovementType] = useState<'IN' | 'OUT'>('IN');
  const [error, setError] = useState<unknown>(null);

  const items = useQuery({
    queryKey: queryKeys.inventory.all,
    queryFn: () => inventoryApi.list({ limit: 50 }).then((result) => result.data),
    enabled: isAuthenticated,
  });
  const movements = useQuery({
    queryKey: queryKeys.inventory.movements(selected ?? 'none'),
    queryFn: () => inventoryApi.movements(selected as string).then((result) => result.data),
    enabled: isAuthenticated && Boolean(selected),
  });

  const create = useMutation({
    mutationFn: () =>
      inventoryApi.create({
        label: label.trim(),
        unit: unit.trim(),
        lowStockThreshold: threshold.trim() ? Number(threshold.replace(',', '.')) : undefined,
        expiresAt: expiresAt.trim() || undefined,
      }),
    onSuccess: () => {
      setCreating(false);
      setError(null);
      setLabel('');
      setThreshold('');
      setExpiresAt('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },
    onError: (caught) => setError(caught),
  });

  const addMovement = useMutation({
    mutationFn: () =>
      inventoryApi.addMovement({
        itemId: selected,
        type: movementType,
        quantity: Number(movementQuantity.replace(',', '.')),
        unit: (items.data ?? []).find((item) => item.id === selected)?.unit ?? unit,
      }),
    onSuccess: () => {
      setError(null);
      setMovementQuantity('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.movements(selected ?? 'none') });
    },
    onError: (caught) => setError(caught),
  });

  const rows = items.data ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('ui.stock')} subtitle={t('ui.articlesSeuilsDAlerteEtMouvements')} />

      <Section bare contentStyle={styles.section}>
        <AuthGate
          isAuthenticated={isAuthenticated}
          title={t('ui.connexionRequise_37a92')}
          description={t('ui.connectezVousPourGererVotreStock')}
          icon="cube-outline"
        >
          <View style={styles.toolbar}>
            <Button
              label={creating ? t('common.close') : t('ui.nouvelArticle')}
              onPress={() => setCreating((value) => !value)}
              variant={creating ? 'ghost' : 'primary'}
              size="sm"
              icon={creating ? 'close' : 'add'}
            />
          </View>

          {creating ? (
            <Animated.View entering={FadeInDown.duration(DURATION.slow)} exiting={FadeOutUp.duration(DURATION.fast)}>
              <Card tone="white" style={styles.form}>
                <Input label={t('ui.article')} value={label} onChangeText={setLabel} placeholder={t('ui.cacaoSecheLotA')} icon="cube-outline" autoCapitalize="words" />
                <View style={styles.row}>
                  <Input label={t('ui.unite')} value={unit} onChangeText={setUnit} placeholder="kg" icon="scale-outline" />
                  <Input label={t('ui.seuilDAlerte')} value={threshold} onChangeText={setThreshold} placeholder="500" icon="alert-circle-outline" keyboardType="decimal-pad" optionalLabel={t('common.optional')} />
                </View>
                <Input label={t('ui.peremption')} value={expiresAt} onChangeText={setExpiresAt} placeholder="2026-12-31" icon="calendar-outline" optionalLabel={t('common.optional')} />
                {error ? <ErrorState error={error} showRequestId /> : null}
                <Button label={t('ui.creerLArticle_94b5a')} onPress={() => create.mutate()} variant="primary" fullWidth loading={create.isPending} disabled={label.trim().length < 2} />
              </Card>
            </Animated.View>
          ) : null}

          {items.isLoading ? (
            <LoadingState count={2} height={100} />
          ) : items.isError ? (
            <ErrorState error={items.error} onRetry={() => void items.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState title={t('ui.aucunArticle')} description={t('ui.creezUnArticlePourSuivreSes')} icon="cube-outline" action={{ label: t('ui.nouvelArticle'), onPress: () => setCreating(true) }} />
          ) : (
            <View style={styles.list}>
              {rows.map((item, index) => {
                const low = item.lowStockThreshold !== null && (item.stock ?? 0) <= item.lowStockThreshold;
                return (
                  <Reveal key={item.id} index={index} variant="up">
                    <Card tone={selected === item.id ? 'pale' : 'white'} style={styles.card}>
                      <View style={styles.head}>
                        <View style={styles.headText}>
                          <Text preset="bodyMedium" color={COLORS.textPrimary}>
                            {item.label}
                          </Text>
                          <Text preset="caption" color={COLORS.slateGray}>
                            {item.stock !== undefined ? `${formatNumber(item.stock, locale, 1)} ${item.unit}` : t('ui.unite_49bcf', { unit: item.unit })}
                            {item.expiresAt ? t('ui.peremption_34398', { expiresAt: formatDate(item.expiresAt, locale) }) : ''}
                          </Text>
                        </View>
                        {low ? <Chip label={t('ui.seuilAtteint')} tone="warning" size="sm" /> : null}
                      </View>
                      <Button
                        label={selected === item.id ? t('ui.masquerLesMouvements') : t('ui.voirLesMouvements')}
                        onPress={() => setSelected(selected === item.id ? null : item.id)}
                        variant="outline"
                        size="sm"
                        icon="list-outline"
                      />
                    </Card>
                  </Reveal>
                );
              })}
            </View>
          )}

          {selected ? (
            <>
              <Card tone="white" style={styles.form}>
                <Text preset="overline" color={COLORS.forestGreen}>{t('ui.enregistrerUnMouvement')}</Text>
                <ChipRow>
                  {(['IN', 'OUT'] as const).map((type) => (
                    <FilterChip key={type} label={type === 'IN' ? t('ui.entree') : t('ui.sortie')} active={movementType === type} onPress={() => setMovementType(type)} />
                  ))}
                </ChipRow>
                <Input label={t('ui.quantite')} value={movementQuantity} onChangeText={setMovementQuantity} placeholder="250" icon="scale-outline" keyboardType="decimal-pad" />
                {error ? <ErrorState error={error} showRequestId /> : null}
                <Button
                  label={t('common.save')}
                  onPress={() => addMovement.mutate()}
                  variant="primary"
                  size="sm"
                  loading={addMovement.isPending}
                  disabled={!movementQuantity.trim()}
                />
              </Card>

              {movements.isLoading ? (
                <LoadingState count={2} height={70} />
              ) : movements.isError ? (
                <ErrorState error={movements.error} onRetry={() => void movements.refetch()} />
              ) : (movements.data ?? []).length === 0 ? (
                <EmptyState title={t('ui.aucunMouvement')} description={t('ui.lesEntreesEtSortiesApparaitrontIci')} icon="swap-vertical-outline" />
              ) : (
                <View style={styles.list}>
                  {(movements.data ?? []).map((movement, index) => (
                    <Reveal key={movement.id} index={index} variant="up">
                      <Card tone="white" style={styles.movementCard}>
                        <View style={styles.headText}>
                          <Text preset="bodySm" color={COLORS.textPrimary}>
                            {movement.type === 'IN' ? t('ui.entree') : t('ui.sortie')} · {formatNumber(movement.quantity, locale, 1)} {movement.unit}
                          </Text>
                          <Text preset="caption" color={COLORS.slateGray}>
                            {formatDate(movement.at, locale)}
                            {movement.reason ? ` · ${movement.reason}` : ''}
                          </Text>
                        </View>
                        <Chip label={movement.type} tone={movement.type === 'IN' ? 'success' : 'neutral'} size="sm" />
                      </Card>
                    </Reveal>
                  ))}
                </View>
              )}
            </>
          ) : null}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end' },
  form: { gap: SPACING.md },
  row: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
  list: { gap: SPACING.sm },
  card: { gap: SPACING.md },
  head: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center' },
  headText: { flex: 1, gap: 2 },
  movementCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
});
