import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';

import { PageHeader, PublicShell } from '@/components/public-site/PublicShell';
import { AuthGate, Button, Card, ErrorState, Input, Section, Text } from '@/components/ui';
import { listingApi } from '@/services/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';

export default function PublicSiteAnnonceCreer() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [type, setType] = useState('OFFER');
  const [title, setTitle] = useState('');
  const [cropId, setCropId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('ton');
  const [quality, setQuality] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [countryCode, setCountryCode] = useState('');
  const [province, setProvince] = useState('');
  const [error, setError] = useState<unknown>(null);

  const create = useMutation({
    mutationFn: () => listingApi.create({
      type,
      cropId,
      title,
      quantity: Number(quantity),
      unit,
      quality: quality.trim() || undefined,
      indicativePrice: price.trim() ? Number(price) : null,
      currency,
      countryCode,
      province: province.trim() || undefined,
    }),
    onSuccess: () => { setError(null); router.push('/public-site/annonces'); },
    onError: (caught) => setError(caught),
  });

  return (
    <PublicShell active="annonces" footer={false}>
      <PageHeader index="09" eyebrow={t('ui.marketplace')} title={t('ui.publierUneAnnonce')} subtitle={t('ui.lePrixResteIndicatifIlNe')} />
      <Section background={COLORS.naturalWhite} bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.publierUneAnnonce')} icon="add-circle-outline">
          <Card tone="white">
            <View style={styles.form}>
              <View style={styles.typeRow}>
                <Button label={t('ui.offre')} variant={type === 'OFFER' ? 'primary' : 'outline'} size="sm" onPress={() => setType('OFFER')} />
                <Button label={t('ui.demande')} variant={type === 'DEMAND' ? 'primary' : 'outline'} size="sm" onPress={() => setType('DEMAND')} />
              </View>
              <Input label={t('ui.titre_dbeb7')} value={title} onChangeText={setTitle} />
              <Input label={t('ui.cultureIdentifiant')} value={cropId} onChangeText={setCropId} />
              <View style={styles.row2}>
                <Input label={t('ui.quantite_d8a4d')} value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
                <Input label={t('ui.unite_99101')} value={unit} onChangeText={setUnit} />
              </View>
              <Input label={t('ui.qualite')} value={quality} onChangeText={setQuality} />
              <View style={styles.row2}>
                <Input label={t('ui.prixIndicatif')} value={price} onChangeText={setPrice} keyboardType="numeric" />
                <Input label={t('ui.devise')} value={currency} onChangeText={setCurrency} />
              </View>
              <View style={styles.row2}>
                <Input label={t('ui.pays_219ad')} value={countryCode} onChangeText={setCountryCode} />
                <Input label={t('ui.province')} value={province} onChangeText={setProvince} />
              </View>
              {error ? <ErrorState error={error} /> : null}
              <Text preset="caption" color={COLORS.slateGray}>{t('ui.lesChampsMarquesDUnAsterisque')}</Text>
              <Button
                label={t('ui.publier')}
                onPress={() => create.mutate()}
                loading={create.isPending}
                disabled={title.trim().length === 0 || cropId.trim().length === 0 || quantity.trim().length === 0 || countryCode.trim().length === 0}
              />
            </View>
          </Card>
        </AuthGate>
      </Section>
    </PublicShell>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, form: { gap: SPACING.md }, row2: { flexDirection: 'row', gap: SPACING.sm }, typeRow: { flexDirection: 'row', gap: SPACING.sm } });
