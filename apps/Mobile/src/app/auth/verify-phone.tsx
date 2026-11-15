import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';

import { AuthShell } from '@/components/auth/AuthShell';
import { Button, Card, ChipRow, ErrorState, FilterChip, Input, Text } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { authApi } from '@/services/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/i18n';

/** Vérification du téléphone par OTP (SMS ou WhatsApp). */
export default function VerifyPhone() {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const [channel, setChannel] = useState<'SMS' | 'WHATSAPP'>('SMS');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<number | null>(null);

  const send = useMutation({
    mutationFn: () => authApi.sendOtp({ channel }).then((result) => result.data),
    onSuccess: (data) => setSent(data.expiresInMinutes),
  });

  const verify = useMutation({
    mutationFn: () => authApi.verifyPhone({ code: code.trim() }),
    onSuccess: () => void refreshProfile(),
  });

  if (!isAuthenticated) {
    return (
      <AuthShell title={t('ui.verifierMonTelephone')} subtitle={t('ui.connectezVousPourVerifierVotreNumero')}>
        <Card tone="pale">
          <Text preset="bodySm" color={COLORS.slateGray}>{t('ui.cettePageEstReserveeAuxComptes')}</Text>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t('ui.verifierMonTelephone')}
      subtitle={t('ui.unNumeroVerifieRenforceLaCredibilite')}
    >
      <View style={styles.form}>
        <Card tone="white" style={styles.current}>
          <Ionicons name="call-outline" size={16} color={COLORS.forestGreen} />
          <Text preset="bodyMedium" color={COLORS.textPrimary}>
            {user?.phone ?? t('ui.aucunNumeroRenseigne')}
          </Text>
          {user?.phoneVerified ? <Text preset="caption" color={COLORS.success}>{t('ui.dejaVerifie')}</Text> : null}
        </Card>

        <View style={styles.block}>
          <Text preset="caption" color={COLORS.textPrimary}>{t('ui.canal')}</Text>
          <ChipRow>
            <FilterChip label="SMS" active={channel === 'SMS'} onPress={() => setChannel('SMS')} />
            <FilterChip label={t('ui.whatsapp')} active={channel === 'WHATSAPP'} onPress={() => setChannel('WHATSAPP')} />
          </ChipRow>
        </View>

        <Button
          label={t('ui.envoyerLeCode')}
          onPress={() => send.mutate()}
          variant="outline"
          icon="send-outline"
          fullWidth
          loading={send.isPending}
        />

        {sent ? (
          <Text preset="caption" color={COLORS.slateGray}>{t('ui.codeEnvoyeValableMinutes', { sent })}</Text>
        ) : null}

        <Input
          label={t('ui.codeRecu')}
          value={code}
          onChangeText={setCode}
          placeholder="000000"
          icon="keypad-outline"
          keyboardType="number-pad"
          maxLength={8}
        />

        <Button
          label={t('ui.verifier')}
          onPress={() => verify.mutate()}
          variant="primary"
          fullWidth
          loading={verify.isPending}
          disabled={code.trim().length < 4}
        />

        {send.isError ? <ErrorState error={send.error} /> : null}
        {verify.isError ? <ErrorState error={verify.error} /> : null}
        {verify.isSuccess ? (
          <Text preset="caption" color={COLORS.success}>{t('ui.numeroVerifie')}</Text>
        ) : null}
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: SPACING.md },
  block: { gap: SPACING.sm },
  current: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
});
