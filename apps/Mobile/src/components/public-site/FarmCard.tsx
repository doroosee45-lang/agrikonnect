import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Chip, PressableCard, ProvenanceTag, Text } from '@/components/ui';
import { formatNumber, type Locale } from '@/lib/format';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';
import type { PublicFarmListItem } from '@/services/api/types';

/** Carte d'annuaire : fiche publique d'un producteur (données réelles). */
export function FarmCard({
  farm,
  locale = 'fr',
  compact = false,
}: {
  farm: PublicFarmListItem;
  locale?: Locale;
  compact?: boolean;
}) {
  const crops = farm.crops
    .map((item) => item.crop.names?.[locale] ?? item.crop.names?.fr ?? item.crop.slug)
    .slice(0, compact ? 2 : 3);

  return (
    <PressableCard
      onPress={() => router.push(`/public-site/farm/${farm.slug}` as never)}
      style={styles.card}
    >
      <View style={styles.top}>
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

      <View style={styles.metaRow}>
        <Ionicons name="location-outline" size={13} color={COLORS.slateGray} />
        <Text preset="caption" color={COLORS.slateGray}>
          {farm.countryCode}
          {farm.province ? ` · ${farm.province}` : ''}
        </Text>
      </View>

      {!compact && farm.description ? (
        <Text preset="bodySm" color={COLORS.slateGray} numberOfLines={3} style={styles.description}>
          {farm.description}
        </Text>
      ) : null}

      <View style={styles.footer}>
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

      {crops.length > 0 ? (
        <View style={styles.crops}>
          {crops.map((crop) => (
            <Chip key={crop} label={crop} tone="living" size="sm" />
          ))}
        </View>
      ) : null}
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACING.sm, height: '100%' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: TINTS.forestGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  description: { lineHeight: 20 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  crops: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
});
