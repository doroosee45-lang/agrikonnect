import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Button, Card, PressableScale, Screen, Section, Text } from '@/components/ui';
import { SUPPORTED_LOCALES, useI18n } from '@/i18n';
import { authApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';

function Row({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text preset="bodySm" style={{ flex: 1 }}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: COLORS.lightBorder, true: TINTS.livingGreenBg }} thumbColor={COLORS.pureWhite} />
    </View>
  );
}

export default function FarmerSettings() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const { locale, setLocale } = useI18n();
  const me = useQuery({ queryKey: queryKeys.me, queryFn: () => authApi.me().then((r) => r.data), enabled: isAuthenticated, retry: false });
  const [notifications, setNotifications] = useState(true);
  const [digest, setDigest] = useState(false);
  const [mfa, setMfa] = useState(false);

  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title={t('ui.parametres_ef8f0')} subtitle={t('ui.preferencesDeVotreCompte')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.parametres_ef8f0')} icon="settings-outline">
          <Card tone="white">
            <Text preset="h3" style={styles.mb}>{t('common.language')}</Text>
            <View style={styles.chips}>
              {SUPPORTED_LOCALES.map((option) => {
                const active = locale === option.code;
                return (
                  <PressableScale key={option.code} onPress={() => setLocale(option.code)} style={[styles.localeChip, active ? styles.localeChipActive : null]}>
                    <Text preset="bodySm" color={active ? COLORS.pureWhite : COLORS.textPrimary}>{option.native}</Text>
                  </PressableScale>
                );
              })}
            </View>
          </Card>
          <Card tone="white">
            <Text preset="h3" style={styles.mb}>{t('ui.notifications')}</Text>
            <Row label={t('ui.notificationsPush')} value={notifications} onValueChange={setNotifications} />
            <Row label={t('ui.resumeHebdomadaire')} value={digest} onValueChange={setDigest} />
          </Card>
          <Card tone="white">
            <Text preset="h3" style={styles.mb}>{t('ui.securite_33e96')}</Text>
            <Row label={t('ui.doubleAuthentification2fa')} value={mfa} onValueChange={setMfa} />
            <Text preset="caption" color={COLORS.slateGray} style={styles.mt}>{t('ui.emailVerifieTelephoneVerifie', { value: me.data?.user.emailVerified ? 'oui' : 'non', value2: me.data?.user.phoneVerified ? 'oui' : 'non' })}</Text>
          </Card>
          <Button label={t('common.save')} variant="primary" onPress={() => {}} />
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  mb: { marginBottom: SPACING.sm },
  mt: { marginTop: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.xs },
  chips: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  localeChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.lightBorder, backgroundColor: COLORS.naturalWhite },
  localeChipActive: { backgroundColor: COLORS.forestGreen, borderColor: COLORS.forestGreen },
});
