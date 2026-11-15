import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';

import { AuthGate, Button, Card, Chip, ErrorState, Input, Section, Text, TextArea } from '@/components/ui';
import { authApi } from '@/services/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';
import { useI18n } from '@/i18n';

/** FARMER — profil producteur et complétude calculée côté serveur. */
export default function FarmerProfile() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const me = useAuthStore((state) => state.user);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const [firstName, setFirstName] = useState(me?.firstName ?? '');
  const [lastName, setLastName] = useState(me?.lastName ?? '');
  const [error, setError] = useState<unknown>(null);

  const save = useMutation({
    mutationFn: () => authApi.updateMe({ firstName: firstName.trim(), lastName: lastName.trim() }),
    onSuccess: () => {
      setError(null);
      void refreshProfile();
    },
    onError: (caught) => setError(caught),
  });

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title={t('ui.monProfil')} icon="👤">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }} style={{ maxWidth: 640 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.monProfil')}</Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>{t('ui.cesInformationsApparaissentSurVotreFiche')}</Text>

          <Card tone="white" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Text preset="bodySm">{t('ui.email_946f4', { value: me?.email ?? '—' })}</Text>
              <Text preset="bodySm">{t('ui.telephone', { value: me?.phone ?? '—' })}</Text>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip label={me?.emailVerified ? t('ui.emailVerifie') : t('ui.emailNonVerifie')} tone={me?.emailVerified ? 'success' : 'warning'} size="sm" />
                {me?.phoneVerified ? <Chip label={t('ui.telephoneVerifie_4fdf8')} tone="success" size="sm" /> : <Chip label={t('ui.telephoneNonVerifie')} tone="warning" size="sm" />}
                <Chip label={me?.status ?? '—'} tone="neutral" size="sm" />
              </div>
            </div>
          </Card>

          <Card tone="white">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Input label={t('ui.prenom')} value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
                <Input label={t('ui.nom')} value={lastName} onChange={(event) => setLastName(event.target.value)} required />
              </div>
              {error ? <ErrorState error={error} showRequestId /> : null}
              <Button label={t('common.save')} type="submit" loading={save.isPending} />
            </form>
          </Card>
        </motion.div>
      </AuthGate>
    </Section>
  );
}
