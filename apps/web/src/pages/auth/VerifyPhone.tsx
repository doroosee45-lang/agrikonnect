import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

import { Button, Card, ErrorState, Input, Section, Text } from '@/components/ui';
import { authApi } from '@/services/endpoints';
import { COLORS, DURATION, EASE } from '@/theme';

/** AUTH — vérification de téléphone par OTP. */
export default function AuthVerifyPhone() {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState(false);

  const verify = useMutation({
    mutationFn: () => authApi.verifyPhone({ code: otp }),
    onSuccess: () => {
      setError(null);
      setSuccess(true);
    },
    onError: (caught) => setError(caught),
  });

  const sendOtp = useMutation({
    mutationFn: () => authApi.sendOtp({ channel: 'SMS' }),
    onError: (caught) => setError(caught),
  });

  return (
    <Section>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }} style={{ maxWidth: 480, margin: '0 auto' }}>
        <Text preset="h1" style={{ marginBottom: 8 }}>
          Vérification de téléphone
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
          Saisissez le code reçu par SMS pour vérifier votre numéro.
        </Text>

        <Card tone="white">
          {success ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Text preset="h3" style={{ marginBottom: 12 }}>
                Téléphone vérifié
              </Text>
              <Link to="/auth/login">
                <Button label="Se connecter" variant="outline" size="sm" />
              </Link>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                verify.mutate();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <Input label="Code OTP" value={otp} onChange={(event) => setOtp(event.target.value)} required />
              {error ? <ErrorState error={error} showRequestId /> : null}
              <Button label="Vérifier" type="submit" loading={verify.isPending} disabled={!otp} />
              <Button
                label="Renvoyer le code"
                variant="ghost"
                size="sm"
                loading={sendOtp.isPending}
                onClick={() => sendOtp.mutate()}
              />
            </form>
          )}
        </Card>
      </motion.div>
    </Section>
  );
}
