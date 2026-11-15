import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

import { AuthGate, Button, Card, ErrorState, Input, Section, Text } from '@/components/ui';
import { requestApi } from '@/services/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';
import { useI18n } from '@/i18n';

/** MARKET — création d'une demande d'achat. */
export default function MarketNewRequest() {
  const { t } = useI18n();
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
      <AuthGate isAuthenticated={isAuthenticated} title={t('ui.nouvelleDemande')} icon="📋">
        <div style={{ marginBottom: 24 }}>
          <Link to="/market/requests" style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>{t('ui.retourAuxDemandes')}</Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }} style={{ maxWidth: 560 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.nouvelleDemandeDAchat')}</Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>{t('ui.publiezUneDemandeDAchatPour')}</Text>

          <Card tone="white">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                create.mutate();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <Input label={t('ui.cultureSlug')} value={cropSlug} onChange={(event) => setCropSlug(event.target.value)} required />
              <Input label={t('ui.quantiteKg')} type="number" step="1" value={quantityKg} onChange={(event) => setQuantityKg(event.target.value)} optionalLabel={t('ui.optionnel')} />
              <Input label={t('ui.codePays')} value={countryCode} onChange={(event) => setCountryCode(event.target.value.toUpperCase().slice(0, 2))} required maxLength={2} />

              {error ? <ErrorState error={error} showRequestId /> : null}

              <Button label={t('ui.publierLaDemande')} type="submit" loading={create.isPending} disabled={!cropSlug.trim()} />
            </form>
          </Card>
        </motion.div>
      </AuthGate>
    </Section>
  );
}
