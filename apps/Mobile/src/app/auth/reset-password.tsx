import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { Button, Card, ErrorState, Input, Screen, Section, Text } from '@/components/ui';
import { authApi } from '@/services/api/endpoints';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';

export default function AuthResetPassword() {
  const { t } = useI18n();
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
      <AppHeader title={t('ui.reinitialiserLeMotDePasse')} subtitle={t('ui.saisissezLeCodeRecuEtVotre')} />
      <Section bare contentStyle={styles.section}>
        <Card tone="white">
          {success ? (
            <View style={styles.success}>
              <Text preset="h3" color={COLORS.success} style={styles.mb}>{t('ui.motDePasseReinitialise')}</Text>
              <Button label={t('ui.seConnecter')} variant="outline" onPress={() => router.push('/auth/login')} />
            </View>
          ) : (
            <View style={styles.form}>
              <Input label={t('ui.codeDeReinitialisation')} value={token} onChangeText={setToken} />
              <Input label={t('ui.nouveauMotDePasse')} value={password} onChangeText={setPassword} secureTextEntry />
              {error ? <ErrorState error={error} /> : null}
              <Button label={t('ui.reinitialiser')} onPress={() => reset.mutate()} loading={reset.isPending} disabled={!token || !password} />
            </View>
          )}
        </Card>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, form: { gap: SPACING.md }, success: { gap: SPACING.md, alignItems: 'center', paddingVertical: SPACING.lg }, mb: { marginBottom: SPACING.sm } });
