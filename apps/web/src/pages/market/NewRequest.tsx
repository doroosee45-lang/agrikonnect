import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

import { AuthGate, Button, Card, ErrorState, Input, Section, Text } from '@/components/ui';
import { requestApi } from '@/services/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';

/** MARKET — création d'une demande d'achat. */
export default function MarketNewRequest() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [cropSlug, setCropSlug] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [countryCode, setCountryCode] = useState('CD');
  const [error, setError] = useState<unknown>(null);

  const create = useMutation({
    mutationFn: () =>
      requestApi.create({
        cropSlug: cropSlug.trim(),
        quantityKg: quantityKg ? Number(quantityKg) : undefined,
        countryCode,
      }),
    onSuccess: () => {
      setError(null);
      navigate('/market/requests');
    },
    onError: (caught) => setError(caught),
  });

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Nouvelle demande" icon="📋">
        <div style={{ marginBottom: 24 }}>
          <Link to="/market/requests" style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>
            ← Retour aux demandes
          </Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }} style={{ maxWidth: 560 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Nouvelle demande d'achat
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
            Publiez une demande d'achat pour que les producteurs puissent y répondre.
          </Text>

          <Card tone="white">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                create.mutate();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <Input label="Culture (slug)" value={cropSlug} onChange={(event) => setCropSlug(event.target.value)} required />
              <Input label="Quantité (kg)" type="number" step="1" value={quantityKg} onChange={(event) => setQuantityKg(event.target.value)} optionalLabel="optionnel" />
              <Input label="Code pays" value={countryCode} onChange={(event) => setCountryCode(event.target.value.toUpperCase().slice(0, 2))} required maxLength={2} />

              {error ? <ErrorState error={error} showRequestId /> : null}

              <Button label="Publier la demande" type="submit" loading={create.isPending} disabled={!cropSlug.trim()} />
            </form>
          </Card>
        </motion.div>
      </AuthGate>
    </Section>
  );
}
