import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Card, ErrorState, Input, Screen, Section, Text } from '@/components/ui';
import { authApi } from '@/services/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';

export default function AgentRegistration() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [countryCode, setCountryCode] = useState('CD');
  const [error, setError] = useState<unknown>(null);

  const register = useMutation({
    mutationFn: () => authApi.register({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined, password, countryCode, accountType: 'FARMER' }),
    onSuccess: () => { setError(null); router.push('/agent/consent'); },
    onError: (caught) => setError(caught),
  });

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('ui.inscriptionDUnProducteur')} subtitle={t('ui.enregistrezUnProducteurPourLequelVous')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.inscriptionDUnProducteur')} description={t('ui.vousAgissezPourLeCompteD')} icon="person-add-outline">
          <Card tone="white">
            <View style={styles.form}>
              <View style={styles.row2}>
                <Input label={t('ui.prenom')} value={firstName} onChangeText={setFirstName} />
                <Input label={t('ui.nom')} value={lastName} onChangeText={setLastName} />
              </View>
              <Input label={t('ui.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <Input label={t('ui.telephone_d3b02')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <Input label={t('ui.motDePasse')} value={password} onChangeText={setPassword} secureTextEntry />
              <Input label={t('ui.codePays')} value={countryCode} onChangeText={(v) => setCountryCode(v.toUpperCase().slice(0, 2))} maxLength={2} />
              {error ? <ErrorState error={error} /> : null}
              <Button label={t('ui.creerLeCompte')} onPress={() => register.mutate()} loading={register.isPending} disabled={!firstName.trim() || !lastName.trim() || !password} />
            </View>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, form: { gap: SPACING.md }, row2: { flexDirection: 'row', gap: SPACING.sm } });
