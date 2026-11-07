import { StyleSheet } from 'react-native';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Screen, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function AdminModeration() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Modération" subtitle="Signalements et contenu à modérer." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Modération" icon="flag-outline">
          <Card tone="white">
            <Text preset="h3" style={styles.mb}>File de modération</Text>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
              Les signalements de contenu inapproprié apparaissent ici. Chaque décision de modération est motivée et tracée.
            </Text>
          </Card>
          <Card tone="pale">
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
              La modération respecte le contradictoire : l'auteur du contenu est informé de la décision et peut contester.
            </Text>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, mb: { marginBottom: SPACING.sm }, lineHeight: { lineHeight: 20 } });
