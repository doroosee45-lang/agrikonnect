import { StyleSheet } from 'react-native';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Screen, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function AdminCompliance() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Conformité" subtitle="RGPD, conservation des données, droits des personnes." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Conformité" icon="shield-checkmark-outline">
          <Card tone="white">
            <Text preset="h3" style={styles.mb}>Registre des traitements</Text>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
              Chaque traitement de données personnelles est documenté : finalité, base légale, durée de conservation, destinataires.
            </Text>
          </Card>
          <Card tone="white">
            <Text preset="h3" style={styles.mb}>Droits des personnes</Text>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
              Accès, rectification, effacement, opposition, portabilité : chaque demande est tracée et traitée dans les délais légaux.
            </Text>
          </Card>
          <Card tone="pale">
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
              Les durées de conservation par défaut sont affichées dans les conditions d'utilisation. Aucune donnée n'est conservée au-delà de la durée nécessaire à la finalité déclarée.
            </Text>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, mb: { marginBottom: SPACING.sm }, lineHeight: { lineHeight: 20 } });
