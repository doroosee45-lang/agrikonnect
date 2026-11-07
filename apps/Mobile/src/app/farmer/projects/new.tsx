import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Button, Card, ErrorState, Input, Screen, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function FarmerProjectNew() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  const submit = () => {
    setPending(true);
    setError(null);
    setError(new Error('La création de projet depuis l\u2019application est en cours d\u2019activation.'));
    setPending(false);
  };

  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title="Nouveau projet" subtitle="Proposez un projet d\u2019investissement." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Nouveau projet" icon="add-circle-outline">
          <Card tone="white">
            <View style={styles.form}>
              <Input label="Titre *" value={title} onChangeText={setTitle} />
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
