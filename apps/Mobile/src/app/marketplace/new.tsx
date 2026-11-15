import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Card, ErrorState, Input, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { listingApi } from '@/services/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function MarketplaceNew() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const { t } = useI18n();
  const [type, setType] = useState<'OFFER' | 'DEMAND'>('OFFER');
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
      quality: quality || undefined,
      indicativePrice: price ? Number(price) : null,
      currency,
      countryCode,
      province: province || undefined,
    }),
    onSuccess: () => { setError(null); router.push('/marketplace'); },
    onError: (caught) => setError(caught),
  });

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('ui.nouvelleAnnonce')} subtitle={t('ui.publiezUneOffreOuUneDemande')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.nouvelleAnnonce')} icon="add-circle-outline">
          <Card tone="white">
            <View style={styles.form}>
              <View style={styles.typeRow}>
                <Button label={t('ui.offre')} variant={type === 'OFFER' ? 'primary' : 'outline'} size="sm" onPress={() => setType('OFFER')} />
                <Button label={t('ui.demande')} variant={type === 'DEMAND' ? 'primary' : 'outline'} size="sm" onPress={() => setType('DEMAND')} />
              </View>
              <Input label={t('ui.titre')} value={title} onChangeText={setTitle} />
              <Input label={t('ui.cultureId')} value={cropId} onChangeText={setCropId} />
              <View style={styles.row2}>
                <Input label={t('ui.quantite')} value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
                <Input label={t('ui.unite')} value={unit} onChangeText={setUnit} />
              </View>
              <Input label={t('ui.qualite')} value={quality} onChangeText={setQuality} />
              <View style={styles.row2}>
                <Input label={t('ui.prixIndicatif')} value={price} onChangeText={setPrice} keyboardType="numeric" />
                <Input label={t('ui.devise')} value={currency} onChangeText={setCurrency} />
              </View>
              <View style={styles.row2}>
                <Input label={t('ui.pays')} value={countryCode} onChangeText={setCountryCode} />
                <Input label={t('ui.province')} value={province} onChangeText={setProvince} />
              </View>
              {error ? <ErrorState error={error} /> : null}
              <Text preset="caption" color={COLORS.slateGray}>{t('ui.lesChampsMarquesDUnAsterisque')}</Text>
              <Button label={t('ui.publier')} onPress={() => create.mutate()} loading={create.isPending} disabled={title.trim().length === 0 || cropId.trim().length === 0} />
            </View>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, form: { gap: SPACING.md }, row2: { flexDirection: 'row', gap: SPACING.sm }, typeRow: { flexDirection: 'row', gap: SPACING.sm } });
