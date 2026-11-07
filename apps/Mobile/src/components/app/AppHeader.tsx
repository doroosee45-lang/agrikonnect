import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { IconButton, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { LAYOUT, SPACING } from '@/theme/space';

/**
 * En-tête des écrans applicatifs authentifiés (hors espace producteur) :
 * retour, titre, sous-titre et raccourcis notifications / profil.
 */
export function AppHeader({
  title,
  subtitle,
  back = true,
  showNotifications = true,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  showNotifications?: boolean;
}) {
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.row}>
          {back ? <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="Retour" /> : null}
          <View style={styles.titles}>
            <Text preset="h2" color={COLORS.textPrimary}>
              {title}
            </Text>
            {subtitle ? (
              <Text preset="caption" color={COLORS.slateGray} style={styles.subtitle}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <View style={styles.actions}>
            <IconButton icon="globe-outline" onPress={() => router.push('/accueil')} accessibilityLabel="Visiter le site public" />
            {showNotifications ? (
              <IconButton icon="notifications-outline" onPress={() => router.push('/notifications')} accessibilityLabel="Notifications" />
            ) : null}
            <IconButton icon="person-outline" onPress={() => router.push('/profil')} accessibilityLabel="Profil" />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: COLORS.naturalWhite },
  header: { paddingHorizontal: LAYOUT.screenPadding, paddingBottom: SPACING.md, paddingTop: SPACING.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  titles: { flex: 1, gap: 2 },
  subtitle: { lineHeight: 18 },
  actions: { flexDirection: 'row', gap: SPACING.sm },
});
