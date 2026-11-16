import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Button, Card, Input, Section, Text } from '@/components/ui';
import { authApi } from '@/services/endpoints';
import { COLORS, DURATION, EASE } from '@/theme';
import { useI18n } from '@/i18n';

/** AUTH — réinitialisation du mot de passe via le jeton reçu par email. */
export default function Reset() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // `token_hash` : format du modèle d'e-mail Supabase ; `token` : ancien format.
  const token = params.get('token_hash') ?? params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError(t('ui.lesDeuxMotsDePasseNe'));
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword({ token, password });
      setDone(true);
      window.setTimeout(() => navigate('/auth/login'), 1500);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('ui.leJetonEstInvalideOuExpire'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section style={{ minHeight: 'calc(100vh - 200px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}
        style={{ width: '100%', maxWidth: 440 }}
      >
        <Card tone="white" style={{ padding: 32 }}>
          <Text preset="h2" style={{ marginBottom: 8, textAlign: 'center' }}>{t('ui.nouveauMotDePasse')}</Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32, textAlign: 'center' }}>{t('ui.choisissezUnMotDePasseRobuste')}</Text>

          {done ? (
            <Text preset="bodyMd" color={COLORS.success} style={{ textAlign: 'center' }}>{t('ui.motDePasseReinitialiseRedirectionVers')}</Text>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {!token ? (
                <Text preset="caption" color={COLORS.warning}>{t('ui.aucunJetonDansLUrlRepassez')}</Text>
              ) : null}
              <Input label={t('ui.nouveauMotDePasse')} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" />
              <Input label={t('common.confirm')} type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required minLength={8} autoComplete="new-password" />
              {error ? <div style={{ fontSize: 13, color: COLORS.error, textAlign: 'center' }}>{error}</div> : null}
              <Button label={t('ui.reinitialiser')} type="submit" loading={loading} fullWidth />
            </form>
          )}

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Link to="/auth/login" style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>{t('ui.retourALaConnexion_b56d3')}</Link>
          </div>
        </Card>
      </motion.div>
    </Section>
  );
}
