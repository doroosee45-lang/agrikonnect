import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import {
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  ErrorState,
  FilterChip,
  Input,
  LoadingState,
  ProvenanceTag,
  Reveal,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate, formatNumber } from '@/lib/format';
import { DURATION } from '@/theme/motion';
import { farmApi, plotApi, productionApi, referenceApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

/**
 * Productions (PROD-01 → PROD-04) : campagnes de récolte déclarées.
 *
 * Les quantités sont saisies dans l'unité locale du producteur ; la conversion
 * en kg vient du référentiel d'unités du backend. Si l'unité n'est pas
 * convertible, la valeur reste telle quelle et n'entre dans aucun total.
 */
export default function Productions() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [farmId, setFarmId] = useState<string | null>(null);
  const [plotId, setPlotId] = useState<string | null>(null);
  const [cropId, setCropId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('sacs de 50 kg');
  const [season, setSeason] = useState('');
  const [harvestedAt, setHarvestedAt] = useState('');
  const [quality, setQuality] = useState('');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState<unknown>(null);

  const productions = useQuery({
    queryKey: queryKeys.productions.list({}),
    queryFn: () => productionApi.list({ limit: 50 }).then((result) => result.data),
  });
  const stats = useQuery({
    queryKey: [...queryKeys.productions.all, 'stats', 'crop'],
    queryFn: () => productionApi.stats({ groupBy: 'crop' }).then((result) => result.data),
  });
  const farms = useQuery({
    queryKey: queryKeys.farms.list({}),
    queryFn: () => farmApi.list({ limit: 50 }).then((result) => result.data),
  });
  const plots = useQuery({
    queryKey: queryKeys.plots.list({}),
    queryFn: () => plotApi.list({ limit: 50 }).then((result) => result.data),
  });
  const crops = useQuery({
    queryKey: queryKeys.crops.all,
    queryFn: () => referenceApi.crops().then((result) => result.data),
  });

  const selectedFarm = farmId ?? farms.data?.[0]?.id ?? null;

  const create = useMutation({
    mutationFn: () => {
      if (!selectedFarm) throw new Error('Sélectionnez une exploitation.');
      if (!cropId) throw new Error('Sélectionnez une culture.');
      const quantityValue = Number(quantity.replace(/[^\d,.]/g, '').replace(',', '.'));
      if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
        throw new Error('Indiquez une quantité positive.');
      }
      if (!season.trim()) throw new Error('Indiquez la saison (ex. 2026-A).');
      if (!harvestedAt.trim()) throw new Error('Indiquez la date de récolte.');

      return productionApi.create({
        farmId: selectedFarm,
        plotId: plotId ?? undefined,
        cropId,
        quantity: quantityValue,
        unit: unit.trim(),
        season: season.trim(),
        harvestedAt: harvestedAt.trim(),
        quality: quality.trim() || undefined,
        destination: destination.trim() || undefined,
      });
    },
    onSuccess: (result) => {
      setCreating(false);
      setError(null);
      setNotice(result.data.conversion.message ?? 'Production enregistrée.');
      setQuantity('');
      setSeason('');
      setHarvestedAt('');
      setQuality('');
      setDestination('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.productions.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
    onError: (caught) => setError(caught),
  });

  const items = productions.data ?? [];
  const farmPlots = (plots.data ?? []).filter((plot) => !selectedFarm || plot.farmId === selectedFarm);

  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title={t('farmer.productions')} subtitle="Vos récoltes déclarées, par saison et par culture." />

      <Section bare contentStyle={styles.section}>
        <View style={styles.toolbar}>
          <Button
            label={creating ? 'Fermer' : 'Déclarer une récolte'}
            onPress={() => setCreating((value) => !value)}
            variant={creating ? 'ghost' : 'primary'}
            size="sm"
            icon={creating ? 'close' : 'add'}
          />
        </View>

        {stats.data ? (
          <Card tone="ink" style={styles.stats}>
            <Text preset="overline" color={COLORS.gold}>
              Cumul déclaré
            </Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text preset="numeric" color={COLORS.pureWhite}>
                  {formatNumber(stats.data.totals.records, locale)}
                </Text>
                <Text preset="caption" color="rgba(246, 247, 242, 0.65)">
                  récoltes
                </Text>
              </View>
              <View style={styles.stat}>
                <Text preset="numeric" color={COLORS.pureWhite}>
                  {formatNumber(stats.data.totals.quantityKg, locale, 0)} kg
                </Text>
                <Text preset="caption" color="rgba(246, 247, 242, 0.65)">
                  unités converties
                </Text>
              </View>
              {stats.data.totals.recordsWithoutKg > 0 ? (
                <View style={styles.stat}>
                  <Text preset="numeric" color={COLORS.gold}>
                    {formatNumber(stats.data.totals.recordsWithoutKg, locale)}
                  </Text>
                  <Text preset="caption" color="rgba(246, 247, 242, 0.65)">
                    non converties
                  </Text>
                </View>
              ) : null}
            </View>
            <Text preset="caption" color="rgba(246, 247, 242, 0.6)" style={styles.lineHeight}>
              Les unités locales non convertibles en kg ne sont pas additionnées : aucun total n’est inventé.
            </Text>
          </Card>
        ) : null}

        {notice ? (
          <Card tone="pale" style={styles.notice}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.success} />
            <Text preset="caption" color={COLORS.textPrimary} style={styles.noticeText}>
              {notice}
            </Text>
          </Card>
        ) : null}

        {creating ? (
          <Animated.View entering={FadeInDown.duration(DURATION.slow)} exiting={FadeOutUp.duration(DURATION.fast)}>
            <Card tone="white" style={styles.form}>
              <View style={styles.block}>
                <Text preset="caption" color={COLORS.textPrimary}>
                  Exploitation
                </Text>
                {(farms.data ?? []).length === 0 ? (
                  <Text preset="caption" color={COLORS.slateGray}>
                    Créez d’abord une exploitation.
                  </Text>
                ) : (
                  <ChipRow>
                    {(farms.data ?? []).slice(0, 8).map((farm) => (
                      <FilterChip
                        key={farm.id}
                        label={farm.name}
                        active={selectedFarm === farm.id}
                        onPress={() => {
                          setFarmId(farm.id);
                          setPlotId(null);
                        }}
                      />
                    ))}
                  </ChipRow>
                )}
              </View>

              <View style={styles.block}>
                <Text preset="caption" color={COLORS.textPrimary}>
                  Parcelle <Text preset="caption" color={COLORS.slateGray}>(facultatif)</Text>
                </Text>
                {farmPlots.length === 0 ? (
                  <Text preset="caption" color={COLORS.slateGray}>
                    Aucune parcelle rattachée à cette exploitation.
                  </Text>
                ) : (
                  <ChipRow>
                    {farmPlots.slice(0, 10).map((plot) => (
                      <FilterChip key={plot.id} label={plot.name} active={plotId === plot.id} onPress={() => setPlotId(plot.id === plotId ? null : plot.id)} />
                    ))}
                  </ChipRow>
                )}
              </View>

              <View style={styles.block}>
                <Text preset="caption" color={COLORS.textPrimary}>
                  Culture
                </Text>
                {crops.isLoading ? (
                  <Text preset="caption" color={COLORS.slateGray}>
                    Chargement du référentiel…
                  </Text>
                ) : crops.isError ? (
                  <ErrorState error={crops.error} onRetry={() => void crops.refetch()} />
                ) : (
                  <ChipRow>
                    {(crops.data ?? []).slice(0, 12).map((crop) => (
                      <FilterChip
                        key={crop.id}
                        label={crop.names?.fr ?? crop.slug}
                        active={cropId === crop.id}
                        onPress={() => setCropId(crop.id)}
                      />
                    ))}
                  </ChipRow>
                )}
              </View>

              <View style={styles.row}>
                <Input label="Quantité" value={quantity} onChangeText={setQuantity} placeholder="42" icon="scale-outline" keyboardType="decimal-pad" />
                <Input label="Unité locale" value={unit} onChangeText={setUnit} placeholder="sacs de 50 kg" icon="cube-outline" />
              </View>
              <View style={styles.row}>
                <Input label="Saison" value={season} onChangeText={setSeason} placeholder="2026-A" icon="leaf-outline" autoCapitalize="characters" />
                <Input label="Date de récolte" value={harvestedAt} onChangeText={setHarvestedAt} placeholder="2026-09-18" icon="calendar-outline" />
              </View>
              <View style={styles.row}>
                <Input label="Qualité" value={quality} onChangeText={setQuality} placeholder="Grade A" icon="ribbon-outline" optionalLabel="facultatif" />
                <Input label="Destination" value={destination} onChangeText={setDestination} placeholder="Coopérative / marché" icon="pricetag-outline" optionalLabel="facultatif" />
              </View>

              <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                Enregistrement source « déclaré ». La conversion en kilogrammes provient du référentiel
                d’unités ; elle est nulle si votre unité n’y figure pas.
              </Text>

              {error ? <ErrorState error={error} showRequestId /> : null}

              <Button
                label="Enregistrer la récolte"
                onPress={() => create.mutate()}
                variant="primary"
                fullWidth
                loading={create.isPending}
                disabled={!selectedFarm || !cropId}
              />
            </Card>
          </Animated.View>
        ) : null}

        {productions.isLoading ? (
          <LoadingState count={2} height={110} />
        ) : productions.isError ? (
          <ErrorState error={productions.error} onRetry={() => void productions.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Aucune récolte"
            description="Déclarez une récolte pour suivre vos volumes par saison et par culture."
            icon="leaf-outline"
            action={{ label: 'Déclarer une récolte', onPress: () => setCreating(true) }}
          />
        ) : (
          <View style={styles.list}>
            {items.map((production, index) => (
              <Reveal key={production.id} index={index} variant="up">
                <Card tone="white" style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardIcon}>
                      <Ionicons name="leaf-outline" size={15} color={COLORS.livingGreen} />
                    </View>
                    <View style={styles.cardTitle}>
                      <Text preset="bodyMedium" color={COLORS.textPrimary} numberOfLines={1}>
                        {production.crop?.names?.fr ?? production.crop?.slug ?? 'Culture'}
                      </Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {production.farm?.name ?? '—'}
                        {production.plot ? ` · ${production.plot.name}` : ''} · saison {production.season}
                      </Text>
                    </View>
                    <ProvenanceTag kind={production.source === 'declared' ? 'declared' : 'measured'} />
                  </View>

                  <View style={styles.cardFacts}>
                    <View style={styles.fact}>
                      <Text preset="caption" color={COLORS.slateGray}>
                        Quantité déclarée
                      </Text>
                      <Text preset="bodySm" color={COLORS.textPrimary}>
                        {formatNumber(production.quantity, locale, 1)} {production.unit}
                      </Text>
                    </View>
                    <View style={styles.fact}>
                      <Text preset="caption" color={COLORS.slateGray}>
                        Équivalent kg
                      </Text>
                      <Text preset="bodySm" color={production.quantityKg === null ? COLORS.slateGray : COLORS.textPrimary}>
                        {production.quantityKg === null ? 'unité non convertible' : `${formatNumber(production.quantityKg, locale, 0)} kg`}
                      </Text>
                    </View>
                    <View style={styles.fact}>
                      <Text preset="caption" color={COLORS.slateGray}>
                        Récolte
                      </Text>
                      <Text preset="bodySm" color={COLORS.textPrimary}>
                        {formatDate(production.harvestedAt, locale)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardChips}>
                    {production.quality ? <Chip label={`Qualité : ${production.quality}`} tone="neutral" size="sm" /> : null}
                    {production.destination ? <Chip label={production.destination} tone="neutral" size="sm" /> : null}
                  </View>
                </Card>
              </Reveal>
            ))}
          </View>
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  lineHeight: { lineHeight: 18 },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end' },
  stats: { gap: SPACING.md },
  statsRow: { flexDirection: 'row', gap: SPACING.xl, flexWrap: 'wrap' },
  stat: { gap: 2 },
  notice: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  noticeText: { flex: 1, lineHeight: 18 },
  form: { gap: SPACING.md },
  block: { gap: SPACING.sm },
  row: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
  list: { gap: SPACING.md },
  card: { gap: SPACING.md },
  cardHeader: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center' },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    backgroundColor: TINTS.livingGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { flex: 1, gap: 2 },
  cardFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.lg },
  fact: { gap: 2 },
  cardChips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
});
