import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useI18n } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { COLORS, DARK, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';
import { useCountriesFromMap, usePublicFarms } from '@/hooks/usePublicData';

import {
  Button,
  Card,
  Chip,
  ErrorState,
  LoadingState,
  MapPreview,
  PressableCard,
  ProvenanceTag,
  Reveal,
  Section,
  Text,
  EmptyState,
} from '@/components/ui';

/**
 * Section 6 — la carte agricole.
 *
 * Les points proviennent de `GET /public/map` : le serveur arrondit déjà les
 * coordonnées (MAP-04) et renvoie une note de précision que l'on affiche telle
 * quelle. Le regroupement est explicitement laissé au client (MAP-03).
 */
export function MapSection() {
  const { t, locale } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { data, entries, isLoading, isError, error, refetch } = useCountriesFromMap({ limit: 300 });

  const pins = (data?.features ?? []).map((feature) => ({
    slug: feature.properties.slug,
    name: feature.properties.name,
    latitude: feature.geometry.coordinates[1],
    longitude: feature.geometry.coordinates[0],
    verified: feature.properties.verified,
    crops: feature.properties.crops,
    totalAreaHa: feature.properties.totalAreaHa,
  }));

  return (
    <Section
      index={4}
      eyebrow="Territoires"
      title={t('home.mapTitle')}
      subtitle={t('home.mapSubtitle')}
      background={COLORS.naturalWhite}
    >
      <View style={[styles.mapLayout, wide ? styles.mapLayoutWide : null]}>
        <Reveal variant="up" style={styles.mapCard}>
          <Card tone="white" padded={false} style={styles.mapInner}>
            {isLoading ? (
              <View style={styles.mapLoading}>
                <LoadingState count={1} height={300} />
              </View>
            ) : isError ? (
              <View style={styles.mapLoading}>
                <ErrorState error={error} onRetry={() => void refetch()} />
              </View>
            ) : (
              <View style={styles.mapBody}>
                <MapPreview
                  pins={pins}
                  height={wide ? 380 : 300}
                  note={data?.meta.note}
                  onSelect={(slug) => router.push(`/public-site/farm/${slug}` as never)}
                />
              </View>
            )}
          </Card>
        </Reveal>

        <Reveal index={1} variant="right" style={styles.mapAside}>
          <Card tone="ink" style={styles.asideCard}>
            <Text preset="overline" color={COLORS.gold}>
              Pays représentés
            </Text>
            <Text preset="bodySm" color={DARK.textMuted} style={styles.asideNote}>
              Comptage effectué sur les points réellement publiés, pas sur une liste de pays cible.
            </Text>

            {isLoading ? (
              <Text preset="bodySm" color={DARK.textFaint}>
                Chargement…
              </Text>
            ) : entries.length === 0 ? (
              <Text preset="bodySm" color={DARK.textFaint}>
                Aucun point publié pour l’instant.
              </Text>
            ) : (
              <View style={styles.countryList}>
                {entries.map(([code, count]) => (
                  <View key={code} style={styles.countryRow}>
                    <Text preset="bodyMedium" color={DARK.text}>
                      {code}
                    </Text>
                    <View style={styles.countryBar}>
                      <View
                        style={[
                          styles.countryBarFill,
                          {
                            width: `${Math.max(6, Math.round((count / (entries[0]?.[1] ?? 1)) * 100))}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text preset="caption" color={COLORS.gold}>
                      {formatNumber(count, locale)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.asideFooter}>
              <Text preset="caption" color={DARK.textFaint}>
                Regroupement des points : côté client ({data?.meta.clustering ?? '—'}).
              </Text>
            </View>
          </Card>
        </Reveal>
      </View>
    </Section>
  );
}

/** Section 7 — profils producteurs publiés (données réelles, contacts masqués). */
export function FarmersSection() {
  const { t, locale } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { data, isLoading, isError, error, refetch } = usePublicFarms({ limit: 6 });
  const farms = data?.items ?? [];
  const total = data?.meta?.total;

  return (
    <Section
      index={5}
      eyebrow="Producteurs"
      title="Des profils, pas des promesses"
      subtitle="Chaque fiche publique affiche la surface déclarée, les cultures et le statut de vérification. Les coordonnées restent masquées tant que le producteur ne les publie pas."
      background={COLORS.pureWhite}
      action={{ label: t('common.seeAll'), onPress: () => router.push('/farmers') }}
    >
      {isLoading ? (
        <LoadingState count={3} height={180} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : farms.length === 0 ? (
        <EmptyState
          title="Aucun profil publié"
          description="Les producteurs publient leur fiche depuis leur espace. Revenez bientôt ou créez la vôtre."
          action={{ label: t('nav.signup'), onPress: () => router.push('/auth/register') }}
        />
      ) : (
        <View style={[styles.farmGrid, wide ? styles.farmGridWide : null]}>
          {farms.map((farm, index) => (
            <Reveal key={farm.slug} index={index % 3} variant="up" style={styles.farmItem}>
              <PressableCard
                onPress={() => router.push(`/public-site/farm/${farm.slug}` as never)}
                style={styles.farmCard}
              >
                <View style={styles.farmTop}>
                  <View style={styles.avatar}>
                    <Text preset="h3" color={COLORS.forestGreen}>
                      {farm.name.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <Chip
                    label={farm.verificationStatus ? 'Vérifié' : 'Déclaré'}
                    tone={farm.verificationStatus ? 'success' : 'neutral'}
                    icon={farm.verificationStatus ? 'shield-checkmark' : 'document-text-outline'}
                    size="sm"
                  />
                </View>

                <Text preset="h3" color={COLORS.textPrimary} numberOfLines={2}>
                  {farm.name}
                </Text>
                <View style={styles.farmMetaRow}>
                  <Ionicons name="location-outline" size={13} color={COLORS.slateGray} />
                  <Text preset="caption" color={COLORS.slateGray}>
                    {farm.countryCode}
                    {farm.province ? ` · ${farm.province}` : ''}
                  </Text>
                </View>

                {farm.description ? (
                  <Text preset="bodySm" color={COLORS.slateGray} numberOfLines={3} style={styles.farmDescription}>
                    {farm.description}
                  </Text>
                ) : null}

                <View style={styles.farmFooter}>
                  {farm.totalAreaHa !== null ? (
                    <Text preset="caption" color={COLORS.textPrimary}>
                      {formatNumber(farm.totalAreaHa, locale, 1)} ha
                    </Text>
                  ) : (
                    <Text preset="caption" color={COLORS.slateGray}>
                      Surface non déclarée
                    </Text>
                  )}
                  <ProvenanceTag kind={farm.verificationStatus ? 'verified' : 'declared'} />
                </View>

                {farm.crops.length > 0 ? (
                  <View style={styles.cropRow}>
                    {farm.crops.slice(0, 3).map((item) => (
                      <Chip key={item.crop.slug} label={cropLabel(item.crop.names, locale)} tone="living" size="sm" />
                    ))}
                  </View>
                ) : null}
              </PressableCard>
            </Reveal>
          ))}
        </View>
      )}

      <Reveal variant="fade">
        <View style={styles.farmCta}>
          <Text preset="bodySm" color={COLORS.slateGray}>
            {total !== undefined
              ? `${formatNumber(total, locale)} profils publics au total — pagination côté serveur.`
              : 'Annuaire chargé depuis GET /public/farms.'}
          </Text>
          <Button label={t('common.seeAll')} onPress={() => router.push('/farmers')} variant="outline" size="sm" />
        </View>
      </Reveal>
    </Section>
  );
}

function cropLabel(names: Record<string, string> | null, locale: string): string {
  if (!names) return 'Culture';
  return names[locale] ?? names.fr ?? Object.values(names)[0] ?? 'Culture';
}

const styles = StyleSheet.create({
  mapLayout: { gap: SPACING.lg },
  mapLayoutWide: { flexDirection: 'row', alignItems: 'stretch' },
  mapCard: { flex: 1.6 },
  mapInner: { padding: SPACING.md },
  mapLoading: { padding: SPACING.md },
  mapBody: { gap: SPACING.sm },
  mapAside: { flex: 1 },
  asideCard: { gap: SPACING.md, height: '100%' },
  asideNote: { lineHeight: 19 },
  countryList: { gap: SPACING.md },
  countryRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  countryBar: { flex: 1, height: 6, borderRadius: RADIUS.pill, backgroundColor: 'rgba(246,247,242,0.12)' },
  countryBarFill: { height: 6, borderRadius: RADIUS.pill, backgroundColor: COLORS.livingGreen },
  asideFooter: { marginTop: 'auto' },
  farmGrid: { gap: SPACING.md },
  farmGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  farmItem: { flex: 1, minWidth: 270 },
  farmCard: { gap: SPACING.sm, height: '100%' },
  farmTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: TINTS.forestGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  farmMetaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  farmDescription: { lineHeight: 20 },
  farmFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  cropRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.xs },
  farmCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    marginTop: SPACING.xl,
    flexWrap: 'wrap',
  },
});
