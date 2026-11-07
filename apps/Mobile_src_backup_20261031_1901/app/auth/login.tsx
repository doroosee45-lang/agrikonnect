import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { AuthShell } from '@/components/auth/AuthShell';
import { Button, Card, Divider, ErrorState, Input, PressableScale, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { RequestError } from '@/services/api/types';
import { useAuthStore } from '@/store/auth';

export default function Login() {
  const { t } = useI18n();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const login = useAuthStore((state) => state.login);
  const busy = useAuthStore((state) => state.busy);
  const pendingMfa = useAuthStore((state) => state.pendingMfa);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (pendingMfa) {
      setIdentifier(pendingMfa.identifier);
      setPassword(pendingMfa.password);
    }
  }, [pendingMfa]);

  const submit = async () => {
    setError(null);
    setFieldErrors({});
    try {
      await login({ identifier: identifier.trim(), password, mfaCode: mfaCode.trim() || undefined });
      router.replace((next as string) || '/farmer');
    } catch (caught) {
      const requestError = caught instanceof RequestError ? caught : null;
      setError(caught);
      if (requestError?.fields?.length) {
        setFieldErrors(
          Object.fromEntries(requestError.fields.map((field) => [field.field, field.message ?? field.code ?? 'Invalide'])),
        );
      }
    }
  };

  return (
    <AuthShell title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
      {pendingMfa ? (
        <Card tone="pale" style={styles.mfaNotice}>
          <Text preset="bodyMedium" color={COLORS.textPrimary}>
            {t('auth.mfaTitle')}
          </Text>
          <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
            {t('auth.mfaSubtitle')}
          </Text>
        </Card>
      ) : null}

      <View style={styles.form}>
        <Input
          label={t('auth.email')}
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="vous@exemple.com ou +225…"
          icon="person-outline"
          autoCapitalize="none"
          autoCorrect={false}
          error={fieldErrors.identifier ?? null}
        />
        <Input
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          icon="lock-closed-outline"
          secure
          error={fieldErrors.password ?? null}
        />

        {pendingMfa ? (
          <Input
            label={t('auth.mfaCode')}
            value={mfaCode}
            onChangeText={setMfaCode}
            placeholder="123456"
            icon="keypad-outline"
            keyboardType="number-pad"
            maxLength={14}
          />
        ) : null}

        <PressableScale onPress={() => router.push('/auth/forgot-password')} style={styles.link}>
          <Text preset="caption" color={COLORS.forestGreen}>
            {t('auth.forgot')}
          </Text>
        </PressableScale>

        {error ? <ErrorState error={error} showRequestId /> : null}

        <Button label={t('auth.loginCta')} onPress={() => void submit()} variant="primary" size="lg" fullWidth loading={busy} />

        <Divider label="ou" />

        <View style={styles.footer}>
          <Text preset="bodySm" color={COLORS.slateGray}>
            {t('auth.noAccount')}
          </Text>
          <PressableScale onPress={() => router.push('/auth/register')}>
            <Text preset="bodyMedium" color={COLORS.forestGreen}>
              {t('nav.signup')}
            </Text>
          </PressableScale>
        </View>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: SPACING.md },
  lineHeight: { lineHeight: 20 },
  mfaNotice: { gap: SPACING.xs },
  link: { alignSelf: 'flex-start' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, justifyContent: 'center' },
});
