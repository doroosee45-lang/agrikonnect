import { StyleSheet } from 'react-native';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Screen, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function AdminPartners() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Partenaires" subtitle="Organisations partenaires." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Partenaires" icon="people-outline">
          <Card tone="white">
            <Text preset="h3" style={styles.mb}>Réseau de partenaires</Text>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
              Les partenaires (ONG, institutions, acheteurs) sont référencés ici. Chaque partenariat est formalisé par un accord.
            </Text>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, mb: { marginBottom: SPACING.sm }, lineHeight: { lineHeight: 20 } });
