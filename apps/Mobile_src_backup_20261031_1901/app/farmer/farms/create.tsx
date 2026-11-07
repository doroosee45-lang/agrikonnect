import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Button, Card, ErrorState, Input, Screen, Section, Text } from '@/components/ui';
import { farmApi } from '@/services/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function FarmerFarmCreate() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('CD');
  const [province, setProvince] = useState('');
  const [error, setError] = useState<unknown>(null);

  const create = useMutation({
    mutationFn: () => farmApi.create({ name: name.trim(), countryCode, province: province.trim() || undefined }),
    onSuccess: () => { setError(null); router.push('/farmer/farms'); },
    onError: (caught) => setError(caught),
  });

  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title="Nouvelle exploitation" subtitle="Les informations saisies sont marquées « déclarées »." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Nouvelle exploitation" icon="add-circle-outline">
          <Card tone="white">
            <View style={styles.form}>
              <Input label="Nom" value={name} onChangeText={setName} />
              <View style={styles.row2}>
                <Input label="Code pays" value={countryCode} onChangeText={(v) => setCountryCode(v.toUpperCase().slice(0, 2))} maxLength={2} />
                <Input label="Province" value={province} onChangeText={setProvince} />
              </View>
              {error ? <ErrorState error={error} /> : null}
              <Button label="Créer" onPress={() => create.mutate()} loading={create.isPending} disabled={!name.trim()} />
            </View>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, form: { gap: SPACING.md }, row2: { flexDirection: 'row', gap: SPACING.sm } });
