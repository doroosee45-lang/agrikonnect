import { StyleSheet, View } from 'react-native';
import { router, usePathname } from 'expo-router';

import { PublicShell } from '@/components/public-site/PublicShell';
import { Button, Card, Reveal, Section, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function NotFound() {
  const pathname = usePathname();

  return (
    <PublicShell active="accueil">
      <Section contentStyle={styles.section}>
        <Reveal variant="scale">
          <Card tone="white" style={styles.card}>
            <Text preset="overline" color={COLORS.gold}>
              Erreur 404
            </Text>
            <Text preset="display" color={COLORS.textPrimary}>
              Cette page n’existe pas
            </Text>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
              Le chemin « {pathname} » ne correspond à aucun écran de l’application.
            </Text>
            <View style={styles.actions}>
              <Button label="Retour à l’accueil" onPress={() => router.replace('/accueil')} variant="primary" icon="home-outline" />
              <Button label="Voir l’annuaire" onPress={() => router.push('/farmers')} variant="outline" />
            </View>
          </Card>
        </Reveal>
      </Section>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 120, paddingBottom: 80 },
  lineHeight: { lineHeight: 20 },
  card: { gap: SPACING.sm, maxWidth: 520, alignSelf: 'center', width: '100%' },
  actions: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap', marginTop: SPACING.sm },
});
