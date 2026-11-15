import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Card, ErrorState, Input, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { organizationApi } from '@/services/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function OrganizationCreate() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [type, setType] = useState('COOPERATIVE');
  const [countryCode, setCountryCode] = useState('');
  const [error, setError] = useState<unknown>(null);

  const create = useMutation({
    mutationFn: () => organizationApi.create({ name, type, countryCode }),
    onSuccess: () => { setError(null); router.push('/organization'); },
    onError: (caught) => setError(caught),
  });

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('ui.creerUneOrganisation')} subtitle={t('ui.enregistrezVotreOrganisation')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.creerUneOrganisation')} icon="business-outline">
          <Card tone="white">
            <View style={styles.form}>
              <Input label={t('ui.nom')} value={name} onChangeText={setName} />
              <Input label={t('ui.type')} value={type} onChangeText={setType} />
              <Input label={t('ui.pays')} value={countryCode} onChangeText={setCountryCode} />
              {error ? <ErrorState error={error} /> : null}
              <Text preset="caption" color={COLORS.slateGray}>{t('ui.lesChampsMarquesDUnAsterisque')}</Text>
              <Button label={t('ui.creer')} onPress={() => create.mutate()} loading={create.isPending} disabled={name.trim().length === 0} />
            </View>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, form: { gap: SPACING.md } });
