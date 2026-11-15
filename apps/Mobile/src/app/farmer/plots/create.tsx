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
import { useI18n } from '@/i18n';

export default function FarmerPlotCreate() {
  const { t } = useI18n();
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
      <FarmerHeader title={t('ui.nouvelleParcelle')} subtitle={t('ui.laLocalisationSaisieEstApproximative')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.nouvelleParcelle')} icon="add-circle-outline">
          <Card tone="white">
            <View style={styles.form}>
              <Input label={t('ui.exploitationId')} value={farmId} onChangeText={setFarmId} />
              <Input label={t('ui.nom')} value={name} onChangeText={setName} />
              <Input label={t('ui.surfaceHa')} value={areaHa} onChangeText={setAreaHa} keyboardType="numeric" />
              {error ? <ErrorState error={error} /> : null}
              <Button label={t('ui.creer')} onPress={() => create.mutate()} loading={create.isPending} disabled={!name.trim() || !farmId.trim()} />
            </View>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, form: { gap: SPACING.md } });
