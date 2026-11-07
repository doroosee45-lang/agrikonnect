import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Button, Card, ErrorState, Input, Screen, Section, Text } from '@/components/ui';
import { plotApi } from '@/services/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function FarmerPlotCreate() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [farmId, setFarmId] = useState('');
  const [name, setName] = useState('');
  const [areaHa, setAreaHa] = useState('');
  const [error, setError] = useState<unknown>(null);

  const create = useMutation({
    mutationFn: () => plotApi.create({ farmId: farmId.trim(), name: name.trim(), areaHa: areaHa ? Number(areaHa) : undefined }),
    onSuccess: () => { setError(null); router.push('/farmer/plots'); },
    onError: (caught) => setError(caught),
  });

  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title="Nouvelle parcelle" subtitle="La localisation saisie est approximative." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Nouvelle parcelle" icon="add-circle-outline">
          <Card tone="white">
            <View style={styles.form}>
              <Input label="Exploitation (ID)" value={farmId} onChangeText={setFarmId} />
              <Input label="Nom" value={name} onChangeText={setName} />
              <Input label="Surface (ha)" value={areaHa} onChangeText={setAreaHa} keyboardType="numeric" />
              {error ? <ErrorState error={error} /> : null}
              <Button label="Créer" onPress={() => create.mutate()} loading={create.isPending} disabled={!name.trim() || !farmId.trim()} />
            </View>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, form: { gap: SPACING.md } });
