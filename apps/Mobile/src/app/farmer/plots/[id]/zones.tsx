import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

import { PlotScreenHeader } from '@/components/farmer/PlotScreenHeader';
import {
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
  Text,
} from '@/components/ui';
import { useI18n, tr } from '@/i18n';
import { formatDate } from '@/lib/format';
import { plotApi, precisionApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

const SOURCE_LABELS: Record<string, string> = {
  get satellite() { return tr('ui.imagerieSatellite'); },
  get soil_assessment() { return tr('ui.analyseDeSol'); },
  sensor: 'capteurs',
};

/**
 * Zones de gestion (PRE-01).
 *
 * Un calcul n'est accepté que si au moins une source réelle existe sur la
 * parcelle (satellite, sol ou capteur). Aucune géométrie n'est inventée : le
 * contour reste à fournir, et chaque calcul crée une version horodatée.
 */
export default function PlotZones() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);

  const plot = useQuery({
    queryKey: queryKeys.plots.one(id),
    queryFn: () => plotApi.get(id).then((result) => result.data),
    enabled: Boolean(id),
  });
  const zones = useQuery({
    queryKey: [...queryKeys.plots.one(id), 'management-zones'],
    queryFn: () => precisionApi.zones(id).then((result) => result.data),
    enabled: Boolean(id),
  });

  const compute = useMutation({
    mutationFn: () => precisionApi.computeZones(id, {}),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.plots.one(id), 'management-zones'] });
    },
    onError: (caught) => setError(caught),
  });

  const versions = zones.data?.versions ?? [];

  return (
    <Screen background={COLORS.naturalWhite}>
      <PlotScreenHeader title={t('ui.zonesDeGestion')} plotName={plot.data?.name} plotId={id} />

      <Section bare contentStyle={styles.section}>
        <Card tone="pale" style={styles.disclaimer}>
          <Ionicons name="grid-outline" size={16} color={COLORS.info} />
          <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>{t('ui.lesZonesNeSontDelimiteesQue')}</Text>
        </Card>

        <Card tone="white" style={styles.card}>
          <Text preset="overline" color={COLORS.forestGreen}>{t('ui.calculer')}</Text>
          {error ? <ErrorState error={error} showRequestId /> : null}
          <Button
            label={t('ui.calculerLesZones')}
            onPress={() => compute.mutate()}
            variant="primary"
            fullWidth
            loading={compute.isPending}
            icon="grid-outline"
          />
          <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.sansSourceSatelliteAnalyseDeSol', { value: zones.data?.versioning ?? '' })}</Text>
        </Card>

        {zones.isLoading ? (
          <LoadingState count={2} height={120} />
        ) : zones.isError ? (
          <ErrorState error={zones.error} onRetry={() => void zones.refetch()} />
        ) : versions.length === 0 ? (
          <EmptyState
            title={t('ui.aucuneZoneCalculee')}
            description={t('ui.rattachezDesCapteursEnregistrezUneAnalyse')}
            icon="grid-outline"
          />
        ) : (
          <View style={styles.list}>
            {versions.map((version, index) => (
              <Reveal key={version.id} index={index} variant="up">
                <Card tone="white" style={styles.card}>
                  <View style={styles.head}>
                    <View style={styles.headText}>
                      <Text preset="h3" color={COLORS.textPrimary}>{t('ui.zoneS_9a02e', { value: version.zones?.length ?? 0 })}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>{t('ui.methodeCalculeeLe', { methodVersion: version.methodVersion, computedAt: formatDate(version.computedAt, locale) })}</Text>
                    </View>
                    <Chip label={version.methodVersion} tone="neutral" size="sm" />
                  </View>

                  <View style={styles.zones}>
                    {(version.zones ?? []).map((zone) => (
                      <View key={`${version.id}-${zone.index}`} style={styles.zone}>
                        <View style={styles.zoneIndex}>
                          <Text preset="caption" color={COLORS.forestGreen}>
                            {zone.label}
                          </Text>
                        </View>
                        <View style={styles.zoneBody}>
                          <ChipRow>
                            {(zone.basis ?? []).map((basis) => (
                              <Chip key={basis} label={SOURCE_LABELS[basis] ?? basis} tone="success" size="sm" />
                            ))}
                          </ChipRow>
                          <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>{t('ui.contour')}{' '}{zone.geometry ? 'fourni' : t('ui.aTracerSurLeTerrain')}{' '}{t('ui.recommandation')}{' '}{zone.recommendation ?? t('ui.aucuneValidationTerrainRequise')}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  <View style={styles.block}>
                    <Text preset="caption" color={COLORS.textPrimary}>{t('ui.sourcesDisponibles')}</Text>
                    <ChipRow>
                      {(version.sources?.available ?? []).map((source, sourceIndex) => (
                        <Chip
                          key={`${version.id}-src-${sourceIndex}`}
                          label={SOURCE_LABELS[String(source.kind)] ?? String(source.kind)}
                          tone="neutral"
                          size="sm"
                        />
                      ))}
                    </ChipRow>
                  </View>

                  {(version.sources?.missing ?? []).length > 0 ? (
                    <Text preset="caption" color={COLORS.warning}>{t('ui.manquant_45da8', { value: (version.sources?.missing ?? []).join(', ') })}</Text>
                  ) : null}
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
  disclaimer: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  card: { gap: SPACING.md },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  headText: { flex: 1, gap: 2 },
  zones: { gap: SPACING.md },
  zone: { flexDirection: 'row', gap: SPACING.md },
  zoneIndex: { width: 64 },
  zoneBody: { flex: 1, gap: 4 },
  block: { gap: SPACING.sm },
  list: { gap: SPACING.md },
});
