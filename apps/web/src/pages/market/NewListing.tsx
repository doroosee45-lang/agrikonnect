import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

import { AuthGate, Button, Card, ErrorState, Input, Section, Text } from '@/components/ui';
import { listingApi } from '@/services/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';

/** MARKET — création d'une annonce de vente. */
export default function MarketNewListing() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [cropSlug, setCropSlug] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [error, setError] = useState<unknown>(null);

  const create = useMutation({
    mutationFn: () =>
      listingApi.create({
        cropSlug: cropSlug.trim(),
        quantityKg: quantityKg ? Number(quantityKg) : undefined,
        unitPrice: unitPrice ? Number(unitPrice) : undefined,
        currency,
      }),
    onSuccess: () => {
      setError(null);
      navigate('/market/listings');
    },
    onError: (caught) => setError(caught),
  });

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Nouvelle annonce" icon="🛒">
        <div style={{ marginBottom: 24 }}>
          <Link to="/market/listings" style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>
            ← Retour aux annonces
          </Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }} style={{ maxWidth: 560 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Nouvelle annonce
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
            Publiez une annonce de vente. Vos coordonnées restent masquées : les acheteurs passent par la messagerie interne.
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Input label="Prix unitaire" type="number" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} optionalLabel="optionnel" />
                <Input label="Devise" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase().slice(0, 3))} maxLength={3} />
              </div>

              {error ? <ErrorState error={error} showRequestId /> : null}

              <Button label="Publier l'annonce" type="submit" loading={create.isPending} disabled={!cropSlug.trim()} />
            </form>
          </Card>
        </motion.div>
      </AuthGate>
    </Section>
  );
}
