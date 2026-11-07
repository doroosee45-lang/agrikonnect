import { Linking, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Card, Reveal, Screen, Section, Text } from '@/components/ui';
import { adminApi } from '@/services/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/** ADMIN — rapports et exports disponibles. */
export default function AdminReports() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Rapports" subtitle="Exports générés à la demande, tracés dans le journal d'audit." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Rapports" icon="document-text-outline">
          <View style={styles.list}>
            <Reveal index={0} variant="up">
              <Card tone="white" style={styles.row}>
                <View style={styles.rowBody}>
                  <Text preset="bodyMedium">Export des exploitations</Text>
                  <Text preset="caption" color={COLORS.slateGray}>
                    GET /admin/export/farms — fichier généré à la demande, accès tracé.
                  </Text>
                </View>
                <Button label="Télécharger" onPress={() => void Linking.openURL(adminApi.exportFarms())} variant="outline" size="sm" />
              </Card>
            </Reveal>

            <Card tone="pale">
              <Text preset="caption" color={COLORS.textPrimary}>
                Les exports ne contiennent jamais de coordonnées personnelles non nécessaires. Chaque téléchargement est journalisé avec son auteur et son horodatage.
              </Text>
            </Card>
          </View>
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  list: { gap: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  rowBody: { flex: 1, gap: 2 },
});
