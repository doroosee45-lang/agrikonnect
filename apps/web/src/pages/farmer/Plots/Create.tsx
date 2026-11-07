import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

import { AuthGate, Button, Card, ErrorState, Input, Section, Text } from '@/components/ui';
import { plotApi } from '@/services/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';

/** FARMER — création d'une parcelle. */
export default function FarmerPlotCreate() {
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
      <AuthGate isAuthenticated={isAuthenticated} title="Nouvelle parcelle" icon="🗺️">
        <div style={{ marginBottom: 24 }}>
          <Link to="/farmer/plots" style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>
            ← Retour aux parcelles
          </Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }} style={{ maxWidth: 640 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Nouvelle parcelle
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
            La localisation saisie est approximative : elle protège la position exacte de la parcelle.
          </Text>

          <Card tone="white">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                create.mutate();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <Input label="Exploitation (identifiant)" value={farmId} onChange={(event) => setFarmId(event.target.value)} required />
              <Input label="Nom" value={name} onChange={(event) => setName(event.target.value)} required />
              <Input label="Surface (ha)" type="number" step="0.01" value={areaHa} onChange={(event) => setAreaHa(event.target.value)} optionalLabel="optionnel" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Input label="Latitude" type="number" step="0.000001" value={latitude} onChange={(event) => setLatitude(event.target.value)} optionalLabel="optionnel" />
                <Input label="Longitude" type="number" step="0.000001" value={longitude} onChange={(event) => setLongitude(event.target.value)} optionalLabel="optionnel" />
              </div>

              {error ? <ErrorState error={error} showRequestId /> : null}

              <Button label="Créer la parcelle" type="submit" loading={create.isPending} disabled={!name.trim() || !farmId.trim()} />
            </form>
          </Card>
        </motion.div>
      </AuthGate>
    </Section>
  );
}
