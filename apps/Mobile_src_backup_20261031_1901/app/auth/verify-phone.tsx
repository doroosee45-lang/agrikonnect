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

/** Vérification du téléphone par OTP (SMS ou WhatsApp). */
export default function VerifyPhone() {
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
      <AuthShell title="Vérifier mon téléphone" subtitle="Connectez-vous pour vérifier votre numéro.">
        <Card tone="pale">
          <Text preset="bodySm" color={COLORS.slateGray}>
            Cette page est réservée aux comptes connectés.
          </Text>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Vérifier mon téléphone"
      subtitle="Un numéro vérifié renforce la crédibilité de votre profil et permet les notifications par SMS ou WhatsApp."
    >
      <View style={styles.form}>
        <Card tone="white" style={styles.current}>
          <Ionicons name="call-outline" size={16} color={COLORS.forestGreen} />
          <Text preset="bodyMedium" color={COLORS.textPrimary}>
            {user?.phone ?? 'Aucun numéro renseigné'}
          </Text>
          {user?.phoneVerified ? <Text preset="caption" color={COLORS.success}>Déjà vérifié</Text> : null}
        </Card>

        <View style={styles.block}>
          <Text preset="caption" color={COLORS.textPrimary}>
            Canal
          </Text>
          <ChipRow>
            <FilterChip label="SMS" active={channel === 'SMS'} onPress={() => setChannel('SMS')} />
            <FilterChip label="WhatsApp" active={channel === 'WHATSAPP'} onPress={() => setChannel('WHATSAPP')} />
          </ChipRow>
        </View>

        <Button
          label="Envoyer le code"
          onPress={() => send.mutate()}
          variant="outline"
          icon="send-outline"
          fullWidth
          loading={send.isPending}
        />

        {sent ? (
          <Text preset="caption" color={COLORS.slateGray}>
            Code envoyé, valable {sent} minutes.
          </Text>
        ) : null}

        <Input
          label="Code reçu"
          value={code}
          onChangeText={setCode}
          placeholder="000000"
          icon="keypad-outline"
          keyboardType="number-pad"
          maxLength={8}
        />

        <Button
          label="Vérifier"
          onPress={() => verify.mutate()}
          variant="primary"
          fullWidth
          loading={verify.isPending}
          disabled={code.trim().length < 4}
        />

        {send.isError ? <ErrorState error={send.error} /> : null}
        {verify.isError ? <ErrorState error={verify.error} /> : null}
        {verify.isSuccess ? (
          <Text preset="caption" color={COLORS.success}>
            Numéro vérifié.
          </Text>
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
