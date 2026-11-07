import { StyleSheet } from 'react-native';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Card, Screen, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function AdminRules() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Règles" subtitle="Jeux de règles versionnés (sol, rotation, compatibilité)." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Règles" icon="git-branch-outline">
          <Card tone="white">
            <Text preset="h3" style={styles.mb}>Versionnage des règles</Text>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
              Chaque jeu de règles est versionné. Une modification crée une nouvelle version sans écraser l'ancienne. Les évaluations passées restent reproductibles.
            </Text>
          </Card>
          <Card tone="pale">
            <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
              Les règles de compatibilité culturale, de rotation et de diagnostic de sol sont publiées et consultables. Aucune règle n'est appliquée rétroactivement.
            </Text>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, mb: { marginBottom: SPACING.sm }, lineHeight: { lineHeight: 20 } });
