import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { Button, Card, ErrorState, Input, Screen, Section, Text } from '@/components/ui';
import { authApi } from '@/services/api/endpoints';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function AuthResetPassword() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState(false);

  const reset = useMutation({
    mutationFn: () => authApi.resetPassword({ token, password }),
    onSuccess: () => { setError(null); setSuccess(true); },
    onError: (caught) => setError(caught),
  });

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Réinitialiser le mot de passe" subtitle="Saisissez le code reçu et votre nouveau mot de passe." />
      <Section bare contentStyle={styles.section}>
        <Card tone="white">
          {success ? (
            <View style={styles.success}>
              <Text preset="h3" color={COLORS.success} style={styles.mb}>Mot de passe réinitialisé</Text>
              <Button label="Se connecter" variant="outline" onPress={() => router.push('/auth/login')} />
            </View>
          ) : (
            <View style={styles.form}>
              <Input label="Code de réinitialisation" value={token} onChangeText={setToken} />
              <Input label="Nouveau mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
              {error ? <ErrorState error={error} /> : null}
              <Button label="Réinitialiser" onPress={() => reset.mutate()} loading={reset.isPending} disabled={!token || !password} />
            </View>
          )}
        </Card>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, form: { gap: SPACING.md }, success: { gap: SPACING.md, alignItems: 'center', paddingVertical: SPACING.lg }, mb: { marginBottom: SPACING.sm } });
