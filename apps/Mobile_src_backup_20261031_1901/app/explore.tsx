import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import {
  Card,
  Chip,
  ChipRow,
  EmptyState,
  ErrorState,
  FilterChip,
  LoadingState,
  MapPreview,
  PressableCard,
  Reveal,
  Section,
  Text,
} from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';
import { usePublicMap } from '@/hooks/usePublicData';
import { COLORS, DARK } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';
import { VERT } from '../theme/agrikonnect';

/** Explorateur cartographique : points publics, filtre par pays, liste synchronisée. */
export default function Explore() {
  const { locale } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const [country, setCountry] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = usePublicMap({
    limit: 400,
    countryCode: country ?? undefined,
  });

  const features = data?.features ?? [];
  const countries = Array.from(
    (data?.features ?? []).reduce<Set<string>>((acc, feature) => {
      acc.add(feature.properties.countryCode);
      return acc;
    }, new Set<string>()),
  ).sort();

  const pins = features.map((feature) => ({
    slug: feature.properties.slug,
    name: feature.properties.name,
    latitude: feature.geometry.coordinates[1],
    longitude: feature.geometry.coordinates[0],
    verified: feature.properties.verified,
    crops: feature.properties.crops,
    totalAreaHa: feature.properties.totalAreaHa,
  }));

  return (
    <PublicShell active="explore">
      <PageHeader
        index={1}
        eyebrow="Carte"
        title="Explorer le réseau"
        subtitle="Les points affichés sont des exploitations publiques. Les coordonnées sont arrondies côté serveur : la localisation exacte n’est jamais publiée."
        compact
      />

      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <Reveal variant="up">
          <ChipRow>
            <FilterChip label="Tous" active={country === null} onPress={() => setCountry(null)} icon="globe-outline" />
            {countries.map((code) => (
              <FilterChip
                key={code}
                label={code}
                active={country === code}
                onPress={() => setCountry(country === code ? null : code)}
              />
            ))}
          </ChipRow>
        </Reveal>

        <View style={[styles.layout, wide ? styles.layoutWide : null]}>
          <Reveal variant="left" style={styles.mapColumn}>
            <Card tone="white" padded={false} style={styles.mapCard}>
              {isLoading ? (
                <View style={styles.mapState}>
                  <LoadingState count={1} height={420} />
                </View>
              ) : isError ? (
                <View style={styles.mapState}>
                  <ErrorState error={error} onRetry={() => void refetch()} />
                </View>
              ) : (
                <View style={styles.mapBody}>
                  <MapPreview
                    pins={pins}
                    height={wide ? 460 : 340}
                    note={data?.meta.note}
                    onSelect={(slug) => router.push(`/public-site/farm/${slug}` as never)}
                  />
                </View>
              )}
            </Card>
          </Reveal>

          <Reveal index={1} variant="right" style={styles.listColumn}>
            <View style={styles.listHeader}>
              <Text preset="overline" color={COLORS.livingGreen}>
                {formatNumber(features.length, locale)} points
              </Text>
              <Text preset="bodySm" color={COLORS.slateGray}>
                Chargement par emprise, jamais le jeu complet.
              </Text>
            </View>

            {isLoading ? (
              <LoadingState count={3} height={80} />
            ) : features.length === 0 ? (
              <EmptyState
                title="Aucun point publié"
                description="Aucune exploitation publique dans ce filtre pour le moment."
                icon="map-outline"
              />
            ) : (
              <View style={styles.list}>
                {features.slice(0, 30).map((feature) => (
                  <PressableCard
                    key={feature.properties.slug}
                    onPress={() => router.push(`/public-site/farm/${feature.properties.slug}` as never)}
                    style={styles.row}
                  >
                    <View style={styles.rowIcon}>
                      <Ionicons
                        name={feature.properties.verified ? 'shield-checkmark' : 'leaf-outline'}
                        size={15}
                        color={feature.properties.verified ? COLORS.success : COLORS.gold}
                      />
                    </View>
                    <View style={styles.rowBody}>
                      <Text preset="bodyMedium" color={COLORS.textPrimary} numberOfLines={1}>
                        {feature.properties.name}
                      </Text>
                      <Text preset="caption" color={COLORS.slateGray} numberOfLines={1}>
                        {feature.properties.countryCode}
                        {feature.properties.province ? ` · ${feature.properties.province}` : ''}
                        {feature.properties.totalAreaHa !== null
                          ? ` · ${formatNumber(feature.properties.totalAreaHa, locale, 1)} ha`
                          : ''}
                      </Text>
                    </View>
                    <View style={styles.rowChips}>
                      {feature.properties.crops.slice(0, 1).map((crop) => (
                        <Chip key={crop} label={crop} tone="living" size="sm" />
                      ))}
                    </View>
                  </PressableCard>
                ))}
              </View>
            )}

            <Card tone="ink" style={styles.legend}>
              <Text preset="caption" color={DARK.textMuted} style={styles.lineHeight}>
                Regroupement des points : {data?.meta.clustering ?? 'client'} — effectué par l’application,
                pas par le serveur.
              </Text>
            </Card>
          </Reveal>
        </View>
      </Section>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 32, paddingBottom: 56, gap: SPACING.lg },
  lineHeight: { lineHeight: 18 },
  layout: { gap: SPACING.lg },
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start' },
  mapColumn: { flex: 1.5 },
  listColumn: { flex: 1, gap: SPACING.md },
  mapCard: { padding: SPACING.md },
  mapState: { padding: SPACING.md },
  mapBody: { gap: SPACING.sm },
  listHeader: { gap: 2 },
  list: { gap: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: VERT[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 1 },
  rowChips: { flexDirection: 'row', gap: SPACING.xs },
  legend: { padding: SPACING.md },
});
