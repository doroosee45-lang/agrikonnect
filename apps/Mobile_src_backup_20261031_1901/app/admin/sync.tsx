import { StyleSheet } from 'react-native';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Screen, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function AdminSync() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Synchronisation" subtitle="État de synchronisation des données." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Synchronisation" icon="sync-outline">
          <Card tone="white">
            <Text preset="h3" style={styles.mb}>File de synchronisation</Text>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
              Les modifications hors ligne sont conservées localement puis réconciliées avec le serveur. Les conflits sont signalés et résolus manuellement.
            </Text>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, mb: { marginBottom: SPACING.sm }, lineHeight: { lineHeight: 20 } });
