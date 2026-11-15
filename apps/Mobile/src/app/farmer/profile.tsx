import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Button, Card, Chip, ErrorState, Input, Screen, Section, Text } from '@/components/ui';
import { authApi } from '@/services/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';

export default function FarmerProfile() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const me = useAuthStore((state) => state.user);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const [firstName, setFirstName] = useState(me?.firstName ?? '');
  const [lastName, setLastName] = useState(me?.lastName ?? '');
  const [error, setError] = useState<unknown>(null);

  const save = useMutation({
    mutationFn: () => authApi.updateMe({ firstName: firstName.trim(), lastName: lastName.trim() }),
    onSuccess: () => { setError(null); void refreshProfile(); },
    onError: (caught) => setError(caught),
  });

  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title={t('ui.monProfil')} subtitle={t('ui.vosInformationsPersonnelles')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.monProfil')} icon="person-outline">
          <Card tone="white" style={styles.card}>
            <Text preset="bodySm">{t('ui.email_946f4', { value: me?.email ?? '—' })}</Text>
            <Text preset="bodySm">{t('ui.telephone', { value: me?.phone ?? '—' })}</Text>
            <View style={styles.chips}>
              <Chip label={me?.emailVerified ? t('ui.emailVerifie') : t('ui.emailNonVerifie')} tone={me?.emailVerified ? 'success' : 'warning'} size="sm" />
              <Chip label={me?.phoneVerified ? t('ui.telephoneVerifie_4fdf8') : t('ui.telephoneNonVerifie')} tone={me?.phoneVerified ? 'success' : 'warning'} size="sm" />
            </View>
          </Card>
          <Card tone="white">
            <View style={styles.form}>
              <View style={styles.row2}>
                <Input label={t('ui.prenom')} value={firstName} onChangeText={setFirstName} />
                <Input label={t('ui.nom')} value={lastName} onChangeText={setLastName} />
              </View>
              {error ? <ErrorState error={error} /> : null}
              <Button label={t('common.save')} onPress={() => save.mutate()} loading={save.isPending} />
            </View>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md }, card: { gap: SPACING.sm }, chips: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' }, form: { gap: SPACING.md }, row2: { flexDirection: 'row', gap: SPACING.sm } });
