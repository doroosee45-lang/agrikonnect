import { StyleSheet } from 'react-native';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Screen, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function AdminDataProducts() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Produits de données" subtitle="Catalogue des jeux de données exposés." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Produits de données" icon="server-outline">
          <Card tone="white">
            <Text preset="h3" style={styles.mb}>Catalogue</Text>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
              Les produits de données sont exposés via l'API publique. Chaque produit documente sa source, sa fraîcheur et ses conditions d'utilisation.
            </Text>
          </Card>
          <Card tone="pale">
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
              Aucune donnée personnelle n'est exposée dans les produits de données. Les agrégats respectent le seuil de k-anonymat configuré.
            </Text>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, mb: { marginBottom: SPACING.sm }, lineHeight: { lineHeight: 20 } });
