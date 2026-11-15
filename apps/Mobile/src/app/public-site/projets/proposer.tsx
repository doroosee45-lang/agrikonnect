import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { AuthGate, Button, Card, ErrorState, Input, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';

/**
 * Proposition de projet.
 *
 * Le backend n'expose pas de `POST /projects` : la création passe par
 * l'espace producteur (`/farmer/projects/new`). Cet écran collecte l'intention
 * et indique explicitement qu'aucun envoi n'est effectué ici.
 */
export default function PublicSiteProjetsProposer() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<unknown>(null);

  return (
    <PublicShell active="projets" footer={false}>
      <PageHeader index="15" eyebrow={t('ui.investissement')} title={t('ui.proposerUnProjet')} subtitle={t('ui.decrivezVotreProjetLaSoumissionSe')} />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.proposerUnProjet')} icon="add-circle-outline">
          <Card tone="white">
            <View style={styles.form}>
              <Input label={t('ui.titre_dbeb7')} value={title} onChangeText={setTitle} />
              <Input label={t('ui.description')} value={summary} onChangeText={setSummary} multiline />
              {error ? <ErrorState error={error} /> : null}
              <Text preset="caption" color={COLORS.slateGray}>{t('ui.laCreationDUnProjetN')}</Text>
              <Button
                label={t('ui.continuerDansLEspaceProducteur')}
                variant="primary"
                onPress={() => setError(new Error(t('ui.utilisezFarmerProjectsNewPourSoumettre')))}
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
