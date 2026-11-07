import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { Button, Card, Input, Section, Text } from '@/components/ui';
import { authApi } from '@/services/endpoints';
import { COLORS, DURATION, EASE } from '@/theme';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'envoi');
    } finally {
      setLoading(false);
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
            Mot de passe oublié
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32, textAlign: 'center' }}>
            Entrez votre email pour réinitialiser votre mot de passe.
          </Text>

          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <Text preset="bodyMd" color={COLORS.success} style={{ marginBottom: 24 }}>
                ✓ Un email de réinitialisation a été envoyé à {email}
              </Text>
              <Link to="/auth/login">
                <Button label="Retour à la connexion" variant="outline" fullWidth />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />

              {error ? (
                <div style={{ fontSize: 13, color: COLORS.error, textAlign: 'center' }}>{error}</div>
              ) : null}

              <Button label="Envoyer le lien" type="submit" loading={loading} fullWidth />
            </form>
          )}

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Link to="/auth/login" style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>
              ← Retour à la connexion
            </Link>
          </div>
        </Card>
      </motion.div>
    </Section>
  );
}
