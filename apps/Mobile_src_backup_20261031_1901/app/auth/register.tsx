import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { AuthShell } from '@/components/auth/AuthShell';
import { Button, Card, ChipRow, Divider, ErrorState, FilterChip, Input, PressableScale, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { SELF_SERVICE_ROLES } from '@/lib/platform';
import { COLORS, TINTS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { RequestError, type SelfServiceAccountType } from '@/services/api/types';
import { useAuthStore } from '@/store/auth';

export default function Register() {
  const { t } = useI18n();
  const { email: presetEmail } = useLocalSearchParams<{ email?: string }>();
  const register = useAuthStore((state) => state.register);
  const busy = useAuthStore((state) => state.busy);

  const [accountType, setAccountType] = useState<SelfServiceAccountType>('FARMER');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState((presetEmail as string) ?? '');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [countryCode, setCountryCode] = useState('CI');
  const [error, setError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);

  const emailInvalid = touched && email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const missingContact = touched && !email.trim() && !phone.trim();
  const passwordShort = touched && password.length < 8;
  const countryInvalid = touched && countryCode.trim().length !== 2;

  const submit = async () => {
    setTouched(true);
    setError(null);
    setFieldErrors({});
    if (missingContact || emailInvalid || passwordShort || countryInvalid) return;

    try {
      await register({
        accountType,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        password,
        countryCode: countryCode.trim().toUpperCase(),
        locale: 'fr',
      });
      router.replace('/farmer');
    } catch (caught) {
      setError(caught);
      const requestError = caught instanceof RequestError ? caught : null;
      if (requestError?.fields?.length) {
        setFieldErrors(
          Object.fromEntries(requestError.fields.map((field) => [field.field, field.message ?? field.code ?? 'Invalide'])),
        );
      }
    }
  };

  return (
    <AuthShell title={t('auth.signupTitle')} subtitle="Choisissez votre rôle, renseignez votre identité. Les rôles de contrôle ne sont jamais attribués à l’inscription.">
      <View style={styles.form}>
        <View style={styles.block}>
          <Text preset="caption" color={COLORS.textPrimary}>
            {t('auth.role')}
          </Text>
          <ChipRow>
            {SELF_SERVICE_ROLES.map((role) => (
              <FilterChip
                key={role.id}
                label={role.label}
                active={accountType === role.id}
                onPress={() => setAccountType(role.id as SelfServiceAccountType)}
              />
            ))}
          </ChipRow>
        </View>

        <View style={styles.row}>
          <Input
            label={t('auth.firstName')}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Aminata"
            icon="person-outline"
            autoCapitalize="words"
            error={fieldErrors.firstName ?? null}
          />
          <Input
            label={t('auth.lastName')}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Koné"
            autoCapitalize="words"
            error={fieldErrors.lastName ?? null}
          />
        </View>

        <Input
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          onBlur={() => setTouched(true)}
          placeholder="vous@exemple.com"
          icon="mail-outline"
          autoCapitalize="none"
          keyboardType="email-address"
          optionalLabel={phone.trim() ? undefined : 'requis si pas de téléphone'}
          error={fieldErrors.email ?? (emailInvalid ? 'Adresse e-mail invalide.' : missingContact ? 'Un e-mail ou un téléphone est requis.' : null)}
        />

        <Input
          label={t('auth.phone')}
          value={phone}
          onChangeText={setPhone}
          onBlur={() => setTouched(true)}
          placeholder="+225 07 00 00 00 00"
          icon="call-outline"
          keyboardType="phone-pad"
          optionalLabel={email.trim() ? undefined : 'requis si pas d’e-mail'}
          helper="Format international, 8 à 15 chiffres après le +."
          error={fieldErrors.phone ?? null}
        />

        <View style={styles.row}>
          <Input
            label={t('auth.country')}
            value={countryCode}
            onChangeText={(value) => setCountryCode(value.toUpperCase().slice(0, 2))}
            onBlur={() => setTouched(true)}
            placeholder="CI"
            icon="globe-outline"
            autoCapitalize="characters"
            maxLength={2}
            error={fieldErrors.countryCode ?? (countryInvalid ? 'Code pays à 2 lettres.' : null)}
          />
          <Input
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            onBlur={() => setTouched(true)}
            placeholder="8 caractères minimum"
            icon="lock-closed-outline"
            secure
            error={fieldErrors.password ?? (passwordShort ? '8 caractères minimum.' : null)}
          />
        </View>

        {accountType === 'COOPERATIVE_ADMIN' ? (
          <Card tone="pale" style={styles.notice}>
            <Text preset="bodySm" color={COLORS.slateGray} style={styles.lineHeight}>
              Une organisation de type coopérative sera créée avec votre compte. Vous pourrez renseigner son
              nom et ses membres depuis votre espace.
            </Text>
          </Card>
        ) : null}

        {error ? <ErrorState error={error} showRequestId /> : null}

        <Button label={t('auth.signupCta')} onPress={() => void submit()} variant="primary" size="lg" fullWidth loading={busy} />

        <Divider label="ou" />

        <View style={styles.footer}>
          <Text preset="bodySm" color={COLORS.slateGray}>
            {t('auth.hasAccount')}
          </Text>
          <PressableScale onPress={() => router.push('/auth/login')}>
            <Text preset="bodyMedium" color={COLORS.forestGreen}>
              {t('nav.login')}
            </Text>
          </PressableScale>
        </View>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: SPACING.md },
  block: { gap: SPACING.sm },
  row: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
  lineHeight: { lineHeight: 20 },
  notice: { backgroundColor: TINTS.goldBg },
  footer: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, justifyContent: 'center' },
});
