import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { IconButton, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { LAYOUT, SPACING } from '@/theme/space';

/**
 * En-tête des écrans d'une parcelle : retour vers le pilotage de la parcelle,
 * titre de l'écran et rappel de la parcelle concernée.
 */
export function PlotScreenHeader({ title, plotName, plotId }: { title: string; plotName?: string; plotId?: string }) {
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.row}>
          <IconButton
            icon="chevron-back"
            onPress={() => (plotId ? router.replace(`/farmer/plots/${plotId}` as never) : router.back())}
            accessibilityLabel="Retour"
          />
          <View style={styles.titles}>
            <Text preset="overline" color={COLORS.livingGreen}>
              {plotName ?? 'Parcelle'}
            </Text>
            <Text preset="h2" color={COLORS.textPrimary}>
              {title}
            </Text>
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
});
