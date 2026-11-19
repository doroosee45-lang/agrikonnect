import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';

import { Button, Card, Input, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';
import { getUserInitialRoute } from '@/lib/redirects';
import { useI18n, tr } from '@/i18n';

const ACCOUNT_TYPES = [
  { value: 'FARMER', get label() { return tr('ui.producteur'); } },
  { value: 'COOPERATIVE_ADMIN', get label() { return tr('ui.cooperative'); } },
  { value: 'AGRICULTURAL_COMPANY', get label() { return tr('ui.societeAgricole'); } },
  { value: 'BUYER', get label() { return tr('ui.acheteur'); } },
  { value: 'SUPPLIER', get label() { return tr('ui.fournisseur'); } },
  { value: 'TRANSPORTER', get label() { return tr('ui.transporteur'); } },
  { value: 'INVESTOR', get label() { return tr('ui.investisseur'); } },
  // Agronome et agent d'appui : attribués par un administrateur (audit H-01).
] as const;

export default function Register() {
  const { t, locale } = useI18n();
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
      await register({ accountType, firstName, lastName, email, password, countryCode, locale }); // langue active (I18N-01)
      // L'API a déjà envoyé le lien de vérification ; l'écran dédié permet de
      // le renvoyer au besoin, l'adresse y est préremplie (?email=…).
      navigate('/auth/verify-email?email=' + encodeURIComponent(email));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ui.erreurLorsDeLInscription'));
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
          <Text preset="h2" style={{ marginBottom: 8, textAlign: 'center' }}>{t('ui.creerUnCompte')}</Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32, textAlign: 'center' }}>{t('ui.rejoignezLaPlateformeDeTracabiliteAgricole')}</Text>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 12 }}>
              <Input
                label={t('ui.prenom')}
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="given-name"
              />
              <Input
                label={t('ui.lastName')}
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="family-name"
              />
            </div>

            <Input
              label={t('ui.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <Input
              label={t('ui.motDePasse')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
              hint={t('ui.auMoins8Caracteres')}
            />

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>{t('ui.typeDeCompte')}</span>
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
              label={t('ui.codePays')}
              type="text"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
              required
              maxLength={2}
              hint={t('ui.iso31661Alpha2Ex')}
            />

            {error ? (
              <div style={{ fontSize: 13, color: COLORS.error, textAlign: 'center' }}>{error}</div>
            ) : null}

            <Button label={t('ui.creerMonCompte')} type="submit" loading={busy} fullWidth />
          </form>

          <div style={{ marginTop: 24, textAlign: 'center', fontSize: 14, color: COLORS.slateGray }}>{t('ui.dejaUnCompte')}{' '}<Link to="/auth/login" style={{ color: COLORS.forestGreen, fontWeight: 600, textDecoration: 'none' }}>{t('ui.seConnecter')}</Link>
          </div>
        </Card>
      </motion.div>
    </Section>
  );
}
