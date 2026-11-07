import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';

import { Button, Card, Input, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';
import { getUserInitialRoute } from '@/lib/redirects';

const ACCOUNT_TYPES = [
  { value: 'FARMER', label: 'Producteur' },
  { value: 'COOPERATIVE_ADMIN', label: 'Coopérative' },
  { value: 'AGRICULTURAL_COMPANY', label: 'Société agricole' },
  { value: 'BUYER', label: 'Acheteur' },
  { value: 'SUPPLIER', label: 'Fournisseur' },
  { value: 'TRANSPORTER', label: 'Transporteur' },
  { value: 'AGRONOMIST', label: 'Agronome' },
  { value: 'INVESTOR', label: 'Investisseur' },
  { value: 'SUPPORT_AGENT', label: 'Agent d’appui' },
] as const;

export default function Register() {
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);
  const status = useAuthStore((state) => state.status);

  /*
   * Garde des pages d auth (CAA) : une session deja ouverte repart vers
   * son espace via la destination centrale - jamais le formulaire
   * d inscription en double.
   */
  useEffect(() => {
    if (status !== 'authenticated') return;
    const etat = useAuthStore.getState();
    if (etat.user) {
      navigate(getUserInitialRoute({ user: etat.user, permissions: etat.permissions }).route);
    }
  }, [status, navigate]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<(typeof ACCOUNT_TYPES)[number]['value']>('FARMER');
  const [countryCode, setCountryCode] = useState('CD');
  const [error, setError] = useState<string | null>(null);
  const busy = useAuthStore((state) => state.busy);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await register({ accountType, firstName, lastName, email, password, countryCode });
      // La vérification d'adresse est la prochaine étape : l'écran dédié se
      // charge du renvoi du lien, l'adresse y est préremplie (?email=…).
      navigate('/auth/verify-email?email=' + encodeURIComponent(email));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'inscription');
    }
  };

  return (
    <Section style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}
        style={{ width: '100%', maxWidth: 480 }}
      >
        <Card tone="white" style={{ padding: 32 }}>
          <Text preset="h2" style={{ marginBottom: 8, textAlign: 'center' }}>
            Créer un compte
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32, textAlign: 'center' }}>
            Rejoignez la plateforme de traçabilité agricole africaine.
          </Text>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input
                label="Prénom"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="given-name"
              />
              <Input
                label="Nom"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="family-name"
              />
            </div>

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <Input
              label="Mot de passe"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
              hint="Au moins 8 caractères"
            />

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>Type de compte</span>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as typeof accountType)}
                style={{
                  height: 44,
                  padding: '0 14px',
                  fontSize: 15,
                  fontFamily: 'var(--font-body)',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${COLORS.lightBorder}`,
                  backgroundColor: COLORS.pureWhite,
                  color: COLORS.textPrimary,
                  outline: 'none',
                }}
              >
                {ACCOUNT_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <Input
              label="Code pays"
              type="text"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
              required
              maxLength={2}
              hint="ISO 3166-1 alpha-2 (ex. CD, CI, SN)"
            />

            {error ? (
              <div style={{ fontSize: 13, color: COLORS.error, textAlign: 'center' }}>{error}</div>
            ) : null}

            <Button label="Créer mon compte" type="submit" loading={busy} fullWidth />
          </form>

          <div style={{ marginTop: 24, textAlign: 'center', fontSize: 14, color: COLORS.slateGray }}>
            Déjà un compte ?{' '}
            <Link to="/auth/login" style={{ color: COLORS.forestGreen, fontWeight: 600, textDecoration: 'none' }}>
              Se connecter
            </Link>
          </div>
        </Card>
      </motion.div>
    </Section>
  );
}
