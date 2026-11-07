import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Card, ErrorState, Input, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function ProjetsProposer() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  const submit = () => {
    setPending(true);
    setError(null);
    setError(new Error("La création de projet depuis l'application est en cours d'activation."));
    setPending(false);
  };

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Proposer un projet" subtitle="Soumettez un projet d'investissement." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Proposer un projet" icon="add-circle-outline">
          <Card tone="white">
            <View style={styles.form}>
              <Input label="Titre" value={title} onChangeText={setTitle} />
              <Input label="Description" value={summary} onChangeText={setSummary} multiline />
              {error ? <ErrorState error={error} /> : null}
              <Text preset="caption" color={COLORS.slateGray}>{"Les champs marqués d'un astérisque sont obligatoires."}</Text>
              <Button label="Envoyer la proposition" onPress={submit} loading={pending} disabled={title.trim().length === 0} />
            </View>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, form: { gap: SPACING.md } });
