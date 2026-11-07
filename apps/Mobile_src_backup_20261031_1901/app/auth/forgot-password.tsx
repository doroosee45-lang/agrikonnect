import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AuthShell } from '@/components/auth/AuthShell';
import { Button, Card, ErrorState, Input, PressableScale, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { authApi } from '@/services/api/endpoints';

export default function ForgotPassword() {
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState('');
  const [touched, setTouched] = useState(false);

  const mutation = useMutation({
    mutationFn: () => authApi.forgotPassword(identifier.trim()),
  });

  const invalid = touched && identifier.trim().length < 3;

  return (
    <AuthShell
      title={t('auth.forgot')}
      subtitle="Indiquez l’e-mail ou le téléphone de votre compte. Si un compte correspond, un lien de réinitialisation est envoyé."
    >
      <View style={styles.form}>
        <Input
          label={t('auth.email')}
          value={identifier}
          onChangeText={setIdentifier}
          onBlur={() => setTouched(true)}
          placeholder="vous@exemple.com ou +225…"
          icon="mail-outline"
          autoCapitalize="none"
          autoCorrect={false}
          error={invalid ? 'Renseignez un e-mail ou un téléphone.' : null}
        />

        {mutation.isError ? <ErrorState error={mutation.error} showRequestId /> : null}

        {mutation.isSuccess ? (
          <Card tone="pale" style={styles.success}>
            <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.success} />
            <Text preset="bodySm" color={COLORS.textPrimary} style={styles.lineHeight}>
              Si un compte correspond, un e-mail de réinitialisation vient d’être envoyé. Le lien expire
              rapidement : pensez à vérifier vos indésirables.
            </Text>
          </Card>
        ) : null}

        <Button
          label="Envoyer le lien"
          onPress={() => {
            setTouched(true);
            if (identifier.trim().length < 3) return;
            mutation.mutate();
          }}
          variant="primary"
          size="lg"
          fullWidth
          loading={mutation.isPending}
        />

        <PressableScale onPress={() => router.back()} style={styles.back}>
          <Text preset="caption" color={COLORS.forestGreen}>
            {t('common.back')}
          </Text>
        </PressableScale>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: SPACING.md },
  lineHeight: { lineHeight: 20 },
  success: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  back: { alignSelf: 'center' },
});
