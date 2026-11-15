import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

import { AuthGate, Button, Card, ErrorState, Input, Section, Text } from '@/components/ui';
import { plotApi } from '@/services/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';
import { useI18n } from '@/i18n';

/** FARMER — création d'une parcelle. */
export default function FarmerPlotCreate() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [farmId, setFarmId] = useState('');
  const [name, setName] = useState('');
  const [areaHa, setAreaHa] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [error, setError] = useState<unknown>(null);

  const create = useMutation({
    mutationFn: () =>
      plotApi.create({
        farmId: farmId.trim(),
        name: name.trim(),
        areaHa: areaHa ? Number(areaHa) : undefined,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
      }),
    onSuccess: () => {
      setError(null);
      navigate('/farmer/plots');
    },
    onError: (caught) => setError(caught),
  });

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title={t('ui.nouvelleParcelle')} icon="🗺️">
        <div style={{ marginBottom: 24 }}>
          <Link to="/farmer/plots" style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>{t('ui.retourAuxParcelles')}</Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }} style={{ maxWidth: 640 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.nouvelleParcelle')}</Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>{t('ui.laLocalisationSaisieEstApproximativeElle')}</Text>

          <Card tone="white">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                create.mutate();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <Input label={t('ui.exploitationIdentifiant')} value={farmId} onChange={(event) => setFarmId(event.target.value)} required />
              <Input label={t('ui.nom')} value={name} onChange={(event) => setName(event.target.value)} required />
              <Input label={t('ui.surfaceHa')} type="number" step="0.01" value={areaHa} onChange={(event) => setAreaHa(event.target.value)} optionalLabel={t('ui.optionnel')} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Input label={t('ui.latitude')} type="number" step="0.000001" value={latitude} onChange={(event) => setLatitude(event.target.value)} optionalLabel={t('ui.optionnel')} />
                <Input label={t('ui.longitude')} type="number" step="0.000001" value={longitude} onChange={(event) => setLongitude(event.target.value)} optionalLabel={t('ui.optionnel')} />
              </div>

              {error ? <ErrorState error={error} showRequestId /> : null}

              <Button label={t('ui.creerLaParcelle')} type="submit" loading={create.isPending} disabled={!name.trim() || !farmId.trim()} />
            </form>
          </Card>
        </motion.div>
      </AuthGate>
    </Section>
  );
}
