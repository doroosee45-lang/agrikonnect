import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';

import { AuthGate, Button, Card, Chip, ErrorState, Input, Section, Text, TextArea } from '@/components/ui';
import { authApi } from '@/services/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';

/** FARMER — profil producteur et complétude calculée côté serveur. */
export default function FarmerProfile() {
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
      <AuthGate isAuthenticated={isAuthenticated} title="Mon profil" icon="👤">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }} style={{ maxWidth: 640 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Mon profil
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
            Ces informations apparaissent sur votre fiche publique si vous la publiez.
          </Text>

          <Card tone="white" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Text preset="bodySm">Email : {me?.email ?? '—'}</Text>
              <Text preset="bodySm">Téléphone : {me?.phone ?? '—'}</Text>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip label={me?.emailVerified ? 'email vérifié' : 'email non vérifié'} tone={me?.emailVerified ? 'success' : 'warning'} size="sm" />
                {me?.phoneVerified ? <Chip label="téléphone vérifié" tone="success" size="sm" /> : <Chip label="téléphone non vérifié" tone="warning" size="sm" />}
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
                <Input label="Prénom" value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
                <Input label="Nom" value={lastName} onChange={(event) => setLastName(event.target.value)} required />
              </div>
              {error ? <ErrorState error={error} showRequestId /> : null}
              <Button label="Enregistrer" type="submit" loading={save.isPending} />
            </form>
          </Card>
        </motion.div>
      </AuthGate>
    </Section>
  );
}
