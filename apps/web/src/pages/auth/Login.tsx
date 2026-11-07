import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';

import { Button, Card, Input, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';
import { getUserInitialRoute } from '@/lib/redirects';

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const pendingMfa = useAuthStore((state) => state.pendingMfa);
  const busy = useAuthStore((state) => state.busy);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const showMfa = pendingMfa !== null;
  const status = useAuthStore((state) => state.status);

  /*
   * Garde des pages d auth (CAA) : une session deja ouverte repart vers
   * son espace via la destination centrale - jamais le site public,
   * jamais un formulaire en double.
   */
  useEffect(() => {
    if (status !== 'authenticated') return;
    const etat = useAuthStore.getState();
    if (etat.user) {
      navigate(getUserInitialRoute({ user: etat.user, permissions: etat.permissions }).route);
    }
  }, [status, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await login({ identifier, password, mfaCode: mfaCode.trim() || undefined });
      const etat = useAuthStore.getState();
      navigate(getUserInitialRoute({ user: etat.user, permissions: etat.permissions }).route);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identifiants incorrects');
    }
  };

  return (
    <Section style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}
        style={{ width: '100%', maxWidth: 420 }}
      >
        <Card tone="white" style={{ padding: 32 }}>
          <Text preset="h2" style={{ marginBottom: 8, textAlign: 'center' }}>
            Connexion
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32, textAlign: 'center' }}>
            Accédez à votre espace producteur, acheteur ou investisseur.
          </Text>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Email ou téléphone"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
            />
            <Input
              label="Mot de passe"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            {showMfa ? (
              <Input
                label="Code MFA"
                type="text"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="Code à 6 chiffres"
                required
                autoComplete="one-time-code"
                hint="Second facteur requis pour ce compte"
              />
            ) : null}

            {error ? (
              <div style={{ fontSize: 13, color: COLORS.error, textAlign: 'center' }}>{error}</div>
            ) : null}

            <Button label="Se connecter" type="submit" loading={busy} fullWidth />
          </form>

          <div style={{ marginTop: 24, textAlign: 'center', fontSize: 14, color: COLORS.slateGray }}>
            Pas encore de compte ?{' '}
            <Link to="/auth/register" style={{ color: COLORS.forestGreen, fontWeight: 600, textDecoration: 'none' }}>
              Créer un compte
            </Link>
          </div>

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Link to="/auth/forgot" style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>
              Mot de passe oublié ?
            </Link>
          </div>
        </Card>
      </motion.div>
    </Section>
  );
}
