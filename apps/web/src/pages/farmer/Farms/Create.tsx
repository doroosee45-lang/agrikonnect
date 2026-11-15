import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

import { AuthGate, Button, Card, ErrorState, Input, Section, Text, TextArea } from '@/components/ui';
import { farmApi } from '@/services/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';
import { useI18n } from '@/i18n';

/** FARMER — création d'une exploitation. */
export default function FarmerFarmCreate() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('CD');
  const [province, setProvince] = useState('');
  const [totalAreaHa, setTotalAreaHa] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<unknown>(null);

  const create = useMutation({
    mutationFn: () =>
      farmApi.create({
        name: name.trim(),
        countryCode,
        province: province.trim() || undefined,
        totalAreaHa: totalAreaHa ? Number(totalAreaHa) : undefined,
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      setError(null);
      navigate('/farmer/farms');
    },
    onError: (caught) => setError(caught),
  });

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title={t('ui.nouvelleExploitation')} icon="🏡">
        <div style={{ marginBottom: 24 }}>
          <Link to="/farmer/farms" style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>{t('ui.retourAuxExploitations_d3556')}</Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }} style={{ maxWidth: 640 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.nouvelleExploitation')}</Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>{t('ui.lesInformationsSaisiesIciSontMarquees')}</Text>

          <Card tone="white">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                create.mutate();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <Input label={t('ui.nom')} value={name} onChange={(event) => setName(event.target.value)} required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Input label={t('ui.codePays')} value={countryCode} onChange={(event) => setCountryCode(event.target.value.toUpperCase().slice(0, 2))} required maxLength={2} />
                <Input label={t('ui.province')} value={province} onChange={(event) => setProvince(event.target.value)} optionalLabel={t('ui.optionnel')} />
              </div>
              <Input label={t('ui.surfaceTotaleHa')} type="number" step="0.01" value={totalAreaHa} onChange={(event) => setTotalAreaHa(event.target.value)} optionalLabel={t('ui.optionnel')} />
              <TextArea label={t('ui.description')} value={description} onChange={(event) => setDescription(event.target.value)} minHeight={110} optionalLabel={t('ui.optionnel')} />

              {error ? <ErrorState error={error} showRequestId /> : null}

              <Button label={t('ui.creerLExploitation')} type="submit" loading={create.isPending} disabled={!name.trim()} />
            </form>
          </Card>
        </motion.div>
      </AuthGate>
    </Section>
  );
}
