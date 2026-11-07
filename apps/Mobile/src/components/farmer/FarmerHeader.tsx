import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';

import { IconButton, PressableScale, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { COLORS, TINTS } from '@/theme/colors';
import { DURATION, EASE } from '@/theme/motion';
import { LAYOUT, RADIUS, SPACING } from '@/theme/space';
import { useAuthStore } from '@/store/auth';

/**
 * En-tête de l'espace producteur : identité, complétude du dossier et accès
 * rapides au profil et aux notifications.
 */
export function FarmerHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const completeness = useAuthStore((state) => state.completeness);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming((completeness?.percent ?? 0) / 100, {
      duration: DURATION.reveal,
      easing: EASE.emphasize,
    });
  }, [completeness?.percent, progress]);

  const bar = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.row}>
          <PressableScale onPress={() => router.push('/profil')} style={styles.identity}>
            <View style={styles.avatar}>
              <Text preset="caption" color={COLORS.forestGreen}>
                {`${user?.firstName?.slice(0, 1) ?? ''}${user?.lastName?.slice(0, 1) ?? ''}`.toUpperCase()}
              </Text>
            </View>
            <View>
              <Text preset="caption" color={COLORS.slateGray}>
                {t('farmer.title')}
              </Text>
              <Text preset="bodyMedium" color={COLORS.textPrimary}>
                {user ? `${user.firstName} ${user.lastName}` : '—'}
              </Text>
            </View>
          </PressableScale>

          <View style={styles.actions}>
            <IconButton icon="globe-outline" onPress={() => router.push('/accueil')} accessibilityLabel="Visiter le site public" />
            <IconButton icon="notifications-outline" onPress={() => router.push('/notifications')} accessibilityLabel={t('nav.notifications')} />
            <IconButton icon="settings-outline" onPress={() => router.push('/profil')} accessibilityLabel={t('nav.profile')} />
          </View>
        </View>

        <View style={styles.titleBlock}>
          <Text preset="h1" color={COLORS.textPrimary}>
            {title}
          </Text>
          {subtitle ? (
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {completeness ? (
          <PressableScale onPress={() => router.push('/profil')} style={styles.completeness}>
            <View style={styles.completenessRow}>
              <Ionicons name="checkmark-done-outline" size={14} color={COLORS.livingGreen} />
              <Text preset="caption" color={COLORS.slateGray}>
                Dossier complété à {completeness.percent} %
              </Text>
              {completeness.missing.length > 0 ? (
                <Text preset="caption" color={COLORS.forestGreen}>
                  {completeness.missing.length} restant(s)
                </Text>
              ) : null}
            </View>
            <View style={styles.track}>
              <Animated.View style={[styles.fill, bar]} />
            </View>
          </PressableScale>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: COLORS.naturalWhite },
  header: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.sm,
    gap: SPACING.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: TINTS.livingGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  titleBlock: { gap: 2 },
  subtitle: { lineHeight: 19 },
  completeness: { gap: SPACING.xs },
  completenessRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  track: { height: 6, borderRadius: RADIUS.pill, backgroundColor: TINTS.forestGreenBg, overflow: 'hidden' },
  fill: { height: 6, borderRadius: RADIUS.pill, backgroundColor: COLORS.livingGreen },
});
