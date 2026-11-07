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
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { plotApi, precisionApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

const SOURCE_LABELS: Record<string, string> = {
  satellite: 'imagerie satellite',
  soil_assessment: 'analyse de sol',
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
      <PlotScreenHeader title="Zones de gestion" plotName={plot.data?.name} plotId={id} />

      <Section bare contentStyle={styles.section}>
        <Card tone="pale" style={styles.disclaimer}>
          <Ionicons name="grid-outline" size={16} color={COLORS.info} />
          <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
            Les zones ne sont délimitées que sur des sources disponibles. Aucune interpolation non documentée
            n’est produite et le découpage doit être validé sur le terrain.
          </Text>
        </Card>

        <Card tone="white" style={styles.card}>
          <Text preset="overline" color={COLORS.forestGreen}>
            Calculer
          </Text>
          {error ? <ErrorState error={error} showRequestId /> : null}
          <Button
            label="Calculer les zones"
            onPress={() => compute.mutate()}
            variant="primary"
            fullWidth
            loading={compute.isPending}
            icon="grid-outline"
          />
          <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
            Sans source (satellite, analyse de sol ou capteur), le serveur refuse le calcul : aucune zone n’est
            inventée. {zones.data?.versioning ?? ''}
          </Text>
        </Card>

        {zones.isLoading ? (
          <LoadingState count={2} height={120} />
        ) : zones.isError ? (
          <ErrorState error={zones.error} onRetry={() => void zones.refetch()} />
        ) : versions.length === 0 ? (
          <EmptyState
            title="Aucune zone calculée"
            description="Rattachez des capteurs, enregistrez une analyse de sol ou lancez un diagnostic satellite, puis relancez le calcul."
            icon="grid-outline"
          />
        ) : (
          <View style={styles.list}>
            {versions.map((version, index) => (
              <Reveal key={version.id} index={index} variant="up">
                <Card tone="white" style={styles.card}>
                  <View style={styles.head}>
                    <View style={styles.headText}>
                      <Text preset="h3" color={COLORS.textPrimary}>
                        {version.zones?.length ?? 0} zone(s)
                      </Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        méthode {version.methodVersion} · calculée le {formatDate(version.computedAt, locale)}
                      </Text>
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
                          <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
                            Contour : {zone.geometry ? 'fourni' : 'à tracer sur le terrain'} · recommandation :{' '}
                            {zone.recommendation ?? 'aucune (validation terrain requise)'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  <View style={styles.block}>
                    <Text preset="caption" color={COLORS.textPrimary}>
                      Sources disponibles
                    </Text>
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
                    <Text preset="caption" color={COLORS.warning}>
                      Manquant : {(version.sources?.missing ?? []).join(', ')}
                    </Text>
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
