import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { IconButton, Text } from '@/components/ui';
import { CREME, RAYON, TACTILE, VERT } from '@/theme/agrikonnect';
import { COLORS } from '@/theme/colors';
import { LAYOUT, SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';
import { getUserProfileRoute, getUserSettingsRoute, resolveActiveContext } from '@/lib/redirects';
import { useAuthStore } from '@/store/auth';

/**
 * En-tête Horizon des écrans applicatifs authentifiés (Mobile) :
 * retour optionnel, titre + sous-titre, CTA contextuel vert Horizon,
 * et raccourcis site public / notifications / profil.
 */
export function AppHeader({
  title,
  subtitle,
  back = true,
  showNotifications = true,
  ctaLabel,
  onCtaPress,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  showNotifications?: boolean;
  ctaLabel?: string;
  onCtaPress?: () => void;
}) {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const permissions = useAuthStore((state) => state.permissions);
  const context = resolveActiveContext(user);
  const roles = context.roles;
  const profileRoute = getUserProfileRoute(roles);
  const settingsRoute = getUserSettingsRoute(roles, permissions);
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.row}>
          {back ? <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel={t('common.back')} /> : null}
          <View style={styles.titles}>
            <Text preset="h2" color={COLORS.textPrimary} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text preset="caption" color={COLORS.slateGray} style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <View style={styles.actions}>
            {ctaLabel && onCtaPress ? (
              <Pressable
                onPress={onCtaPress}
                accessibilityRole="button"
                accessibilityLabel={ctaLabel}
                style={({ pressed }) => [styles.cta, pressed ? styles.ctaPressed : null]}
              >
                <Ionicons name="add" size={16} color={COLORS.pureWhite} />
                <Text preset="caption" color={COLORS.pureWhite} style={styles.ctaText}>
                  {ctaLabel}
                </Text>
              </Pressable>
            ) : null}
            <IconButton icon="globe-outline" onPress={() => router.push('/accueil')} accessibilityLabel={t('ui.visiterLeSitePublic')} />
            {showNotifications ? (
              <IconButton icon="notifications-outline" onPress={() => router.push('/notifications')} accessibilityLabel={t('ui.notifications')} />
            ) : null}
            <IconButton icon="person-outline" onPress={() => router.push(profileRoute as never)} accessibilityLabel={t('ui.profil')} />
            <IconButton icon="settings-outline" onPress={() => router.push(settingsRoute as never)} accessibilityLabel={t('ui.parametres_ef8f0')} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: COLORS.pureWhite,
    borderBottomWidth: 1,
    borderBottomColor: CREME[200],
  },
  header: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingBottom: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  titles: { flex: 1, gap: 2 },
  subtitle: { lineHeight: 18 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  cta: {
    minHeight: TACTILE.mobile - 6,
    paddingHorizontal: SPACING.sm,
    borderRadius: RAYON.pilule,
    backgroundColor: VERT[800],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ctaPressed: { opacity: 0.88 },
  ctaText: { fontWeight: '700' },
});
