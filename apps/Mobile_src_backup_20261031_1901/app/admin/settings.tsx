import { StyleSheet } from 'react-native';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Screen, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function AdminSettings() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Paramètres" subtitle="Configuration de la plateforme." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Paramètres" icon="settings-outline">
          <Card tone="white">
            <Text preset="h3" style={styles.mb}>Configuration générale</Text>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
              Paramètres de la plateforme : seuils de k-anonymat, durées de conservation, canaux de notification, langues supportées.
            </Text>
          </Card>
          <Card tone="pale">
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
              Toute modification de configuration est journalisée avec son auteur et son horodatage.
            </Text>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, mb: { marginBottom: SPACING.sm }, lineHeight: { lineHeight: 20 } });
