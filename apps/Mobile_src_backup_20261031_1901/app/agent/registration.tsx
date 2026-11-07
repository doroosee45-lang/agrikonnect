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

export default function AgentRegistration() {
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
      <AppHeader title="Inscription d'un producteur" subtitle="Enregistrez un producteur pour lequel vous intervenez." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Inscription d'un producteur" description="Vous agissez pour le compte d'un producteur. Le consentement doit être enregistré avant toute saisie." icon="person-add-outline">
          <Card tone="white">
            <View style={styles.form}>
              <View style={styles.row2}>
                <Input label="Prénom" value={firstName} onChangeText={setFirstName} />
                <Input label="Nom" value={lastName} onChangeText={setLastName} />
              </View>
              <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <Input label="Téléphone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <Input label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
              <Input label="Code pays" value={countryCode} onChangeText={(v) => setCountryCode(v.toUpperCase().slice(0, 2))} maxLength={2} />
              {error ? <ErrorState error={error} /> : null}
              <Button label="Créer le compte" onPress={() => register.mutate()} loading={register.isPending} disabled={!firstName.trim() || !lastName.trim() || !password} />
            </View>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, form: { gap: SPACING.md }, row2: { flexDirection: 'row', gap: SPACING.sm } });
