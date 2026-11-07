import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

import { AuthGate, Button, Card, ErrorState, Input, Section, Text } from '@/components/ui';
import { authApi } from '@/services/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';

/** AGENT — inscription d'un agent de terrain pour le compte d'un producteur. */
export default function AgentRegistration() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [countryCode, setCountryCode] = useState('CD');
  const [error, setError] = useState<unknown>(null);

  const register = useMutation({
    mutationFn: () =>
      authApi.register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        password,
        countryCode,
        accountType: 'FARMER',
      }),
    onSuccess: () => {
      setError(null);
      navigate('/agent/consent');
    },
    onError: (caught) => setError(caught),
  });

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Inscription d'un producteur" description="Enregistrez un producteur pour lequel vous intervenez." icon="🧑‍🌾">
        <div style={{ marginBottom: 24 }}>
          <Link to="/agent/consent" style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>
            ← Consentement
          </Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }} style={{ maxWidth: 560 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Inscription d'un producteur
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
            Vous agissez pour le compte d'un producteur. Le consentement doit être enregistré avant toute saisie.
          </Text>

          <Card tone="white">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                register.mutate();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Input label="Prénom" value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
                <Input label="Nom" value={lastName} onChange={(event) => setLastName(event.target.value)} required />
              </div>
              <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} optionalLabel="optionnel" />
              <Input label="Téléphone" value={phone} onChange={(event) => setPhone(event.target.value)} optionalLabel="optionnel" />
              <Input label="Mot de passe" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              <Input label="Code pays" value={countryCode} onChange={(event) => setCountryCode(event.target.value.toUpperCase().slice(0, 2))} required maxLength={2} />

              {error ? <ErrorState error={error} showRequestId /> : null}

              <Button label="Créer le compte" type="submit" loading={register.isPending} disabled={!firstName.trim() || !lastName.trim() || !password} />
            </form>
          </Card>
        </motion.div>
      </AuthGate>
    </Section>
  );
}
