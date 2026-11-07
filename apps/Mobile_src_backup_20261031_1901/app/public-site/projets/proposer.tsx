import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { AuthGate, Button, Card, ErrorState, Input, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * Proposition de projet.
 *
 * Le backend n'expose pas de `POST /projects` : la création passe par
 * l'espace producteur (`/farmer/projects/new`). Cet écran collecte l'intention
 * et indique explicitement qu'aucun envoi n'est effectué ici.
 */
export default function PublicSiteProjetsProposer() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<unknown>(null);

  return (
    <PublicShell active="projets" footer={false}>
      <PageHeader index="15" eyebrow="Investissement" title="Proposer un projet" subtitle="Décrivez votre projet ; la soumission se finalise depuis l\u2019espace producteur." />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Proposer un projet" icon="add-circle-outline">
          <Card tone="white">
            <View style={styles.form}>
              <Input label="Titre *" value={title} onChangeText={setTitle} />
              <Input label="Description" value={summary} onChangeText={setSummary} multiline />
              {error ? <ErrorState error={error} /> : null}
              <Text preset="caption" color={COLORS.slateGray}>
                La création d\u2019un projet n\u2019est pas ouverte sur cet écran : poursuivez depuis l\u2019espace producteur, où les pièces et le consentement sont demandés.
              </Text>
              <Button
                label="Continuer dans l\u2019espace producteur"
                variant="primary"
                onPress={() => setError(new Error('Utilisez /farmer/projects/new pour soumettre le projet.'))}
                disabled={title.trim().length === 0}
              />
            </View>
          </Card>
        </AuthGate>
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, form: { gap: SPACING.md } });
